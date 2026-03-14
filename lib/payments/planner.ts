import type { Address } from "viem";
import { CHAIN_ID, TOKEN_ADDRESS, isSupportedPaymentToken } from "../blockchain/contracts";
import type { PaymentPolicy } from "./policy";
import type { RecipientProfile, SupportedToken } from "../recipient-profile";

export interface PaymentIntent {
  recipient: Address;
  acceptedChains: number[];
  acceptedTokens: Address[];
  requestedAmount: bigint;
}

export interface ExecutionStep {
  kind: "transfer";
  chainId: number;
  token: SupportedToken;
  to: Address;
  amount: bigint;
}

export interface PaymentPlan {
  kind: "direct";
  targetChainId: number;
  targetToken: SupportedToken;
  targetAmount: bigint;
  recipient: Address;
  steps: ExecutionStep[];
}

export interface DirectFundingState {
  chainId: number;
  tokenBalances: Record<string, bigint>;
  nativeBalance: bigint;
}

export interface PaymentPlanResult {
  intent: PaymentIntent;
  directPlan: PaymentPlan | null;
  reason?: string;
}

export function buildPaymentIntent(
  profile: RecipientProfile,
  requestedAmount: bigint,
): PaymentIntent {
  const acceptedAssets = profile.acceptedAssets.length
    ? profile.acceptedAssets
    : [
        {
          chainId: CHAIN_ID,
          token: TOKEN_ADDRESS,
          priority: 0,
        },
      ];

  return {
    recipient: profile.primaryAddress,
    acceptedChains: acceptedAssets.map((asset) => asset.chainId),
    acceptedTokens: acceptedAssets
      .filter((asset): asset is typeof asset & { token: Address } => asset.token !== "NATIVE")
      .map((asset) => asset.token),
    requestedAmount,
  };
}

function getFundingBalanceForToken(
  tokenBalances: Record<string, bigint>,
  token: Address,
) {
  return tokenBalances[token.toLowerCase()] ?? BigInt(0);
}

export function planPayment({
  profile,
  requestedAmount,
  funding,
  policy,
}: {
  profile: RecipientProfile;
  requestedAmount: bigint;
  funding: DirectFundingState;
  policy: PaymentPolicy;
}): PaymentPlanResult {
  const intent = buildPaymentIntent(profile, requestedAmount);
  const targetToken =
    profile.defaultAsset && profile.defaultAsset.token !== "NATIVE"
      ? profile.defaultAsset.token
      : undefined;
  const matchingAsset = profile.acceptedAssets.find(
    (asset) =>
      asset.chainId === funding.chainId &&
      asset.token !== "NATIVE" &&
      asset.token === targetToken,
  );

  if (!policy.allowedChains.includes(funding.chainId)) {
    return {
      intent,
      directPlan: null,
      reason: "Current chain is not allowed by the payment policy.",
    };
  }

  if (!targetToken || !isSupportedPaymentToken(targetToken)) {
    return {
      intent,
      directPlan: null,
      reason: "Recipient does not have a supported receiving token configured.",
    };
  }

  if (!matchingAsset) {
    return {
      intent,
      directPlan: null,
      reason: "Recipient does not accept the configured token on the current chain.",
    };
  }

  if (getFundingBalanceForToken(funding.tokenBalances, targetToken) < requestedAmount) {
    return {
      intent,
      directPlan: null,
      reason: "Smart wallet does not hold enough of the receiver's preferred token.",
    };
  }

  return {
    intent,
    directPlan: {
      kind: "direct",
      targetChainId: funding.chainId,
      targetToken: targetToken,
      targetAmount: requestedAmount,
      recipient: profile.primaryAddress,
      steps: [
        {
          kind: "transfer",
          chainId: funding.chainId,
          token: targetToken,
          to: profile.primaryAddress,
          amount: requestedAmount,
        },
      ],
    },
  };
}
