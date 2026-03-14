/**
 * NFC Payment Verifier contract interaction helpers
 *
 * Provides functions for checking nonces, encoding calldata,
 * and interacting with the verifier contract.
 */

import type { Address, Hex } from "viem";
import { encodeFunctionData, keccak256, toHex } from "viem";
import { VERIFIER_ADDRESS, VERIFIER_ABI } from "./contracts";

/**
 * Check if a nonce has been used for a customer
 * Encodes the usedNonces(address,uint256) call
 */
export function encodeUsedNoncesCall(customer: Address, nonce: bigint): Hex {
  return encodeFunctionData({
    abi: VERIFIER_ABI,
    functionName: "usedNonces",
    args: [customer, nonce],
  });
}

/**
 * Encode claimPayment calldata
 */
export function encodeClaimPaymentCall(
  token: Address,
  merchant: Address,
  customer: Address,
  amount: bigint,
  nonce: bigint,
  deadline: bigint,
  signature: Hex,
): Hex {
  return encodeFunctionData({
    abi: VERIFIER_ABI,
    functionName: "claimPayment",
    args: [token, merchant, customer, amount, nonce, deadline, signature],
  });
}

/**
 * Encode hashPaymentAuthorization calldata
 */
export function encodeHashPaymentAuthorizationCall(
  token: Address,
  merchant: Address,
  customer: Address,
  amount: bigint,
  nonce: bigint,
  deadline: bigint,
): Hex {
  return encodeFunctionData({
    abi: VERIFIER_ABI,
    functionName: "hashPaymentAuthorization",
    args: [token, merchant, customer, amount, nonce, deadline],
  });
}

/**
 * Payment claim parameters
 */
export interface PaymentClaimParams {
  token: Address;
  merchant: Address;
  customer: Address;
  amount: bigint;
  nonce: bigint;
  deadline: bigint;
  signature: Hex;
}

/**
 * Create full claimPayment transaction data
 */
export function createClaimPaymentTransaction(params: PaymentClaimParams): {
  to: Address;
  data: Hex;
} {
  return {
    to: VERIFIER_ADDRESS,
    data: encodeClaimPaymentCall(
      params.token,
      params.merchant,
      params.customer,
      params.amount,
      params.nonce,
      params.deadline,
      params.signature,
    ),
  };
}

/**
 * Calculate a deterministic nonce from session ID
 * This ensures the same session always generates the same nonce
 */
export function nonceFromSessionId(sessionId: string): bigint {
  const hash = keccak256(toHex(sessionId));
  return BigInt(hash) >> 128n; // Use upper 128 bits for smaller nonce
}

/**
 * Verifier contract error selectors for decoding
 */
export const VERIFIER_ERRORS = {
  InvalidSignature: "0x8baa579f" as const,
  SignatureExpired: "0x1f746f04" as const,
  NonceAlreadyUsed: "0x0a20ee33" as const,
  TransferFailed: "0x90b8ec18" as const,
  TokenNotSupported: "0x5e5c8c61" as const, // keccak256("TokenNotSupported()")[:4]
} as const;

/**
 * Check if revert data matches a known error
 */
export function parseVerifierError(revertData: Hex): string | null {
  if (revertData.length < 10) return null;

  const selector = revertData.slice(0, 10) as Hex;

  switch (selector) {
    case VERIFIER_ERRORS.InvalidSignature:
      return "Invalid signature";
    case VERIFIER_ERRORS.SignatureExpired:
      return "Signature has expired";
    case VERIFIER_ERRORS.NonceAlreadyUsed:
      return "Nonce has already been used";
    case VERIFIER_ERRORS.TransferFailed:
      return "Token transfer failed";
    case VERIFIER_ERRORS.TokenNotSupported:
      return "Token is not supported";
    default:
      return `Unknown error: ${selector}`;
  }
}

export { VERIFIER_ADDRESS, VERIFIER_ABI };
