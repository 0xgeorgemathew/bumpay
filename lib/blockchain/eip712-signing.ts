/**
 * EIP-712 typed data configuration for NFC Payment Verifier
 *
 * This module defines the domain separator and type structures for
 * signing payment authorizations that can be verified onchain.
 */

import type { Address, Hex, TypedDataDomain } from "viem";
import { VERIFIER_ADDRESS, CHAIN_ID } from "./contracts";

/**
 * EIP-712 domain for NFC Payment Verifier
 * Must match the contract's EIP712 constructor parameters
 */
export const EIP712_DOMAIN: TypedDataDomain = {
  name: "NFC Payment Verifier",
  version: "1",
  chainId: CHAIN_ID,
  verifyingContract: VERIFIER_ADDRESS,
};

/**
 * Type definition for PaymentAuthorization struct
 * Must match the contract's PAYMENT_TYPEHASH
 *
 * IMPORTANT: The `token` field is included in the typehash for replay protection.
 * This ensures a signature for USDC cannot be used for USDT.
 */
export const PAYMENT_AUTHORIZATION_TYPES = {
  PaymentAuthorization: [
    { name: "token", type: "address" },
    { name: "merchant", type: "address" },
    { name: "customer", type: "address" },
    { name: "amount", type: "uint256" },
    { name: "nonce", type: "uint256" },
    { name: "deadline", type: "uint256" },
  ],
} as const;

/**
 * Payment authorization data structure
 */
export interface PaymentAuthorization {
  token: Address;
  merchant: Address;
  customer: Address;
  amount: bigint;
  nonce: bigint;
  deadline: bigint;
}

/**
 * Generate a unique nonce for payment authorization
 * Uses timestamp + random component to ensure uniqueness
 */
export function generatePaymentNonce(): bigint {
  const timestamp = BigInt(Math.floor(Date.now() / 1000));
  const random = BigInt(Math.floor(Math.random() * 1000000));
  return (timestamp << 20n) | random;
}

/**
 * Calculate default deadline (5 minutes from now)
 */
export function getDefaultDeadline(): bigint {
  return BigInt(Math.floor(Date.now() / 1000) + 300); // 5 minutes
}

/**
 * Create typed data for signing a payment authorization
 */
export function createPaymentAuthorizationTypedData(
  authorization: PaymentAuthorization,
): {
  domain: TypedDataDomain;
  types: typeof PAYMENT_AUTHORIZATION_TYPES;
  primaryType: "PaymentAuthorization";
  message: PaymentAuthorization;
} {
  return {
    domain: EIP712_DOMAIN,
    types: PAYMENT_AUTHORIZATION_TYPES,
    primaryType: "PaymentAuthorization",
    message: authorization,
  };
}

/**
 * Validate that the typed data matches expected format
 */
export function validatePaymentAuthorization(auth: PaymentAuthorization): boolean {
  // Check token address is valid
  if (!auth.token || !/^0x[a-fA-F0-9]{40}$/.test(auth.token)) {
    return false;
  }
  // Check addresses are valid
  if (!auth.merchant || !/^0x[a-fA-F0-9]{40}$/.test(auth.merchant)) {
    return false;
  }
  if (!auth.customer || !/^0x[a-fA-F0-9]{40}$/.test(auth.customer)) {
    return false;
  }

  // Check amount is positive
  if (auth.amount <= 0n) {
    return false;
  }

  // Check nonce is positive
  if (auth.nonce < 0n) {
    return false;
  }

  // Check deadline is in the future
  const now = BigInt(Math.floor(Date.now() / 1000));
  if (auth.deadline <= now) {
    return false;
  }

  return true;
}
