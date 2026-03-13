/**
 * Faucet minting functionality
 *
 * External faucet contract allows minting USDC tokens for testing.
 * Faucet uses mint(token, to, amount) signature.
 */

import { TOKEN_DECIMALS } from "./contracts";
import { FAUCET_ADDRESS, FAUCET_ABI } from "./external-contracts";

export function toTokenUnits(amount: number): bigint {
  return BigInt(Math.floor(amount * Math.pow(10, TOKEN_DECIMALS)));
}

export function fromTokenUnits(baseUnits: bigint): number {
  return Number(baseUnits) / Math.pow(10, TOKEN_DECIMALS);
}

export const DEFAULT_MINT_AMOUNT = toTokenUnits(69);

export { FAUCET_ADDRESS, FAUCET_ABI };
