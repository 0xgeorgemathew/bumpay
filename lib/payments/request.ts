import type { Address } from "viem";

export interface PaymentAmountHint {
  assetSymbol: string;
  amount: string;
  decimals: number;
}

/**
 * P2P payment request for NFC transport
 * Only carries ENS name and amount - all other data resolved from ENS
 */
export interface P2PPaymentRequest {
  requestId: string;
  /** ENS name (required for P2P) - e.g., "alice.bump.eth" */
  ensName: string;
  /** Optional amount hint for the payment */
  amountHint?: PaymentAmountHint;
  /** Protocol version for future compatibility */
  profileVersion?: string;
}

/**
 * Legacy payment request format (deprecated for P2P)
 * Used for address-based payments or backwards compatibility
 */
export interface LegacyPaymentRequest {
  requestId: string;
  recipientAddress: Address;
  ensName?: string;
  displayName?: string;
  amountHint?: PaymentAmountHint;
  preferredChains?: number[];
  preferredTokens?: Address[];
  profileVersion?: string;
  mode?: "p2p" | "merchant" | "both";
}

/**
 * Payment request union type
 * P2P flow uses ensName (required), legacy flow uses recipientAddress
 */
export type PaymentRequest = P2PPaymentRequest | LegacyPaymentRequest;

/**
 * Type guard to check if a request is P2P format (ENS-based)
 */
export function isP2PRequest(request: PaymentRequest): request is P2PPaymentRequest {
  return "ensName" in request && typeof request.ensName === "string" && request.ensName.length > 0;
}

/**
 * Type guard to check if a request is legacy format (address-based)
 */
export function isLegacyPaymentRequest(
  request: PaymentRequest,
): request is LegacyPaymentRequest {
  return "recipientAddress" in request && typeof request.recipientAddress === "string";
}

/**
 * Get ENS name from either request format
 */
export function getEnsName(request: PaymentRequest): string | undefined {
  if (isP2PRequest(request)) {
    return request.ensName;
  }
  return request.ensName;
}

/**
 * Get recipient address from either request format
 * Returns undefined for P2P requests (must be resolved from ENS)
 */
export function getRecipientAddress(request: PaymentRequest): Address | undefined {
  if (isLegacyPaymentRequest(request)) {
    return request.recipientAddress;
  }
  return undefined;
}

export function generatePaymentRequestId(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);

  return Array.from(bytes)
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}
