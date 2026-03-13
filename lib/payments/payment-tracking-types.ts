import type { Address, Hex } from "viem";
import { CHAIN_NAME, TOKEN_SYMBOL } from "../blockchain/contracts";

export type PaymentTrackingStatus =
  | "idle"
  | "waiting_for_tap"
  | "broadcasting"
  | "watching_chain"
  | "confirmed"
  | "failed"
  | "connection_lost";

export interface TrackedPaymentIntent {
  sessionId: string;
  requestId: string;
  from: Address;
  to: Address;
  amount: bigint;
  tokenAddress: Address;
  chainId: number;
  createdAt: number;
}

export interface ConfirmedPaymentDetails extends TrackedPaymentIntent {
  txHash: Hex;
  blockNumber: bigint;
}

export function formatPaymentAmount(amount: bigint) {
  return Number(amount) / 1e6;
}

export function buildPaymentExplorerUrl(txHash: Hex) {
  return `https://sepolia.basescan.org/tx/${txHash}`;
}

export function buildSuccessRouteParams(
  details: ConfirmedPaymentDetails,
  role: "payer" | "receiver",
) {
  return {
    role,
    sessionId: details.sessionId,
    requestId: details.requestId,
    from: details.from,
    to: details.to,
    amount: details.amount.toString(),
    tokenAddress: details.tokenAddress,
    tokenSymbol: TOKEN_SYMBOL,
    chainId: details.chainId.toString(),
    chainName: CHAIN_NAME,
    txHash: details.txHash,
    blockNumber: details.blockNumber.toString(),
    explorerUrl: buildPaymentExplorerUrl(details.txHash),
  };
}
