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
import { useOperationalWallet } from "./wallet/use-operational-wallet";

interface TokenBalances {
  usdc: bigint;
  usdt: bigint;
}

interface BalanceState {
  balances: TokenBalances;
  allowance: bigint;
  ethBalance: bigint;
  isLoading: boolean;
  error: string | null;
  lastFetchedAt: number | null;
}

type BalanceAction =
  | { type: "FETCH_START" }
  | { type: "FETCH_SUCCESS"; balances: TokenBalances; allowance: bigint; ethBalance: bigint }
  | { type: "FETCH_ERROR"; error: string }
  | { type: "RESET" };

const initialState: BalanceState = {
  balances: { usdc: BigInt(0), usdt: BigInt(0) },
  allowance: BigInt(0),
  ethBalance: BigInt(0),
  isLoading: false,
  error: null,
  lastFetchedAt: null,
};

function reducer(state: BalanceState, action: BalanceAction): BalanceState {
  switch (action.type) {
    case "FETCH_START":
      return { ...state, isLoading: true, error: null };
    case "FETCH_SUCCESS":
      return {
        ...state,
        isLoading: false,
        balances: action.balances,
        allowance: action.allowance,
        ethBalance: action.ethBalance,
        lastFetchedAt: Date.now(),
      };
    case "FETCH_ERROR":
      return { ...state, isLoading: false, error: action.error };
    case "RESET":
      return initialState;
    default:
      return state;
  }
}

interface BalanceContextValue {
  state: BalanceState;
  refreshBalance: () => Promise<void>;
  prefetchBalance: () => Promise<void>;
}

const BalanceContext = createContext<BalanceContextValue | null>(null);

export function useBalance(): BalanceContextValue {
  const context = useContext(BalanceContext);
  if (!context) {
    throw new Error("useBalance must be used within BalanceProvider");
  }
  return context;
}

export function BalanceProvider({ children }: { children: ReactNode }) {
  const { isReady: privyReady, user } = usePrivy();
  const wallet = useOperationalWallet();
  const [state, dispatch] = useReducer(reducer, initialState);

  const refreshBalancesRef = useRef(wallet.refreshBalances);
  const smartWalletAddressRef = useRef(wallet.smartWalletAddress);
  const walletReadyRef = useRef(wallet.isReady);
  const isFetchingRef = useRef(false);

  useEffect(() => {
    refreshBalancesRef.current = wallet.refreshBalances;
    smartWalletAddressRef.current = wallet.smartWalletAddress;
    walletReadyRef.current = wallet.isReady;
  }, [wallet.isReady, wallet.refreshBalances, wallet.smartWalletAddress]);

  const refreshBalance = useCallback(async () => {
    if (!walletReadyRef.current || !smartWalletAddressRef.current) {
      return;
    }

    if (isFetchingRef.current) {
      return;
    }

    isFetchingRef.current = true;
    dispatch({ type: "FETCH_START" });

    try {
      const result = await refreshBalancesRef.current();
      if (result) {
        dispatch({
          type: "FETCH_SUCCESS",
          balances: { usdc: result.usdcBalance, usdt: result.usdtBalance },
          allowance: BigInt(0),
          ethBalance: result.nativeBalance,
        });
      } else {
        dispatch({ type: "FETCH_ERROR", error: "Failed to fetch balance" });
      }
    } catch (err) {
      dispatch({
        type: "FETCH_ERROR",
        error: err instanceof Error ? err.message : "Unknown error",
      });
    } finally {
      isFetchingRef.current = false;
    }
  }, []);

  const prefetchBalance = useCallback(async () => {
    if (!walletReadyRef.current) {
      return;
    }

    if (state.lastFetchedAt && Date.now() - state.lastFetchedAt < 5000) {
      return;
    }
    await refreshBalance();
  }, [state.lastFetchedAt, refreshBalance]);

  useEffect(() => {
    if (privyReady && !user) {
      dispatch({ type: "RESET" });
    }
  }, [privyReady, user]);

  const value: BalanceContextValue = {
    state,
    refreshBalance,
    prefetchBalance,
  };

  return createElement(BalanceContext.Provider, { value }, children);
}
