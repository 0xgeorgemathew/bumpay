import type { Address, Hex } from "viem";
import { CHAIN_ID, TOKEN_ADDRESS } from "../blockchain/contracts";
import type { PaymentPolicy } from "./policy";
import type { RecipientProfile, SupportedToken } from "../recipient-profile";

export interface PaymentIntent {
  recipient: Address;
  acceptedChains: number[];
  acceptedTokens: Address[];
  requestedAmount: bigint;
}

export interface ExecutionStep {
  kind: "transfer" | "swap" | "bridge" | "borrow" | "composite";
  chainId: number;
  token: SupportedToken;
  to: Address;
  amount: bigint;
  data?: Hex;
}

export interface PaymentPlan {
  kind: "direct" | "swap" | "bridge" | "borrow" | "composite";
  targetChainId: number;
  targetToken: SupportedToken;
  targetAmount: bigint;
  recipient: Address;
  steps: ExecutionStep[];
}

export interface DirectFundingState {
  chainId: number;
  tokenBalance: bigint;
  nativeBalance: bigint;
}

export interface PaymentPlanResult {
  intent: PaymentIntent;
  directPlan: PaymentPlan | null;
  requiresAgent: boolean;
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

  const matchingAsset = profile.acceptedAssets.find(
    (asset) => asset.chainId === funding.chainId && asset.token === TOKEN_ADDRESS,
  );

  if (!policy.allowedChains.includes(funding.chainId)) {
    return {
      intent,
      directPlan: null,
      requiresAgent: true,
      reason: "Current chain is not allowed by the payment policy.",
    };
  }

  if (!matchingAsset) {
    return {
      intent,
      directPlan: null,
      requiresAgent: true,
      reason: "Recipient does not accept the current asset on the current chain.",
    };
  }

  if (funding.tokenBalance < requestedAmount) {
    return {
      intent,
      directPlan: null,
      requiresAgent: true,
      reason: "Smart wallet does not hold enough of the accepted token.",
    };
  }

  return {
    intent,
    requiresAgent: false,
    directPlan: {
      kind: "direct",
      targetChainId: funding.chainId,
      targetToken: TOKEN_ADDRESS,
      targetAmount: requestedAmount,
      recipient: profile.primaryAddress,
      steps: [
        {
          kind: "transfer",
          chainId: funding.chainId,
          token: TOKEN_ADDRESS,
          to: profile.primaryAddress,
          amount: requestedAmount,
        },
      ],
    },
  };
}

