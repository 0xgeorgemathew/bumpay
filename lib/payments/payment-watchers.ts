import {
  TransactionReceiptNotFoundError,
  decodeEventLog,
  type Hex,
  type TransactionReceipt,
} from "viem";
import { CHAIN_ID, TOKEN_ABI } from "../blockchain/contracts";
import {
  getPaymentTrackingPollingClient,
  getPaymentTrackingRealtimeClient,
} from "./payment-tracking-client";
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
  return getPaymentTrackingPollingClient().getTransactionReceipt({ hash });
}

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

export function watchSubmittedPayment(
  intent: TrackedPaymentIntent,
  txHash: Hex,
  callbacks: WatchCallbacks,
) {
  const realtimeClient = getPaymentTrackingRealtimeClient();
  const pollingClient = getPaymentTrackingPollingClient();
  let active = true;
  let stopBlockWatch: (() => void) | undefined;
  let stopTransferWatch: (() => void) | undefined;
  let isUsingPollingFallback = false;

  const timeout = setTimeout(() => {
    if (!active) {
      return;
    }

    active = false;
    clearTimeout(timeout);
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

  const checkSubmittedReceipt = async () => {
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

      fail("connection_lost", getErrorMessage(error, "Payment confirmation failed"));
    }
  };

  const startPollingFallback = (reason: string) => {
    if (!active || isUsingPollingFallback) {
      return;
    }

    isUsingPollingFallback = true;
    stopBlockWatch?.();
    stopTransferWatch?.();
    stopTransferWatch = undefined;

    stopBlockWatch = pollingClient.watchBlockNumber({
      onBlockNumber: () => {
        checkSubmittedReceipt().catch((error) => {
          fail("connection_lost", getErrorMessage(error, reason));
        });
      },
      onError: (error) => {
        fail(
          "connection_lost",
          `${reason}. ${error.message}`.trim(),
        );
      },
    });

    checkSubmittedReceipt().catch((error) => {
      fail("connection_lost", getErrorMessage(error, reason));
    });
  };

  stopBlockWatch = realtimeClient.watchBlockNumber({
    onBlockNumber: async () => {
      checkSubmittedReceipt().catch((error) => {
        fail("connection_lost", getErrorMessage(error, "WebSocket confirmation failed"));
      });
    },
    onError: (error) => {
      startPollingFallback(error.message);
    },
  });

  stopTransferWatch = realtimeClient.watchContractEvent({
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
        if (error instanceof TransactionReceiptNotFoundError) {
          return;
        }

        startPollingFallback(getErrorMessage(error, "Failed to read matched transfer receipt"));
      }
    },
    onError: (error) => {
      startPollingFallback(error.message);
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
  const realtimeClient = getPaymentTrackingRealtimeClient();
  const pollingClient = getPaymentTrackingPollingClient();
  let active = true;
  let stopTransferWatch: (() => void) | undefined;
  let isUsingPollingFallback = false;
  const startBlock = await pollingClient.getBlockNumber();
  const fromBlock = startBlock > 0n ? startBlock - 1n : startBlock;

  const timeout = setTimeout(() => {
    if (!active) {
      return;
    }

    active = false;
    clearTimeout(timeout);
    stopTransferWatch?.();
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
    stopTransferWatch?.();
    callbacks.onFailed(status, message);
  };

  const handleTransferLogs = async (logs: unknown) => {
    const typedLogs = logs as Array<{ transactionHash: Hex }>;
    const match = typedLogs.at(0);
    if (!active || !match) {
      return;
    }

    const matchedHash = match.transactionHash;
    if (!matchedHash) {
      return;
    }

    try {
      const receipt = await fetchReceipt(matchedHash);
      if (receipt.status !== "success") {
        fail("failed", "Matched transaction reverted");
        return;
      }

      active = false;
      clearTimeout(timeout);
      stopTransferWatch?.();
      callbacks.onConfirmed(
        buildConfirmedPaymentDetails(intent, matchedHash, receipt),
      );
    } catch (error) {
      if (error instanceof TransactionReceiptNotFoundError) {
        return;
      }

      fail("connection_lost", getErrorMessage(error, "Failed to read transfer receipt"));
    }
  };

  const startPollingFallback = (reason: string) => {
    if (!active || isUsingPollingFallback) {
      return;
    }

    isUsingPollingFallback = true;
    stopTransferWatch?.();

    stopTransferWatch = pollingClient.watchContractEvent({
      address: intent.tokenAddress,
      abi: TOKEN_ABI,
      eventName: "Transfer",
      args: {
        from: intent.from,
        to: intent.to,
      },
      fromBlock,
      strict: true,
      onLogs: (logs) => {
        handleTransferLogs(logs).catch((error) => {
          fail("connection_lost", getErrorMessage(error, reason));
        });
      },
      onError: (error) => {
        fail(
          "connection_lost",
          `${reason}. ${error.message}`.trim(),
        );
      },
    });
  };

  stopTransferWatch = realtimeClient.watchContractEvent({
    address: intent.tokenAddress,
    abi: TOKEN_ABI,
    eventName: "Transfer",
    args: {
      from: intent.from,
      to: intent.to,
    },
    fromBlock,
    strict: true,
    onLogs: (logs) => {
      handleTransferLogs(logs).catch((error) => {
        fail("connection_lost", getErrorMessage(error, "Failed to read transfer receipt"));
      });
    },
    onError: (error) => {
      startPollingFallback(error.message);
    },
  });

  return () => {
    if (!active) {
      return;
    }

    active = false;
    clearTimeout(timeout);
    stopTransferWatch?.();
  };
}

export function isPaymentTrackingChainSupported(chainId: number) {
  return chainId === CHAIN_ID;
}
