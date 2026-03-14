/**
 * Merchant session management for NFC tap-to-pay
 *
 * Handles creating payment requests, parsing authorizations,
 * and claiming payments onchain.
 */

import type { Address, Hex } from "viem";
import {
  type MerchantPaymentRequestMessage,
  type MerchantPaymentAuthorizationMessage,
  PROTOCOL_VERSION,
  serializeProtocolMessage,
  parseProtocolMessage,
} from "../nfc/protocol";
import {
  CHAIN_ID,
  TOKEN_ADDRESS,
  VERIFIER_ADDRESS,
} from "../blockchain/contracts";
import type { PaymentAuthorization } from "../blockchain/eip712-signing";
import {
  encodeClaimPaymentCall,
  nonceFromSessionId,
} from "../blockchain/payment-verifier";

export interface MerchantSession {
  sessionId: string;
  requestId: string;
  merchantAddress: Address;
  amount: bigint;
  tokenAddress: Address;
  chainId: number;
  verifyingContract: Address;
  deadline: number;
  nonce: bigint;
  createdAt: number;
  merchantName?: string;
}

export interface ParsedAuthorization {
  sessionId: string;
  requestId: string;
  customerAddress: Address;
  signature: Hex;
}

/**
 * Generate a unique request ID for merchant session
 */
export function generateMerchantRequestId(): string {
  return `merchant_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Create a new merchant session
 */
export function createMerchantSession(
  merchantAddress: Address,
  amount: bigint,
  tokenAddress: Address = TOKEN_ADDRESS,
  deadlineSeconds: number = 300,
  merchantName?: string,
): MerchantSession {
  const requestId = generateMerchantRequestId();
  const sessionId = requestId;
  const nonce = nonceFromSessionId(sessionId);

  return {
    sessionId,
    requestId,
    merchantAddress,
    amount,
    tokenAddress,
    chainId: CHAIN_ID,
    verifyingContract: VERIFIER_ADDRESS,
    deadline: Math.floor(Date.now() / 1000) + deadlineSeconds,
    nonce,
    createdAt: Date.now(),
    merchantName,
  };
}

/**
 * Build the merchant payment request message for NFC transport
 */
export function buildMerchantPaymentRequestMessage(
  session: MerchantSession,
): string {
  const message: MerchantPaymentRequestMessage = {
    version: PROTOCOL_VERSION,
    sessionId: session.sessionId,
    kind: "MERCHANT_PAYMENT_REQUEST",
    requestId: session.requestId,
    merchantAddress: session.merchantAddress,
    amount: session.amount.toString(),
    tokenAddress: session.tokenAddress,
    chainId: session.chainId,
    verifyingContract: session.verifyingContract,
    deadline: session.deadline,
    nonce: session.nonce.toString(),
    merchantName: session.merchantName,
  };

  return serializeProtocolMessage(message);
}

/**
 * Parse a merchant payment request from NFC payload
 */
export function parseMerchantPaymentRequest(
  payload: string,
): MerchantSession | null {
  const message = parseProtocolMessage(payload);
  if (!message || message.kind !== "MERCHANT_PAYMENT_REQUEST") {
    return null;
  }

  return {
    sessionId: message.sessionId,
    requestId: message.requestId,
    merchantAddress: message.merchantAddress,
    amount: BigInt(message.amount),
    tokenAddress: message.tokenAddress,
    chainId: message.chainId,
    verifyingContract: message.verifyingContract,
    deadline: message.deadline,
    nonce: BigInt(message.nonce),
    createdAt: Date.now(),
    merchantName: message.merchantName,
  };
}

/**
 * Build the payment authorization data for EIP-712 signing
 */
export function buildPaymentAuthorization(
  session: MerchantSession,
  customerAddress: Address,
): PaymentAuthorization {
  return {
    token: session.tokenAddress,
    merchant: session.merchantAddress,
    customer: customerAddress,
    amount: session.amount,
    nonce: session.nonce,
    deadline: BigInt(session.deadline),
  };
}

/**
 * Build the merchant payment authorization message for NFC transport
 */
export function buildMerchantAuthorizationMessage(
  sessionId: string,
  requestId: string,
  customerAddress: Address,
  signature: Hex,
): string {
  const message: MerchantPaymentAuthorizationMessage = {
    version: PROTOCOL_VERSION,
    sessionId,
    kind: "MERCHANT_PAYMENT_AUTHORIZATION",
    requestId,
    customerAddress,
    signature,
  };

  return serializeProtocolMessage(message);
}

/**
 * Parse a merchant payment authorization from NFC payload
 */
export function parseMerchantAuthorization(
  payload: string,
): ParsedAuthorization | null {
  const message = parseProtocolMessage(payload);
  if (!message || message.kind !== "MERCHANT_PAYMENT_AUTHORIZATION") {
    return null;
  }

  return {
    sessionId: message.sessionId,
    requestId: message.requestId,
    customerAddress: message.customerAddress,
    signature: message.signature,
  };
}

/**
 * Alias for parseMerchantAuthorization
 * Used by the merchant screen to process incoming authorizations
 */
export const parsePaymentAuthorization = parseMerchantAuthorization;

export function matchesMerchantSession(
  session: MerchantSession,
  authorization: ParsedAuthorization,
): boolean {
  return (
    authorization.sessionId === session.sessionId &&
    authorization.requestId === session.requestId
  );
}

/**
 * Build the claimPayment transaction data
 */
export function buildClaimPaymentTransaction(
  session: MerchantSession,
  authorization: ParsedAuthorization,
): { to: Address; data: Hex } {
  return {
    to: session.verifyingContract,
    data: encodeClaimPaymentCall(
      session.tokenAddress,
      session.merchantAddress,
      authorization.customerAddress,
      session.amount,
      session.nonce,
      BigInt(session.deadline),
      authorization.signature,
    ),
  };
}

/**
 * Check if a session has expired
 */
export function isSessionExpired(session: MerchantSession): boolean {
  return Date.now() / 1000 > session.deadline;
}

/**
 * Get remaining time in seconds
 */
export function getSessionRemainingTime(session: MerchantSession): number {
  return Math.max(0, session.deadline - Math.floor(Date.now() / 1000));
}

/**
 * Validate that the session matches expected parameters
 */
export function validateSession(
  session: MerchantSession,
  expectedMerchant: Address,
  expectedToken?: Address,
): boolean {
  if (session.merchantAddress.toLowerCase() !== expectedMerchant.toLowerCase()) {
    return false;
  }

  if (expectedToken && session.tokenAddress.toLowerCase() !== expectedToken.toLowerCase()) {
    return false;
  }

  if (session.chainId !== CHAIN_ID) {
    return false;
  }

  if (isSessionExpired(session)) {
    return false;
  }

  return true;
}
