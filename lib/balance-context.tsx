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
import { TOKEN_ADDRESS, VERIFIER_ADDRESS } from "./blockchain/contracts";
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

interface BalanceFetchOptions {
  force?: boolean;
  waitForWallet?: boolean;
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
  refreshBalance: (options?: BalanceFetchOptions) => Promise<boolean>;
  prefetchBalance: (options?: BalanceFetchOptions) => Promise<boolean>;
}

const BalanceContext = createContext<BalanceContextValue | null>(null);

const WALLET_READY_WAIT_MS = 12000;
const WALLET_READY_POLL_MS = 250;

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
  const checkAllowanceRef = useRef(wallet.checkAllowance);
  const smartWalletAddressRef = useRef(wallet.smartWalletAddress);
  const walletReadyRef = useRef(wallet.isReady);
  const inFlightFetchRef = useRef<Promise<boolean> | null>(null);

  useEffect(() => {
    refreshBalancesRef.current = wallet.refreshBalances;
    checkAllowanceRef.current = wallet.checkAllowance;
    smartWalletAddressRef.current = wallet.smartWalletAddress;
    walletReadyRef.current = wallet.isReady;
  }, [wallet.checkAllowance, wallet.isReady, wallet.refreshBalances, wallet.smartWalletAddress]);

  const waitForWalletReady = useCallback(async () => {
    if (walletReadyRef.current && smartWalletAddressRef.current) {
      return true;
    }

    const startedAt = Date.now();
    while (Date.now() - startedAt < WALLET_READY_WAIT_MS) {
      await new Promise((resolve) => setTimeout(resolve, WALLET_READY_POLL_MS));
      if (walletReadyRef.current && smartWalletAddressRef.current) {
        return true;
      }
    }

    return walletReadyRef.current && !!smartWalletAddressRef.current;
  }, []);

  const refreshBalance = useCallback(async (options: BalanceFetchOptions = {}) => {
    const { waitForWallet = false } = options;

    if (inFlightFetchRef.current) {
      return inFlightFetchRef.current;
    }

    const fetchPromise = (async () => {
      const walletReady = waitForWallet
        ? await waitForWalletReady()
        : walletReadyRef.current && !!smartWalletAddressRef.current;

      if (!walletReady) {
        if (waitForWallet) {
          dispatch({ type: "FETCH_ERROR", error: "Wallet is not ready yet" });
        }
        return false;
      }

      dispatch({ type: "FETCH_START" });

      try {
        const smartWalletAddress = smartWalletAddressRef.current;
        if (!smartWalletAddress) {
          dispatch({ type: "FETCH_ERROR", error: "Smart wallet address unavailable" });
          return false;
        }

        const [result, allowance] = await Promise.all([
          refreshBalancesRef.current(),
          checkAllowanceRef.current(
            TOKEN_ADDRESS,
            smartWalletAddress,
            VERIFIER_ADDRESS,
          ),
        ]);
        if (!result) {
          dispatch({ type: "FETCH_ERROR", error: "Failed to fetch balance" });
          return false;
        }

        dispatch({
          type: "FETCH_SUCCESS",
          balances: { usdc: result.usdcBalance, usdt: result.usdtBalance },
          allowance,
          ethBalance: result.nativeBalance,
        });
        return true;
      } catch (err) {
        dispatch({
          type: "FETCH_ERROR",
          error: err instanceof Error ? err.message : "Unknown error",
        });
        return false;
      } finally {
        inFlightFetchRef.current = null;
      }
    })();

    inFlightFetchRef.current = fetchPromise;
    return fetchPromise;
  }, [waitForWalletReady]);

  const prefetchBalance = useCallback(async (options: BalanceFetchOptions = {}) => {
    const { force = false } = options;

    if (!force && state.lastFetchedAt && Date.now() - state.lastFetchedAt < 5000) {
      return true;
    }

    return refreshBalance(options);
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
