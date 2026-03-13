import type { Address } from "viem";
import { CHAIN_ID, TOKEN_ADDRESS, TOKEN_SYMBOL } from "../blockchain/contracts";
import {
  ENS_TEXT_KEYS,
  ENS_PARENT_DOMAIN,
  formatFullEnsName,
  normalizeEnsLabel,
} from "./config";

// Re-export text record keys from config for backwards compatibility
export const BUMP_PROFILE_VERSION_KEY = ENS_TEXT_KEYS.PROFILE_VERSION;
export const BUMP_MODE_KEY = ENS_TEXT_KEYS.MODE;
export const BUMP_DEFAULT_CHAIN_KEY = ENS_TEXT_KEYS.DEFAULT_CHAIN;
export const BUMP_DEFAULT_TOKEN_KEY = ENS_TEXT_KEYS.DEFAULT_TOKEN;

export const BUMP_TEXT_RECORD_KEYS = [
  BUMP_PROFILE_VERSION_KEY,
  BUMP_MODE_KEY,
  BUMP_DEFAULT_CHAIN_KEY,
  BUMP_DEFAULT_TOKEN_KEY,
] as const;

export const BUMP_MODE_OPTIONS = ["p2p", "merchant", "both"] as const;

export type BumpMode = (typeof BUMP_MODE_OPTIONS)[number];
export type BumpTokenValue = Address | "NATIVE";

export interface AcceptedAssetPreference {
  chainId: number;
  token: BumpTokenValue;
  priority: number;
}

export interface BumpEnsProfile {
  ensName: string;
  mode: BumpMode;
  profileVersion: "1";
  defaultAsset?: {
    chainId: number;
    token: BumpTokenValue;
  };
  acceptedAssets: AcceptedAssetPreference[];
}

export interface BumpTextRecordUpdate {
  key: string;
  value: string;
}

export interface PreparedBumpTextRecordUpdates {
  ensName: string;
  records: BumpTextRecordUpdate[];
  recordMap: Record<string, string>;
}

export const DEFAULT_BUMP_ENS_PROFILE: BumpEnsProfile = {
  ensName: "",
  mode: "p2p",
  profileVersion: "1",
  defaultAsset: {
    chainId: CHAIN_ID,
    token: TOKEN_ADDRESS,
  },
  acceptedAssets: [
    {
      chainId: CHAIN_ID,
      token: TOKEN_ADDRESS,
      priority: 0,
    },
  ],
};

function isAddressLike(value: string): value is Address {
  return /^0x[a-fA-F0-9]{40}$/.test(value);
}

/**
 * Formats a partial ENS name to a full ENS name
 * Uses the configured parent domain (grid.eth by default)
 * @deprecated Use formatFullEnsName from config.ts for new code
 */
export function formatENSName(value: string): string {
  return formatFullEnsName(value);
}

function normalizeAcceptedAssets(
  acceptedAssets: AcceptedAssetPreference[] | undefined,
  fallbackDefaultToken: BumpTokenValue,
): AcceptedAssetPreference[] {
  const source =
    acceptedAssets && acceptedAssets.length > 0
      ? acceptedAssets
      : [
          {
            chainId: CHAIN_ID,
            token: fallbackDefaultToken,
            priority: 0,
          },
        ];

  return source
    .map((asset, index) => ({
      chainId:
        Number.isFinite(asset.chainId) && asset.chainId > 0 ? asset.chainId : CHAIN_ID,
      token:
        asset.token === "NATIVE"
          ? "NATIVE"
          : isAddressLike(asset.token)
            ? asset.token
            : fallbackDefaultToken,
      priority: Number.isFinite(asset.priority) ? asset.priority : index,
    }))
    .sort((left, right) => left.priority - right.priority)
    .map((asset, index) => ({
      ...asset,
      priority: index,
    }));
}

export function normalizeBumpEnsProfile(
  profile: Partial<BumpEnsProfile> | BumpEnsProfile,
): BumpEnsProfile {
  const normalizedEnsName = formatENSName(profile.ensName ?? "");
  const requestedDefaultToken = profile.defaultAsset?.token;
  let defaultToken: BumpTokenValue = TOKEN_ADDRESS;

  if (requestedDefaultToken === "NATIVE") {
    defaultToken = "NATIVE";
  } else if (isAddressLike(requestedDefaultToken ?? "")) {
    defaultToken = requestedDefaultToken as Address;
  }
  const acceptedAssets = normalizeAcceptedAssets(profile.acceptedAssets, defaultToken);
  const defaultAsset = profile.defaultAsset
    ? {
        chainId:
          Number.isFinite(profile.defaultAsset.chainId) && profile.defaultAsset.chainId > 0
            ? profile.defaultAsset.chainId
            : acceptedAssets[0]?.chainId ?? CHAIN_ID,
        token:
          profile.defaultAsset.token === "NATIVE"
            ? "NATIVE"
            : isAddressLike(profile.defaultAsset.token)
              ? profile.defaultAsset.token
              : acceptedAssets[0]?.token ?? TOKEN_ADDRESS,
      }
    : acceptedAssets[0]
      ? {
          chainId: acceptedAssets[0].chainId,
          token: acceptedAssets[0].token,
        }
      : undefined;

  return {
    ensName: normalizedEnsName,
    mode: BUMP_MODE_OPTIONS.includes(profile.mode ?? "p2p")
      ? (profile.mode as BumpMode)
      : "p2p",
    profileVersion: "1",
    defaultAsset,
    acceptedAssets,
  };
}

export function buildBumpTextRecordUpdates(
  profile: Partial<BumpEnsProfile> | BumpEnsProfile,
): BumpTextRecordUpdate[] {
  const normalized = normalizeBumpEnsProfile(profile);

  return [
    {
      key: BUMP_PROFILE_VERSION_KEY,
      value: normalized.profileVersion,
    },
    {
      key: BUMP_MODE_KEY,
      value: normalized.mode,
    },
    {
      key: BUMP_DEFAULT_CHAIN_KEY,
      value: normalized.defaultAsset ? String(normalized.defaultAsset.chainId) : "",
    },
    {
      key: BUMP_DEFAULT_TOKEN_KEY,
      value: normalized.defaultAsset?.token ?? "",
    },
  ];
}

export function buildPreparedTextRecordUpdates(
  profile: Partial<BumpEnsProfile> | BumpEnsProfile,
): PreparedBumpTextRecordUpdates {
  const normalized = normalizeBumpEnsProfile(profile);
  const records = buildBumpTextRecordUpdates(normalized);

  return {
    ensName: normalized.ensName,
    records,
    recordMap: Object.fromEntries(records.map((record) => [record.key, record.value])),
  };
}

export function prepareTextRecordUpdate(key: string, value: string): BumpTextRecordUpdate {
  return { key, value };
}

export function prepareBatchTextRecordUpdates(
  profile: Partial<BumpEnsProfile> | BumpEnsProfile,
): BumpTextRecordUpdate[] {
  return buildBumpTextRecordUpdates(profile);
}

export function getBumpProfilePreviewLines(profile: Partial<BumpEnsProfile> | BumpEnsProfile) {
  return buildPreparedTextRecordUpdates(profile).records.map(
    (record) => `${record.key}=${record.value}`,
  );
}

export function getAcceptedAssetSummary(profile: Partial<BumpEnsProfile> | BumpEnsProfile) {
  const normalized = normalizeBumpEnsProfile(profile);

  return normalized.acceptedAssets.map((asset) => ({
    ...asset,
    label: `${asset.chainId} · ${asset.token === "NATIVE" ? "NATIVE" : TOKEN_SYMBOL}`,
  }));
}
