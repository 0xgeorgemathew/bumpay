/**
 * Blockchain contract configuration for NFC payments
 *
 * Token and faucet addresses are external contracts managed outside this project.
 * Payment verifier uses deployedContracts from the contracts package.
 */

import type { Address } from "viem";

export const CHAIN_ID = 84532 as const;

export const USDC_ADDRESS: Address = "0xba50Cd2A20f6DA35D788639E581bca8d0B5d4D5f";
export const TOKEN_ADDRESS: Address = "0xba50Cd2A20f6DA35D788639E581bca8d0B5d4D5f";
export const USDT_ADDRESS: Address = "0x0a215D8ba66387DCA84B284D18c3B4ec3de6E54a";

export interface TokenConfig {
  address: Address;
  symbol: string;
  name: string;
  decimals: number;
}

export const TOKENS: Record<string, TokenConfig> = {
  USDC: {
    address: USDC_ADDRESS,
    symbol: "USDC",
    name: "USD Coin",
    decimals: 6,
  },
  USDT: {
    address: USDT_ADDRESS,
    symbol: "USDT",
    name: "Tether USD",
    decimals: 6,
  },
};

export const SUPPORTED_PAYMENT_TOKEN_ADDRESSES = Object.values(TOKENS).map(
  (token) => token.address,
);

export function getTokenConfigByAddress(address?: string | null): TokenConfig | null {
  if (!address) {
    return null;
  }

  const normalized = address.toLowerCase();

  return (
    Object.values(TOKENS).find((token) => token.address.toLowerCase() === normalized) ?? null
  );
}

export function getTokenSymbolByAddress(address?: string | null, fallback = "TOKEN") {
  return getTokenConfigByAddress(address)?.symbol ?? fallback;
}

export function isSupportedPaymentToken(address?: string | null): address is Address {
  if (!address) {
    return false;
  }

  const normalized = address.toLowerCase();
  return SUPPORTED_PAYMENT_TOKEN_ADDRESSES.some(
    (tokenAddress) => tokenAddress.toLowerCase() === normalized,
  );
}

export const TOKEN_ABI = [
  {
    type: "event",
    name: "Transfer",
    inputs: [
      { name: "from", type: "address", indexed: true, internalType: "address" },
      { name: "to", type: "address", indexed: true, internalType: "address" },
      { name: "value", type: "uint256", indexed: false, internalType: "uint256" },
    ],
    anonymous: false,
  },
  {
    type: "function",
    name: "balanceOf",
    inputs: [{ name: "account", type: "address", internalType: "address" }],
    outputs: [{ name: "", type: "uint256", internalType: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "transfer",
    inputs: [
      { name: "to", type: "address", internalType: "address" },
      { name: "amount", type: "uint256", internalType: "uint256" },
    ],
    outputs: [{ name: "", type: "bool", internalType: "bool" }],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "decimals",
    inputs: [],
    outputs: [{ name: "", type: "uint8", internalType: "uint8" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "symbol",
    inputs: [],
    outputs: [{ name: "", type: "string", internalType: "string" }],
    stateMutability: "view",
  },
] as const;

// Token configuration
export const TOKEN_DECIMALS = 6;
export const TOKEN_SYMBOL = "USDC";
export const TOKEN_NAME = "USD Coin";

// Chain configuration for display
export const CHAIN_NAME = "Base Sepolia";

/**
 * Check if an address has the correct format
 */
export function isValidAddress(address: unknown): address is `0x${string}` {
  return typeof address === "string" && /^0x[a-fA-F0-9]{40}$/.test(address);
}
