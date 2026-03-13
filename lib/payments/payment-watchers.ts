import {
  TransactionReceiptNotFoundError,
  decodeEventLog,
  type Hex,
  type TransactionReceipt,
} from "viem";
import { CHAIN_ID, TOKEN_ABI } from "../blockchain/contracts";
import { getPaymentTrackingClient } from "./payment-tracking-client";
import type {
  ConfirmedPaymentDetails,
  PaymentTrackingStatus,
  TrackedPaymentIntent,
} from "./payment-tracking-types";

const DEFAULT_TIMEOUT_MS = 120_000;

interface WatchCallbacks {
  onConfirmed: (details: ConfirmedPaymentDetails) => void;
  onFailed: (
    status: Extract<PaymentTrackingStatus, "failed" | "connection_lost">,
    message: string,
  ) => void;
  timeoutMs?: number;
}

function buildConfirmedPaymentDetails(
  intent: TrackedPaymentIntent,
  txHash: Hex,
  receipt: TransactionReceipt,
): ConfirmedPaymentDetails {
  return {
    ...intent,
    txHash,
    blockNumber: receipt.blockNumber,
  };
}

function receiptHasExpectedTransfer(
  receipt: TransactionReceipt,
  intent: TrackedPaymentIntent,
): boolean {
  return receipt.logs.some((log) => {
    if (!log.address || log.address.toLowerCase() !== intent.tokenAddress.toLowerCase()) {
      return false;
    }

    try {
      const parsed = decodeEventLog({
        abi: TOKEN_ABI,
        data: log.data,
        topics: log.topics,
      });

      if (parsed.eventName !== "Transfer") {
        return false;
      }

      const args = parsed.args as {
        from?: `0x${string}`;
        to?: `0x${string}`;
        value?: bigint;
      };

      return (
        args.from?.toLowerCase() === intent.from.toLowerCase() &&
        args.to?.toLowerCase() === intent.to.toLowerCase() &&
        args.value === intent.amount
      );
    } catch {
      return false;
    }
  });
}

async function fetchReceipt(hash: Hex) {
  return getPaymentTrackingClient().getTransactionReceipt({ hash });
}

export function watchSubmittedPayment(
  intent: TrackedPaymentIntent,
  txHash: Hex,
  callbacks: WatchCallbacks,
) {
  const client = getPaymentTrackingClient();
  let active = true;
  let stopBlockWatch: (() => void) | undefined;
  let stopTransferWatch: (() => void) | undefined;

  const timeout = setTimeout(() => {
    if (!active) {
      return;
    }

    active = false;
    stopBlockWatch?.();
    stopTransferWatch?.();
    callbacks.onFailed("failed", "Confirmation timed out");
  }, callbacks.timeoutMs ?? DEFAULT_TIMEOUT_MS);

  const fail = (
    status: Extract<PaymentTrackingStatus, "failed" | "connection_lost">,
    message: string,
  ) => {
    if (!active) {
      return;
    }

    active = false;
    clearTimeout(timeout);
    stopBlockWatch?.();
    stopTransferWatch?.();
    callbacks.onFailed(status, message);
  };

  const confirm = (receipt: TransactionReceipt, confirmedHash: Hex) => {
    if (!active) {
      return;
    }

    active = false;
    clearTimeout(timeout);
    stopBlockWatch?.();
    stopTransferWatch?.();
    callbacks.onConfirmed(buildConfirmedPaymentDetails(intent, confirmedHash, receipt));
  };

  stopBlockWatch = client.watchBlockNumber({
    onBlockNumber: async () => {
      try {
        const receipt = await fetchReceipt(txHash);
        if (receipt.status !== "success") {
          fail("failed", "Transaction reverted");
          return;
        }

        if (!receiptHasExpectedTransfer(receipt, intent)) {
          return;
        }

        confirm(receipt, txHash);
      } catch (error) {
        if (error instanceof TransactionReceiptNotFoundError) {
          return;
        }

        const message =
          error instanceof Error ? error.message : "WebSocket confirmation failed";
        fail("connection_lost", message);
      }
    },
    onError: (error) => {
      fail("connection_lost", error.message);
    },
  });

  stopTransferWatch = client.watchContractEvent({
    address: intent.tokenAddress,
    abi: TOKEN_ABI,
    eventName: "Transfer",
    args: {
      from: intent.from,
      to: intent.to,
    },
    strict: true,
    onLogs: async (logs) => {
      const typedLogs = logs as Array<{ transactionHash: Hex }>;
      const match = typedLogs.at(0);
      if (!active || !match?.transactionHash) {
        return;
      }

      try {
        const receipt = await fetchReceipt(match.transactionHash);
        if (receipt.status !== "success") {
          fail("failed", "Matched transaction reverted");
          return;
        }

        confirm(receipt, match.transactionHash);
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Failed to read matched transfer receipt";
        fail("connection_lost", message);
      }
    },
    onError: (error) => {
      fail("connection_lost", error.message);
    },
  });

  return () => {
    if (!active) {
      return;
    }

    active = false;
    clearTimeout(timeout);
    stopBlockWatch?.();
    stopTransferWatch?.();
  };
}

export async function watchIncomingPayment(
  intent: TrackedPaymentIntent,
  callbacks: WatchCallbacks,
) {
  const client = getPaymentTrackingClient();
  let active = true;
  const startBlock = await client.getBlockNumber();
  const fromBlock = startBlock > 0n ? startBlock - 1n : startBlock;

  const timeout = setTimeout(() => {
    if (!active) {
      return;
    }

    active = false;
    clearTimeout(timeout);
    unwatch();
    callbacks.onFailed("failed", "No matching transfer was detected");
  }, callbacks.timeoutMs ?? DEFAULT_TIMEOUT_MS);

  const fail = (
    status: Extract<PaymentTrackingStatus, "failed" | "connection_lost">,
    message: string,
  ) => {
    if (!active) {
      return;
    }

    active = false;
    clearTimeout(timeout);
    unwatch();
    callbacks.onFailed(status, message);
  };

  const unwatch = client.watchContractEvent({
    address: intent.tokenAddress,
    abi: TOKEN_ABI,
    eventName: "Transfer",
    args: {
      from: intent.from,
      to: intent.to,
    },
    fromBlock,
    strict: true,
    onLogs: async (logs) => {
      // Cast logs to include transactionHash - viem's strict mode types are too narrow
      const typedLogs = logs as Array<{ transactionHash: Hex }>;
      const match = typedLogs.at(0);
      if (!active || !match) {
        return;
      }

      const txHash = match.transactionHash;
      if (!txHash) {
        return;
      }

      try {
        const receipt = await fetchReceipt(txHash);
        if (receipt.status !== "success") {
          fail("failed", "Matched transaction reverted");
          return;
        }

        active = false;
        clearTimeout(timeout);
        unwatch();
        callbacks.onConfirmed(
          buildConfirmedPaymentDetails(intent, txHash, receipt),
        );
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Failed to read transfer receipt";
        fail("connection_lost", message);
      }
    },
    onError: (error) => {
      fail("connection_lost", error.message);
    },
  });

  return () => {
    if (!active) {
      return;
    }

    active = false;
    clearTimeout(timeout);
    unwatch();
  };
}

export function isPaymentTrackingChainSupported(chainId: number) {
  return chainId === CHAIN_ID;
}
