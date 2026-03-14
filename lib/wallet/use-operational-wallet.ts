import {
  createContext,
  createElement,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  useEmbeddedEthereumWallet,
  usePrivy,
  type LinkedAccount,
} from "@privy-io/expo";
import { useSmartWallets } from "@privy-io/expo/smart-wallets";
import {
  createPublicClient,
  encodeFunctionData,
  http,
  type Address,
  type Hex,
  type TypedDataDomain,
} from "viem";
import type { TypedData } from "abitype";
import { baseSepolia } from "viem/chains";
import { TOKEN_ABI, TOKEN_ADDRESS, USDT_ADDRESS, CHAIN_ID } from "../blockchain/contracts";
import { DEFAULT_MINT_AMOUNT, FAUCET_ADDRESS, FAUCET_ABI } from "../blockchain/token-mint";

const publicClient = createPublicClient({
  chain: baseSepolia,
  transport: http(),
});

const SMART_WALLET_POLL_INTERVAL_MS = 1000;
const SMART_WALLET_POLL_ATTEMPTS = 20;

export interface WalletSnapshot {
  usdcBalance: bigint;
  usdtBalance: bigint;
  nativeBalance: bigint;
}

export type WalletProvisioningStatus =
  | "creating_embedded"
  | "creating_smart"
  | "ready"
  | "error";

export interface UseOperationalWalletResult {
  rootSignerAddress: Address | null;
  embeddedWalletAddress: Address | null;
  smartWalletAddress: Address | null;
  status: WalletProvisioningStatus;
  isReady: boolean;
  isProvisioning: boolean;
  isLoading: boolean;
  error: string | null;
  retryProvisioning: () => void;
  refreshBalances: () => Promise<WalletSnapshot | null>;
  mintTestTokens: (amount?: bigint) => Promise<Hex | null>;
  mintTestUSDT: (amount?: bigint) => Promise<Hex | null>;
  sendTokenTransfer: (tokenAddress: Address, recipient: Address, amount: bigint) => Promise<Hex | null>;
  sendTokens: (recipient: Address, amount: bigint) => Promise<Hex | null>;
  sendContractTransaction: (to: Address, data: Hex, value?: bigint) => Promise<Hex | null>;
  // EIP-712 signing for merchant mode
  signTypedData: (
    params: {
      domain: TypedDataDomain;
      types: TypedData;
      primaryType: string;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      message: any;
    },
  ) => Promise<Hex>;
  // Allowance helpers
  checkAllowance: (tokenAddress: Address, owner: Address, spender: Address) => Promise<bigint>;
  setAllowance: (tokenAddress: Address, spender: Address, amount: bigint) => Promise<Hex | null>;
  ensureAllowance: (tokenAddress: Address, spender: Address, amount: bigint) => Promise<Hex | null>;
}

type EmbeddedWalletAccount = Extract<LinkedAccount, { type: "wallet" }>;

function getEmbeddedWalletAddress(
  linkedAccounts?: LinkedAccount[] | null,
): Address | null {
  const embeddedWalletAccount = linkedAccounts?.find(
    (account): account is EmbeddedWalletAccount =>
      account.type === "wallet" &&
      "wallet_client_type" in account &&
      account.wallet_client_type === "privy",
  );

  return (embeddedWalletAccount?.address as Address | undefined) ?? null;
}

function getSmartWalletAddress(
  linkedAccounts?: LinkedAccount[] | null,
): Address | null {
  const smartWalletAccount = linkedAccounts?.find(
    (account): account is Extract<LinkedAccount, { type: "smart_wallet" }> =>
      account.type === "smart_wallet",
  );

  return (smartWalletAccount?.address as Address | undefined) ?? null;
}

function getProvisioningMessage(status: WalletProvisioningStatus) {
  switch (status) {
    case "creating_embedded":
      return "Creating embedded wallet";
    case "creating_smart":
      return "Creating smart wallet";
    case "error":
      return "Wallet setup failed";
    case "ready":
      return null;
  }
}

function useOperationalWalletValue(): UseOperationalWalletResult {
  const { wallets, create } = useEmbeddedEthereumWallet();
  const { user } = usePrivy();
  const { client: smartWalletClient, getClientForChain } = useSmartWallets();
  const [isLoading, setIsLoading] = useState(false);
  const [retryNonce, setRetryNonce] = useState(0);
  const [resolvedSmartWalletClient, setResolvedSmartWalletClient] = useState(smartWalletClient);
  const [createdEmbeddedWalletAddress, setCreatedEmbeddedWalletAddress] = useState<Address | null>(null);
  const [provisioningError, setProvisioningError] = useState<string | null>(null);
  const [transactionError, setTransactionError] = useState<string | null>(null);
  const [provisioningStatus, setProvisioningStatus] =
    useState<WalletProvisioningStatus>("creating_embedded");

  const linkedAccounts = user?.linked_accounts;
  const linkedEmbeddedWalletAddress = useMemo(
    () => getEmbeddedWalletAddress(linkedAccounts),
    [linkedAccounts],
  );
  const linkedSmartWalletAddress = useMemo(
    () => getSmartWalletAddress(linkedAccounts),
    [linkedAccounts],
  );

  const rootSignerAddress = (wallets[0]?.address as Address | undefined) ?? null;
  const embeddedWalletAddress =
    linkedEmbeddedWalletAddress ?? rootSignerAddress ?? createdEmbeddedWalletAddress;

  const smartWalletAddress =
    linkedSmartWalletAddress ??
    (smartWalletClient?.account.address as Address | undefined) ??
    (resolvedSmartWalletClient?.account.address as Address | undefined) ??
    null;

  const activeSmartWalletClient = smartWalletClient ?? resolvedSmartWalletClient;
  const isReady = !!embeddedWalletAddress && !!smartWalletAddress && !!activeSmartWalletClient;
  const status = provisioningError
    ? "error"
    : isReady
      ? "ready"
      : embeddedWalletAddress
        ? "creating_smart"
        : "creating_embedded";
  const isProvisioning = status === "creating_embedded" || status === "creating_smart";
  const error = transactionError ?? provisioningError;

  useEffect(() => {
    setResolvedSmartWalletClient(smartWalletClient);
  }, [smartWalletClient]);

  useEffect(() => {
    if (!user) {
      setCreatedEmbeddedWalletAddress(null);
      setProvisioningError(null);
      setTransactionError(null);
      setProvisioningStatus("creating_embedded");
      return;
    }

    setCreatedEmbeddedWalletAddress(null);
    setTransactionError(null);
    setProvisioningError(null);
  }, [user?.id]);

  useEffect(() => {
    setProvisioningStatus(status);
  }, [status]);

  useEffect(() => {
    if (!user?.id || embeddedWalletAddress) {
      return;
    }

    let cancelled = false;

    setProvisioningError(null);
    setProvisioningStatus("creating_embedded");

    create()
      .then((result) => {
        if (cancelled) {
          return;
        }

        const nextEmbeddedWalletAddress = getEmbeddedWalletAddress(result.user.linked_accounts);
        if (nextEmbeddedWalletAddress) {
          setCreatedEmbeddedWalletAddress(nextEmbeddedWalletAddress);
        }
      })
      .catch((createError) => {
        if (cancelled) {
          return;
        }

        const message =
          createError instanceof Error
            ? createError.message
            : "Failed to create embedded wallet";
        setProvisioningError(message);
        setProvisioningStatus("error");
      });

    return () => {
      cancelled = true;
    };
  }, [create, embeddedWalletAddress, retryNonce, user?.id]);

  useEffect(() => {
    if (!user?.id || !embeddedWalletAddress) {
      return;
    }

    if (isReady) {
      setProvisioningError(null);
      setProvisioningStatus("ready");
      return;
    }

    let cancelled = false;

    const pollSmartWallet = async () => {
      let lastMessage = "Timed out waiting for smart wallet provisioning";

      setProvisioningError(null);
      setProvisioningStatus("creating_smart");

      for (let attempt = 0; attempt < SMART_WALLET_POLL_ATTEMPTS; attempt += 1) {
        if (cancelled) {
          return;
        }

        try {
          const client = await getClientForChain({ chainId: CHAIN_ID });
          if (cancelled) {
            return;
          }

          setResolvedSmartWalletClient(client);
          if (client?.account.address) {
            setProvisioningError(null);
            setProvisioningStatus("ready");
            return;
          }
        } catch (clientError) {
          lastMessage =
            clientError instanceof Error
              ? clientError.message
              : "Failed to initialize smart wallet client";
        }

        if (attempt < SMART_WALLET_POLL_ATTEMPTS - 1) {
          await new Promise((resolve) => setTimeout(resolve, SMART_WALLET_POLL_INTERVAL_MS));
        }
      }

      if (!cancelled) {
        setProvisioningError(lastMessage);
        setProvisioningStatus("error");
      }
    };

    pollSmartWallet().catch((clientError) => {
      if (cancelled) {
        return;
      }

      const message =
        clientError instanceof Error
          ? clientError.message
          : "Failed to initialize smart wallet client";
      setProvisioningError(message);
      setProvisioningStatus("error");
    });

    return () => {
      cancelled = true;
    };
  }, [embeddedWalletAddress, getClientForChain, isReady, retryNonce, user?.id]);

  const retryProvisioning = useCallback(() => {
    setProvisioningError(null);
    setTransactionError(null);
    setProvisioningStatus(embeddedWalletAddress ? "creating_smart" : "creating_embedded");
    setRetryNonce((current) => current + 1);
  }, [embeddedWalletAddress]);

  const getSmartWalletClient = useCallback(async () => {
    if (activeSmartWalletClient) {
      return activeSmartWalletClient;
    }

    if (!embeddedWalletAddress) {
      throw new Error("Embedded wallet is not available");
    }

    try {
      const client = await getClientForChain({ chainId: CHAIN_ID });
      setResolvedSmartWalletClient(client);
      return client;
    } catch (clientError) {
      const message =
        clientError instanceof Error
          ? clientError.message
          : "Failed to initialize smart wallet client";
      throw new Error(message);
    }
  }, [activeSmartWalletClient, embeddedWalletAddress, getClientForChain]);

  const refreshBalances = useCallback(async (): Promise<WalletSnapshot | null> => {
    if (!isReady || !smartWalletAddress) {
      return null;
    }

    try {
      const [usdcBalance, usdtBalance, nativeBalance] = await Promise.all([
        publicClient.readContract({
          address: TOKEN_ADDRESS,
          abi: TOKEN_ABI,
          functionName: "balanceOf",
          args: [smartWalletAddress],
        }) as Promise<bigint>,
        publicClient.readContract({
          address: USDT_ADDRESS,
          abi: TOKEN_ABI,
          functionName: "balanceOf",
          args: [smartWalletAddress],
        }) as Promise<bigint>,
        publicClient.getBalance({
          address: smartWalletAddress,
        }),
      ]);

      setTransactionError(null);

      return {
        usdcBalance,
        usdtBalance,
        nativeBalance,
      };
    } catch (readError) {
      const message =
        readError instanceof Error ? readError.message : "Failed to read balances";
      setTransactionError(message);
      return null;
    }
  }, [isReady, smartWalletAddress]);

  const sendContractTransaction = useCallback(
    async (to: Address, data: Hex, value: bigint = BigInt(0)): Promise<Hex | null> => {
      if (!isReady) {
        const message =
          getProvisioningMessage(provisioningStatus) ?? "Smart wallet is not ready";
        setTransactionError(message);
        throw new Error(message);
      }

      const client = await getSmartWalletClient();

      setIsLoading(true);
      setTransactionError(null);

      try {
        const txHash = await client.sendTransaction({
          to,
          data,
          value,
        });

        return txHash as Hex;
      } catch (sendError) {
        const message =
          sendError instanceof Error
            ? sendError.message
            : "Failed to send smart wallet transaction";
        setTransactionError(message);
        throw new Error(message);
      } finally {
        setIsLoading(false);
      }
    },
    [getSmartWalletClient, isReady, provisioningStatus],
  );

  const mintTestTokens = useCallback(
    async (amount: bigint = DEFAULT_MINT_AMOUNT): Promise<Hex | null> => {
      if (!smartWalletAddress) {
        setTransactionError("No smart wallet address");
        return null;
      }

      const data = encodeFunctionData({
        abi: FAUCET_ABI,
        functionName: "mint",
        args: [TOKEN_ADDRESS, smartWalletAddress, amount],
      });

      return sendContractTransaction(FAUCET_ADDRESS, data);
    },
    [sendContractTransaction, smartWalletAddress],
  );

  const mintTestUSDT = useCallback(
    async (amount: bigint = DEFAULT_MINT_AMOUNT): Promise<Hex | null> => {
      if (!smartWalletAddress) {
        setTransactionError("No smart wallet address");
        return null;
      }

      const data = encodeFunctionData({
        abi: FAUCET_ABI,
        functionName: "mint",
        args: [USDT_ADDRESS, smartWalletAddress, amount],
      });

      return sendContractTransaction(FAUCET_ADDRESS, data);
    },
    [sendContractTransaction, smartWalletAddress],
  );

  const sendTokenTransfer = useCallback(
    async (
      tokenAddress: Address,
      recipient: Address,
      amount: bigint,
    ): Promise<Hex | null> => {
      const data = encodeFunctionData({
        abi: TOKEN_ABI,
        functionName: "transfer",
        args: [recipient, amount],
      });

      return sendContractTransaction(tokenAddress, data);
    },
    [sendContractTransaction],
  );

  const sendTokens = useCallback(
    async (recipient: Address, amount: bigint): Promise<Hex | null> => {
      return sendTokenTransfer(TOKEN_ADDRESS, recipient, amount);
    },
    [sendTokenTransfer],
  );

  /**
   * Sign EIP-712 typed data using the smart wallet
   * Used for signing payment authorizations in merchant mode
   */
  const signTypedData = useCallback(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    async (params: {
      domain: TypedDataDomain;
      types: TypedData;
      primaryType: string;
      message: any;
    }): Promise<Hex> => {
      if (!isReady) {
        const message =
          getProvisioningMessage(provisioningStatus) ?? "Smart wallet is not ready";
        setTransactionError(message);
        throw new Error(message);
      }

      const client = await getSmartWalletClient();

      setIsLoading(true);
      setTransactionError(null);

      try {
        // Use the smart wallet client's signTypedData method
        const signature = await client.signTypedData({
          domain: params.domain,
          types: params.types,
          primaryType: params.primaryType as string,
          message: params.message,
        });

        return signature as Hex;
      } catch (signError) {
        const message =
          signError instanceof Error
            ? signError.message
            : "Failed to sign typed data";
        setTransactionError(message);
        throw new Error(message);
      } finally {
        setIsLoading(false);
      }
    },
    [getSmartWalletClient, isReady, provisioningStatus],
  );

  /**
   * Check token allowance for a spender
   */
  const checkAllowance = useCallback(
    async (tokenAddress: Address, owner: Address, spender: Address): Promise<bigint> => {
      try {
        const allowance = await publicClient.readContract({
          address: tokenAddress,
          abi: TOKEN_ABI,
          functionName: "allowance",
          args: [owner, spender],
        });
        return allowance as bigint;
      } catch (readError) {
        const message =
          readError instanceof Error ? readError.message : "Failed to check allowance";
        setTransactionError(message);
        throw new Error(message);
      }
    },
    [],
  );

  /**
   * Ensure sufficient allowance, approve if needed
   * Returns transaction hash if approval was needed, null if already approved
   */
  const ensureAllowance = useCallback(
    async (tokenAddress: Address, spender: Address, amount: bigint): Promise<Hex | null> => {
      if (!smartWalletAddress) {
        setTransactionError("No smart wallet address");
        throw new Error("No smart wallet address");
      }

      const currentAllowance = await checkAllowance(tokenAddress, smartWalletAddress, spender);

      if (currentAllowance >= amount) {
        return null; // Already approved
      }

      // Approve the exact amount needed
      const data = encodeFunctionData({
        abi: TOKEN_ABI,
        functionName: "approve",
        args: [spender, amount],
      });

      return sendContractTransaction(tokenAddress, data);
    },
    [checkAllowance, sendContractTransaction, smartWalletAddress],
  );

  const setAllowance = useCallback(
    async (tokenAddress: Address, spender: Address, amount: bigint): Promise<Hex | null> => {
      const data = encodeFunctionData({
        abi: TOKEN_ABI,
        functionName: "approve",
        args: [spender, amount],
      });

      return sendContractTransaction(tokenAddress, data);
    },
    [sendContractTransaction],
  );

  return {
    rootSignerAddress,
    embeddedWalletAddress,
    smartWalletAddress,
    status,
    isReady,
    isProvisioning,
    isLoading,
    error,
    retryProvisioning,
    refreshBalances,
    mintTestTokens,
    mintTestUSDT,
    sendTokenTransfer,
    sendTokens,
    sendContractTransaction,
    signTypedData,
    checkAllowance,
    setAllowance,
    ensureAllowance,
  };
}

const OperationalWalletContext = createContext<UseOperationalWalletResult | null>(null);

export function OperationalWalletProvider({ children }: { children: ReactNode }) {
  const value = useOperationalWalletValue();
  return createElement(OperationalWalletContext.Provider, { value }, children);
}

export function useOperationalWallet(): UseOperationalWalletResult {
  const context = useContext(OperationalWalletContext);
  if (!context) {
    throw new Error("useOperationalWallet must be used within OperationalWalletProvider");
  }
  return context;
}
