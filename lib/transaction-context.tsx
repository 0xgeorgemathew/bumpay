import {
  createContext,
  createElement,
  useContext,
  useReducer,
  useCallback,
  useEffect,
  useRef,
  type ReactNode,
} from "react";
import { usePrivy } from "@privy-io/expo";
import { Ionicons } from "@expo/vector-icons";
import type { Address } from "viem";
import { useOperationalWallet } from "./wallet";
import { getEnsClaimStatus } from "./ens/service";
import { loadTransactions, saveTransactions } from "./transactions/storage";
import {
  formatRelativeDate,
  getRandomIconColor,
  getDisplayName,
  getTransactionIcon,
} from "./transactions/transform";

export interface DisplayTransaction {
  id: string; // txHash
  name: string; // Counterparty name/address
  date: string; // Formatted relative date
  amount: number; // USD amount (negative = sent)
  isPositive: boolean; // true = received
  iconName: keyof typeof Ionicons.glyphMap;
  iconBgColor: string; // Color from palette
}

export interface PaymentSuccessParams {
  role: "payer" | "receiver";
  from: string;
  to: string;
  amount: bigint;
  tokenSymbol: string;
  chainName: string;
  txHash: string;
  fromLabel?: string | null;
  toLabel?: string | null;
}

interface TransactionState {
  transactions: DisplayTransaction[];
  isLoading: boolean;
}

type TransactionAction =
  | { type: "LOAD_START" }
  | { type: "LOAD_SUCCESS"; transactions: DisplayTransaction[] }
  | { type: "ADD_TRANSACTION"; transaction: DisplayTransaction }
  | { type: "RESET" };

const initialState: TransactionState = {
  transactions: [],
  isLoading: false,
};

function reducer(state: TransactionState, action: TransactionAction): TransactionState {
  switch (action.type) {
    case "LOAD_START":
      return { ...state, isLoading: true };
    case "LOAD_SUCCESS":
      return { ...state, isLoading: false, transactions: action.transactions };
    case "ADD_TRANSACTION":
      // Add to front of list, then dedupe by id
      const newTransactions = [action.transaction, ...state.transactions];
      const seen = new Set<string>();
      const deduped = newTransactions.filter((tx) => {
        if (seen.has(tx.id)) {
          return false;
        }
        seen.add(tx.id);
        return true;
      });
      return { ...state, transactions: deduped };
    case "RESET":
      return initialState;
    default:
      return state;
  }
}

interface TransactionContextValue {
  state: TransactionState;
  addTransaction: (params: PaymentSuccessParams) => Promise<void>;
}

const TransactionContext = createContext<TransactionContextValue | null>(null);

export function useTransactions(): TransactionContextValue {
  const context = useContext(TransactionContext);
  if (!context) {
    throw new Error("useTransactions must be used within TransactionProvider");
  }
  return context;
}

export function TransactionProvider({ children }: { children: ReactNode }) {
  const { isReady: privyReady, user } = usePrivy();
  const wallet = useOperationalWallet();
  const [state, dispatch] = useReducer(reducer, initialState);
  const loadedAddressRef = useRef<string | null>(null);

  // Load transactions when wallet is ready
  useEffect(() => {
    const address = wallet.smartWalletAddress;

    if (!privyReady || !user || !address) {
      // Reset when user logs out
      if (privyReady && !user) {
        dispatch({ type: "RESET" });
        loadedAddressRef.current = null;
      }
      return;
    }

    // Only load once per address
    if (loadedAddressRef.current === address.toLowerCase()) {
      return;
    }

    loadedAddressRef.current = address.toLowerCase();
    dispatch({ type: "LOAD_START" });

    loadTransactions(address)
      .then((transactions) => {
        dispatch({ type: "LOAD_SUCCESS", transactions });
      })
      .catch((error) => {
        console.warn("Failed to load transactions:", error);
        dispatch({ type: "LOAD_SUCCESS", transactions: [] });
      });
  }, [privyReady, user, wallet.smartWalletAddress]);

  const addTransaction = useCallback(
    async (params: PaymentSuccessParams): Promise<void> => {
      const derivedOwnerAddress =
        params.role === "receiver" ? params.to.toLowerCase() : params.from.toLowerCase();
      const address = wallet.smartWalletAddress ?? derivedOwnerAddress;
      const counterpartyAddress =
        params.role === "receiver" ? params.from : params.to;
      const fallbackLabel =
        params.role === "receiver" ? params.fromLabel : params.toLabel;

      // Convert amount to USD (assuming stablecoin, so 1:1)
      const amountUsd = Number(params.amount) / 1e6; // Assuming 6 decimals for USDC/USDT

      // Determine if positive (received) or negative (sent)
      const isPositive = params.role === "receiver";

      let resolvedCounterpartyEns: string | null = null;
      try {
        const status = await getEnsClaimStatus(counterpartyAddress as Address);
        resolvedCounterpartyEns = status.fullName;
      } catch (error) {
        console.warn("Failed to resolve ENS for recent activity:", error);
      }

      // Get display name for counterparty
      const name = getDisplayName(
        params.role,
        params.from,
        params.to,
        params.role === "receiver" ? resolvedCounterpartyEns ?? fallbackLabel ?? null : null,
        params.role === "payer" ? resolvedCounterpartyEns ?? fallbackLabel ?? null : null,
        address,
      );

      const transaction: DisplayTransaction = {
        id: params.txHash,
        name,
        date: formatRelativeDate(Date.now()),
        amount: isPositive ? amountUsd : -amountUsd,
        isPositive,
        iconName: getTransactionIcon(params.role),
        iconBgColor: getRandomIconColor(),
      };

      dispatch({ type: "ADD_TRANSACTION", transaction });

      // Persist to storage
      const updatedTransactions = [transaction, ...state.transactions];
      await saveTransactions(address, updatedTransactions);
    },
    [wallet.smartWalletAddress, state.transactions],
  );

  const value: TransactionContextValue = {
    state,
    addTransaction,
  };

  return createElement(TransactionContext.Provider, { value }, children);
}
