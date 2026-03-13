/**
 * Mock USDC transfer functionality
 *
 * Provides helpers for direct token transfers when needed outside
 * the NFC claim flow.
 */

import { TOKEN_ADDRESS } from "./contracts";

export interface TransferParams {
  to: `0x${string}`;
  amount: bigint;
}

/**
 * Build transfer transaction parameters.
 */
export function buildTransferTransaction(
  recipient: `0x${string}`,
  amount: bigint,
) {
  return {
    to: TOKEN_ADDRESS,
    _functionName: "transfer",
    _args: [recipient, amount],
    value: "0x0",
  };
}

/**
 * Get normalized transfer params for wallet helpers.
 */
export function getTransferParams(
  recipient: `0x${string}`,
  amount: bigint,
): TransferParams {
  return {
    to: recipient,
    amount,
  };
}
