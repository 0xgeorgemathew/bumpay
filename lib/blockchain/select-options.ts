import type { Address } from "viem";
import { TOKEN_ADDRESS, USDT_ADDRESS, CHAIN_ID, CHAIN_NAME } from "./contracts";
import { COLORS } from "../../constants/theme";

export interface SelectOption {
  value: string;
  label: string;
  subtitle: string;
  color: string;
  tokenSymbol: string;
}

export const TOKEN_OPTIONS: SelectOption[] = [
  {
    value: "NATIVE",
    label: "ETH",
    subtitle: "Ethereum",
    color: "#627EEA",
    tokenSymbol: "NATIVE",
  },
  {
    value: TOKEN_ADDRESS,
    label: "USDC",
    subtitle: "USD Coin",
    color: COLORS.primaryBlue,
    tokenSymbol: "USDC",
  },
  {
    value: USDT_ADDRESS,
    label: "USDT",
    subtitle: "Tether USD",
    color: COLORS.green400,
    tokenSymbol: "USDT",
  },
];

export const CHAIN_OPTIONS: SelectOption[] = [
  {
    value: String(CHAIN_ID),
    label: CHAIN_NAME,
    subtitle: "Testnet",
    color: COLORS.primaryBlue,
    tokenSymbol: "BASE",
  },
];

export function findTokenOption(value: string): SelectOption | undefined {
  return TOKEN_OPTIONS.find((opt) =>
    opt.value.toLowerCase() === value.toLowerCase()
  );
}

export function findChainOption(value: string): SelectOption | undefined {
  return CHAIN_OPTIONS.find((opt) => opt.value === value);
}
