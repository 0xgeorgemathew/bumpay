import * as SecureStore from "expo-secure-store";
import type { DisplayTransaction } from "../transaction-context";

const MAX_TRANSACTIONS = 100;

function getStorageKey(walletAddress: string): string {
  return `bump_transactions_${walletAddress.toLowerCase()}`;
}

export async function loadTransactions(
  walletAddress: string,
): Promise<DisplayTransaction[]> {
  try {
    const key = getStorageKey(walletAddress);
    const data = await SecureStore.getItemAsync(key);
    if (!data) {
      return [];
    }
    const transactions = JSON.parse(data) as DisplayTransaction[];
    return transactions;
  } catch (error) {
    console.warn("Failed to load transactions from storage:", error);
    return [];
  }
}

export async function saveTransactions(
  walletAddress: string,
  transactions: DisplayTransaction[],
): Promise<void> {
  try {
    const key = getStorageKey(walletAddress);
    const existingRaw = await SecureStore.getItemAsync(key);
    const existing = existingRaw ? (JSON.parse(existingRaw) as DisplayTransaction[]) : [];
    const combined = [...transactions, ...existing];

    // Deduplicate by id (txHash)
    const seen = new Set<string>();
    const deduped: DisplayTransaction[] = [];
    for (const tx of combined) {
      if (!seen.has(tx.id)) {
        seen.add(tx.id);
        deduped.push(tx);
      }
    }

    // Limit to last MAX_TRANSACTIONS (newest first)
    const limited = deduped.slice(0, MAX_TRANSACTIONS);

    await SecureStore.setItemAsync(key, JSON.stringify(limited));
  } catch (error) {
    console.warn("Failed to save transactions to storage:", error);
  }
}
