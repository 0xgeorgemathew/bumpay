import type { Address, Hex } from "viem";
import type { PaymentRequest, P2PPaymentRequest, LegacyPaymentRequest, PaymentAmountHint } from "../payments/request";

export const PROTOCOL_VERSION = 1;

export type MessageKind =
  | "GET_PAYMENT_REQUEST"
  | "PAYMENT_REQUEST"
  | "PAYMENT_INTENT"
  | "MERCHANT_PAYMENT_REQUEST"
  | "MERCHANT_BITGO_PAYMENT_REQUEST"
  | "MERCHANT_PAYMENT_AUTHORIZATION"
  | "ERROR";

type ShortMessageKind = "Q" | "R" | "I" | "M" | "B" | "A" | "E";

interface ProtocolEnvelope {
  version: number;
  sessionId: string;
}

/**
 * Published payment request with session ID
 * Supports both P2P (ENS-based) and legacy (address-based) formats
 */
export type PublishedPaymentRequest = (P2PPaymentRequest | LegacyPaymentRequest) & {
  sessionId: string;
};

export interface PaymentIntent {
  sessionId: string;
  requestId: string;
  payerAddress: Address;
  receiverAddress: Address;
  amount: string;
  tokenAddress: Address;
  chainId: number;
  createdAt: number;
  txHash?: Hex;
}

export type GetPaymentRequestMessage = ProtocolEnvelope & {
  kind: "GET_PAYMENT_REQUEST";
};

/**
 * Payment request message for NFC transport
 * For P2P: only ensName + amountHint are required
 * For legacy: recipientAddress is required
 */
export type PaymentRequestMessage = ProtocolEnvelope & {
  kind: "PAYMENT_REQUEST";
  requestId: string;
  /** P2P: ENS name (required) */
  ensName?: string;
  /** Legacy: recipient address (required if no ensName) */
  recipientAddress?: Address;
  displayName?: string;
  amountHint?: PaymentAmountHint;
  /** Legacy only: preferred chains (deprecated for P2P) */
  preferredChains?: number[];
  /** Legacy only: preferred tokens (deprecated for P2P) */
  preferredTokens?: Address[];
  profileVersion?: string;
  mode?: "p2p" | "merchant" | "both";
};

export type PaymentIntentMessage = ProtocolEnvelope & {
  kind: "PAYMENT_INTENT";
} & Omit<PaymentIntent, "sessionId">;

/**
 * Merchant payment request message
 * Sent from merchant (POS) to customer during NFC tap
 */
export type MerchantPaymentRequestMessage = ProtocolEnvelope & {
  kind: "MERCHANT_PAYMENT_REQUEST";
  requestId: string;
  /** Merchant's wallet address (receives payment) */
  merchantAddress: Address;
  /** Payment amount in token smallest unit */
  amount: string;
  /** Token contract address */
  tokenAddress: Address;
  /** Chain ID for the payment */
  chainId: number;
  /** Verifier contract that will validate and claim the payment */
  verifyingContract: Address;
  /** Unix timestamp when authorization expires */
  deadline: number;
  /** Unique nonce for this authorization */
  nonce: string;
  /** Optional merchant display name */
  merchantName?: string;
};

/**
 * BitGo-backed merchant payment request message.
 * Sent from merchant to customer so the customer can pay a fresh BitGo address.
 */
export type MerchantBitGoPaymentRequestMessage = ProtocolEnvelope & {
  kind: "MERCHANT_BITGO_PAYMENT_REQUEST";
  checkoutId: string;
  requestId: string;
  receiveAddress: Address;
  amount: string;
  tokenSymbol: string;
  tokenAddress: Address;
  chainId: number;
  expiresAt: number;
  merchantName?: string;
  rail: "bitgo";
};

/**
 * Merchant payment authorization message
 * Sent from customer to merchant (POS) after signing
 */
export type MerchantPaymentAuthorizationMessage = ProtocolEnvelope & {
  kind: "MERCHANT_PAYMENT_AUTHORIZATION";
  requestId: string;
  /** Customer's wallet address (smart wallet) */
  customerAddress: Address;
  /** EIP-712 signature for claimPayment() */
  signature: Hex;
};

export type ErrorMessage = ProtocolEnvelope & {
  kind: "ERROR";
  message: string;
  code?: string;
};

export type ProtocolMessage =
  | GetPaymentRequestMessage
  | PaymentRequestMessage
  | PaymentIntentMessage
  | MerchantPaymentRequestMessage
  | MerchantBitGoPaymentRequestMessage
  | MerchantPaymentAuthorizationMessage
  | ErrorMessage;

const SHORT_KIND_BY_KIND: Record<MessageKind, ShortMessageKind> = {
  GET_PAYMENT_REQUEST: "Q",
  PAYMENT_REQUEST: "R",
  PAYMENT_INTENT: "I",
  MERCHANT_PAYMENT_REQUEST: "M",
  MERCHANT_BITGO_PAYMENT_REQUEST: "B",
  MERCHANT_PAYMENT_AUTHORIZATION: "A",
  ERROR: "E",
};

function decodeMessageKind(value: unknown): MessageKind | null {
  switch (value) {
    case "Q":
    case "GET_PAYMENT_REQUEST":
      return "GET_PAYMENT_REQUEST";
    case "R":
    case "PAYMENT_REQUEST":
      return "PAYMENT_REQUEST";
    case "I":
    case "PAYMENT_INTENT":
      return "PAYMENT_INTENT";
    case "M":
    case "MERCHANT_PAYMENT_REQUEST":
      return "MERCHANT_PAYMENT_REQUEST";
    case "B":
    case "MERCHANT_BITGO_PAYMENT_REQUEST":
      return "MERCHANT_BITGO_PAYMENT_REQUEST";
    case "A":
    case "MERCHANT_PAYMENT_AUTHORIZATION":
      return "MERCHANT_PAYMENT_AUTHORIZATION";
    case "E":
    case "ERROR":
      return "ERROR";
    default:
      return null;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function readString(
  record: Record<string, unknown>,
  key: string,
  alias?: string,
): string | null {
  const value = record[key] ?? (alias ? record[alias] : undefined);
  return typeof value === "string" && value.length > 0 ? value : null;
}

function readNumber(
  record: Record<string, unknown>,
  key: string,
  alias?: string,
): number | null {
  const value = record[key] ?? (alias ? record[alias] : undefined);
  return typeof value === "number" ? value : null;
}

function readOptionalString(
  record: Record<string, unknown>,
  key: string,
  alias?: string,
) {
  const value = record[key] ?? (alias ? record[alias] : undefined);
  return typeof value === "string" ? value : undefined;
}

export function serializeProtocolMessage(message: ProtocolMessage): string {
  const shortKind = SHORT_KIND_BY_KIND[message.kind];

  return JSON.stringify({
    ...message,
    version: PROTOCOL_VERSION,
    v: PROTOCOL_VERSION,
    sessionId: message.sessionId,
    s: message.sessionId,
    kind: message.kind,
    k: shortKind,
    ...(message.kind === "ERROR" ? { m: message.message } : null),
  });
}

export function parseProtocolMessage(data: string): ProtocolMessage | null {
  try {
    const parsed = JSON.parse(data) as unknown;
    if (!isRecord(parsed)) {
      return null;
    }

    const version = readNumber(parsed, "version", "v");
    const sessionId = readString(parsed, "sessionId", "s");
    const kind = decodeMessageKind(parsed.kind ?? parsed.k);

    if (version !== PROTOCOL_VERSION || !sessionId || !kind) {
      return null;
    }

    if (kind === "GET_PAYMENT_REQUEST") {
      return { version, sessionId, kind };
    }

    if (kind === "PAYMENT_REQUEST") {
      const requestId = readString(parsed, "requestId");
      const ensName = readString(parsed, "ensName");
      const recipientAddress = readString(parsed, "recipientAddress");

      // P2P format: ensName is required, recipientAddress is optional
      // Legacy format: recipientAddress is required
      if (!requestId || (!ensName && !recipientAddress)) {
        return null;
      }

      return {
        version,
        sessionId,
        kind,
        requestId,
        ensName: ensName ?? undefined,
        recipientAddress: recipientAddress ? (recipientAddress as Address) : undefined,
        displayName: readOptionalString(parsed, "displayName"),
        amountHint: isRecord(parsed.amountHint)
          ? {
              assetSymbol:
                typeof parsed.amountHint.assetSymbol === "string"
                  ? parsed.amountHint.assetSymbol
                  : "",
              amount:
                typeof parsed.amountHint.amount === "string"
                  ? parsed.amountHint.amount
                  : "",
              decimals:
                typeof parsed.amountHint.decimals === "number"
                  ? parsed.amountHint.decimals
                  : 0,
            }
          : undefined,
        // Only include these for legacy format
        preferredChains: Array.isArray(parsed.preferredChains)
          ? parsed.preferredChains.filter(
              (value): value is number => typeof value === "number",
            )
          : undefined,
        preferredTokens: Array.isArray(parsed.preferredTokens)
          ? parsed.preferredTokens.filter(
              (value): value is Address => typeof value === "string",
            )
          : undefined,
        profileVersion: readOptionalString(parsed, "profileVersion"),
        mode:
          parsed.mode === "p2p" || parsed.mode === "merchant" || parsed.mode === "both"
            ? parsed.mode
            : undefined,
      };
    }

    if (kind === "PAYMENT_INTENT") {
      const requestId = readString(parsed, "requestId");
      const payerAddress = readString(parsed, "payerAddress");
      const receiverAddress = readString(parsed, "receiverAddress");
      const amount = readString(parsed, "amount");
      const tokenAddress = readString(parsed, "tokenAddress");
      const chainId = readNumber(parsed, "chainId");
      const createdAt = readNumber(parsed, "createdAt");

      if (
        !requestId ||
        !payerAddress ||
        !receiverAddress ||
        !amount ||
        chainId === null ||
        createdAt === null ||
        !tokenAddress
      ) {
        return null;
      }

      return {
        version,
        sessionId,
        kind,
        requestId,
        payerAddress: payerAddress as Address,
        receiverAddress: receiverAddress as Address,
        amount,
        tokenAddress: tokenAddress as Address,
        chainId,
        createdAt,
        txHash: readOptionalString(parsed, "txHash") as Hex | undefined,
      };
    }

    if (kind === "MERCHANT_PAYMENT_REQUEST") {
      const requestId = readString(parsed, "requestId");
      const merchantAddress = readString(parsed, "merchantAddress");
      const amount = readString(parsed, "amount");
      const tokenAddress = readString(parsed, "tokenAddress");
      const chainId = readNumber(parsed, "chainId");
      const verifyingContract = readString(parsed, "verifyingContract");
      const deadline = readNumber(parsed, "deadline");
      const nonce = readString(parsed, "nonce");

      if (
        !requestId ||
        !merchantAddress ||
        !amount ||
        !tokenAddress ||
        chainId === null ||
        !verifyingContract ||
        deadline === null ||
        !nonce
      ) {
        return null;
      }

      return {
        version,
        sessionId,
        kind,
        requestId,
        merchantAddress: merchantAddress as Address,
        amount,
        tokenAddress: tokenAddress as Address,
        chainId,
        verifyingContract: verifyingContract as Address,
        deadline,
        nonce,
        merchantName: readOptionalString(parsed, "merchantName"),
      };
    }

    if (kind === "MERCHANT_BITGO_PAYMENT_REQUEST") {
      const checkoutId = readString(parsed, "checkoutId");
      const requestId = readString(parsed, "requestId");
      const receiveAddress = readString(parsed, "receiveAddress");
      const amount = readString(parsed, "amount");
      const tokenSymbol = readString(parsed, "tokenSymbol");
      const tokenAddress = readString(parsed, "tokenAddress");
      const chainId = readNumber(parsed, "chainId");
      const expiresAt = readNumber(parsed, "expiresAt");

      if (
        !checkoutId ||
        !requestId ||
        !receiveAddress ||
        !amount ||
        !tokenSymbol ||
        !tokenAddress ||
        chainId === null ||
        expiresAt === null
      ) {
        return null;
      }

      return {
        version,
        sessionId,
        kind,
        checkoutId,
        requestId,
        receiveAddress: receiveAddress as Address,
        amount,
        tokenSymbol,
        tokenAddress: tokenAddress as Address,
        chainId,
        expiresAt,
        merchantName: readOptionalString(parsed, "merchantName"),
        rail: "bitgo",
      };
    }

    if (kind === "MERCHANT_PAYMENT_AUTHORIZATION") {
      const requestId = readString(parsed, "requestId");
      const customerAddress = readString(parsed, "customerAddress");
      const signature = readString(parsed, "signature");

      if (!requestId || !customerAddress || !signature) {
        return null;
      }

      return {
        version,
        sessionId,
        kind,
        requestId,
        customerAddress: customerAddress as Address,
        signature: signature as Hex,
      };
    }

    const message = readString(parsed, "message", "m");
    if (!message) {
      return null;
    }

    return {
      version,
      sessionId,
      kind,
      message,
      code: readOptionalString(parsed, "code"),
    };
  } catch {
    return null;
  }
}
