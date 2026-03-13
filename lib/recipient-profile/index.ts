import type { Address } from "viem";
import { CHAIN_ID, TOKEN_ADDRESS } from "../blockchain/contracts";
import {
  resolveEnsForPayment,
  validateProfileForPayment,
  type ResolvedEnsProfile,
} from "../ens/service";
import type { PaymentRequest, LegacyPaymentRequest } from "../payments/request";

export type SupportedMode = "p2p" | "merchant" | "both";
export type SupportedToken = Address | "NATIVE";

export interface AcceptedAsset {
  chainId: number;
  token: SupportedToken;
  priority: number;
}

export interface RecipientProfile {
  primaryAddress: Address;
  ensName?: string;
  acceptedAssets: AcceptedAsset[];
  defaultAsset?: {
    chainId: number;
    token: SupportedToken;
  };
  mode?: SupportedMode;
  profileVersion: string;
}

export interface RecipientResolver {
  resolveByEns(name: string): Promise<RecipientProfile>;
  resolveByAddress(address: Address): Promise<RecipientProfile | null>;
  resolveFromNfc(payload: PaymentRequest): Promise<RecipientProfile>;
}

function isLegacyPaymentRequest(payload: PaymentRequest): payload is LegacyPaymentRequest {
  return "recipientAddress" in payload;
}

function getDefaultAcceptedAssetsForLegacy(payload: LegacyPaymentRequest): AcceptedAsset[] {
  const chains = payload.preferredChains?.length
    ? payload.preferredChains
    : [CHAIN_ID];
  const tokens = payload.preferredTokens?.length
    ? payload.preferredTokens
    : [TOKEN_ADDRESS];

  const assets: AcceptedAsset[] = [];
  let priority = 0;

  for (const chainId of chains) {
    for (const token of tokens) {
      assets.push({
        chainId,
        token,
        priority,
      });
      priority += 1;
    }
  }

  return assets;
}

function convertEnsProfileToRecipientProfile(
  resolved: ResolvedEnsProfile,
): RecipientProfile {
  const { address, profile, label } = resolved;

  return {
    primaryAddress: address,
    ensName: profile.ensName,
    acceptedAssets: profile.acceptedAssets.map((asset) => ({
      chainId: asset.chainId,
      token: asset.token,
      priority: asset.priority,
    })),
    defaultAsset: profile.defaultAsset
      ? {
          chainId: profile.defaultAsset.chainId,
          token: profile.defaultAsset.token,
        }
      : undefined,
    mode: profile.mode as SupportedMode,
    profileVersion: profile.profileVersion,
  };
}

export const recipientResolver: RecipientResolver = {
  async resolveByEns(name: string): Promise<RecipientProfile> {
    // Resolve ENS name onchain
    const resolved = await resolveEnsForPayment(name);

    if (!resolved) {
      throw new Error(`ENS name "${name}" not found or has no address`);
    }

    // Validate the profile for payment
    const validationError = validateProfileForPayment(resolved.profile);
    if (validationError) {
      throw new Error(validationError);
    }

    return convertEnsProfileToRecipientProfile(resolved);
  },

  async resolveByAddress(address: Address): Promise<RecipientProfile | null> {
    return {
      primaryAddress: address,
      acceptedAssets: [
        {
          chainId: CHAIN_ID,
          token: TOKEN_ADDRESS,
          priority: 0,
        },
      ],
      defaultAsset: {
        chainId: CHAIN_ID,
        token: TOKEN_ADDRESS,
      },
      mode: "p2p",
      profileVersion: "fallback-address-v1",
    };
  },

  async resolveFromNfc(payload: PaymentRequest): Promise<RecipientProfile> {
    // P2P flow: resolve from ENS if ensName is provided without recipientAddress
    if (!isLegacyPaymentRequest(payload) && payload.ensName) {
      return recipientResolver.resolveByEns(payload.ensName);
    }

    // Legacy flow: use address from NFC payload
    if (!isLegacyPaymentRequest(payload)) {
      throw new Error("NFC payload missing recipient address for legacy flow");
    }

    const recipientAddress = payload.recipientAddress;

    return {
      primaryAddress: recipientAddress,
      ensName: payload.ensName,
      acceptedAssets: getDefaultAcceptedAssetsForLegacy(payload),
      defaultAsset: payload.preferredChains?.[0]
        ? {
            chainId: payload.preferredChains[0],
            token: payload.preferredTokens?.[0] ?? TOKEN_ADDRESS,
          }
        : {
            chainId: CHAIN_ID,
            token: payload.preferredTokens?.[0] ?? TOKEN_ADDRESS,
          },
      mode: payload.mode ?? "p2p",
      profileVersion: payload.profileVersion ?? "nfc-v1",
    };
  },
};
