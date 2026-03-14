import { BitGo } from "bitgo";
import {
  createPublicClient,
  decodeEventLog,
  http,
  type Address,
  type Hex,
  type TransactionReceipt,
} from "viem";
import { baseSepolia } from "viem/chains";
import type { Config } from "./config.js";
import { CheckoutRecord, JsonStore, type MerchantRecord } from "./store.js";

const ERC20_TRANSFER_ABI = [
  {
    type: "event",
    name: "Transfer",
    inputs: [
      { indexed: true, name: "from", type: "address" },
      { indexed: true, name: "to", type: "address" },
      { indexed: false, name: "value", type: "uint256" },
    ],
    anonymous: false,
  },
] as const;

type BitGoWalletLike = {
  id?: unknown;
  _wallet?: Record<string, unknown>;
  createAddress?: (params?: Record<string, unknown>) => Promise<unknown>;
  listWebhooks?: () => Promise<unknown>;
  addWebhook?: (params: { url: string; type: string }) => Promise<unknown>;
};

function nowIso() {
  return new Date().toISOString();
}

function readWalletId(payload: unknown): string | undefined {
  if (!payload || typeof payload !== "object") {
    return undefined;
  }

  const candidate = payload as Record<string, unknown> & {
    wallet?: Record<string, unknown>;
    _wallet?: Record<string, unknown>;
  };

  const values = [
    candidate.id,
    candidate.walletId,
    candidate.wallet?.id,
    candidate.wallet?._wallet && typeof candidate.wallet._wallet === "object"
      ? (candidate.wallet._wallet as Record<string, unknown>).id
      : undefined,
    candidate._wallet?.id,
  ];

  return values.find((value): value is string => typeof value === "string" && value.length > 0);
}

function extractWalletId(payload: unknown): string {
  const walletId = readWalletId(payload);
  if (!walletId) {
    throw new Error("BitGo wallet id unavailable");
  }

  return walletId;
}

function extractBaseAddress(wallet: unknown): Address | undefined {
  if (!wallet || typeof wallet !== "object") {
    return undefined;
  }

  const candidate = wallet as BitGoWalletLike & { receiveAddress?: string };
  const values = [
    candidate._wallet?.receiveAddress,
    candidate._wallet?.address,
    candidate._wallet?.coinSpecific && typeof candidate._wallet.coinSpecific === "object"
      ? (candidate._wallet.coinSpecific as Record<string, unknown>).baseAddress
      : undefined,
    candidate.receiveAddress,
  ];

  return values.find((value): value is Address => typeof value === "string") as Address | undefined;
}

function extractAddressFromBitGoAddressResponse(payload: unknown): {
  address: Address;
  isInitializing: boolean;
} {
  const record = (payload ?? {}) as Record<string, unknown>;
  const address = [record.address, record.walletAddress, record.coinSpecificAddress].find(
    (value): value is Address => typeof value === "string",
  );

  if (!address) {
    throw new Error("BitGo address response did not include a receive address");
  }

  const isInitializing = Boolean(
    record.pendingChainInitialization ||
      record.pendingDeployment ||
      record.initializing ||
      (typeof record.state === "string" && record.state !== "confirmed"),
  );

  return {
    address,
    isInitializing,
  };
}

function extractWebhookTypes(payload: unknown): string[] {
  const candidate = payload as { webhooks?: Array<{ type?: string }>; type?: string };
  if (Array.isArray(candidate.webhooks)) {
    return candidate.webhooks
      .map((item) => item.type)
      .filter((value): value is string => typeof value === "string");
  }

  return typeof candidate.type === "string" ? [candidate.type] : [];
}

function maybeHex(value: unknown): Hex | undefined {
  return typeof value === "string" && value.startsWith("0x") ? (value as Hex) : undefined;
}

function collectStringValues(
  value: unknown,
  bucket: Set<string>,
) {
  if (typeof value === "string") {
    bucket.add(value.toLowerCase());
    return;
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      collectStringValues(item, bucket);
    }
    return;
  }

  if (value && typeof value === "object") {
    for (const nested of Object.values(value)) {
      collectStringValues(nested, bucket);
    }
  }
}

function payloadContainsAddress(payload: Record<string, unknown>, address: Address) {
  const values = new Set<string>();
  collectStringValues(payload, values);
  return values.has(address.toLowerCase());
}

function payloadContainsTxHash(payload: Record<string, unknown>, txHash: Hex) {
  const values = new Set<string>();
  collectStringValues(payload, values);
  return values.has(txHash.toLowerCase());
}

function extractWebhookEventId(payload: Record<string, unknown>) {
  const notificationId = payload.webhookNotification && typeof payload.webhookNotification === "object"
    ? (payload.webhookNotification as Record<string, unknown>).id
    : undefined;
  const firstNotification =
    Array.isArray(payload.webhookNotifications) && payload.webhookNotifications.length > 0
      ? payload.webhookNotifications[0]
      : undefined;

  const firstId =
    firstNotification && typeof firstNotification === "object"
      ? (firstNotification as Record<string, unknown>).id
      : undefined;

  const directId = payload.id;

  return [notificationId, firstId, directId].find(
    (value): value is string => typeof value === "string" && value.length > 0,
  );
}

function extractTransferId(payload: Record<string, unknown>) {
  const direct = payload.transferId;
  const transfer = payload.transfer && typeof payload.transfer === "object"
    ? (payload.transfer as Record<string, unknown>).id
    : undefined;

  return [direct, transfer].find(
    (value): value is string => typeof value === "string" && value.length > 0,
  );
}

export class BitGoMerchantService {
  private readonly bitgo: BitGo;
  private readonly publicClient;

  constructor(
    private readonly config: Config,
    private readonly store: JsonStore,
  ) {
    this.bitgo = new BitGo({
      env: config.BITGO_ENV,
      accessToken: config.BITGO_ACCESS_TOKEN,
    });

    this.publicClient = createPublicClient({
      chain: baseSepolia,
      transport: http(config.BASE_SEPOLIA_RPC_URL),
    });
  }

  private coin() {
    return this.bitgo.coin(this.config.BITGO_COIN) as any;
  }

  private async getWallet(walletId: string): Promise<BitGoWalletLike> {
    return (await this.coin().wallets().get({ id: walletId })) as BitGoWalletLike;
  }

  private buildMerchantId(merchantAddress: Address) {
    return merchantAddress.toLowerCase();
  }

  private buildWalletLabel(merchantAddress: Address, merchantName?: string) {
    const suffix = merchantName?.trim() || merchantAddress.slice(-6);
    return `${this.config.BITGO_WALLET_LABEL_PREFIX} ${suffix}`.trim();
  }

  private async ensureWalletWebhooks(walletId: string) {
    if (!this.config.BITGO_WEBHOOK_PUBLIC_URL) {
      return;
    }

    try {
      const wallet = await this.getWallet(walletId);
      const existing = wallet.listWebhooks ? await wallet.listWebhooks() : null;
      const existingTypes = new Set(extractWebhookTypes(existing));
      const webhookUrl = this.config.BITGO_WEBHOOK_PUBLIC_URL;

      for (const type of ["transfer", "transaction", "pendingapproval", "address_confirmation"]) {
        if (existingTypes.has(type)) {
          continue;
        }

        try {
          await wallet.addWebhook?.({ url: webhookUrl, type });
        } catch (error) {
          console.warn(`Failed to add BitGo webhook for type ${type}:`, error);
        }
      }
    } catch (error) {
      console.warn("Failed to ensure BitGo wallet webhooks:", error);
    }
  }

  async ensureMerchantWallet(merchantAddress: Address, merchantName?: string): Promise<MerchantRecord> {
    const merchantId = this.buildMerchantId(merchantAddress);
    const snapshot = await this.store.read();
    const existing = snapshot.merchants[merchantId];

    if (existing) {
      await this.ensureWalletWebhooks(existing.bitgoWalletId);
      return existing;
    }

    const wallets = this.coin().wallets();
    const generated = await wallets.generateWallet({
      label: this.buildWalletLabel(merchantAddress, merchantName),
      passphrase: this.config.BITGO_WALLET_PASSPHRASE,
      enterprise: this.config.BITGO_ENTERPRISE_ID,
      type: "hot",
      multisigType: "tss",
      walletVersion: 5,
    });

    let wallet = (generated as { wallet?: unknown } | null | undefined)?.wallet ?? generated;
    let walletId = readWalletId(wallet) ?? readWalletId(generated);

    if ((!wallet || typeof wallet !== "object") && walletId) {
      wallet = await this.getWallet(walletId);
    }

    walletId = walletId ?? extractWalletId(wallet);

    const now = nowIso();
    const record: MerchantRecord = {
      merchantId,
      merchantAddress,
      merchantName,
      bitgoWalletId: walletId,
      bitgoBaseAddress: extractBaseAddress(wallet),
      coin: this.config.BITGO_COIN,
      label: this.buildWalletLabel(merchantAddress, merchantName),
      createdAt: now,
      updatedAt: now,
    };

    await this.store.transact((data) => {
      data.merchants[merchantId] = record;
    });

    await this.ensureWalletWebhooks(record.bitgoWalletId);
    return record;
  }

  async createCheckout(params: {
    merchantAddress: Address;
    merchantName?: string;
    amount: string;
    tokenSymbol: string;
    tokenAddress: Address;
    chainId: number;
    expiresInSeconds?: number;
  }): Promise<CheckoutRecord> {
    const merchant = await this.ensureMerchantWallet(params.merchantAddress, params.merchantName);
    const wallet = await this.getWallet(merchant.bitgoWalletId);
    const addressPayload = await wallet.createAddress?.({
      label: `checkout-${Date.now()}`,
    });

    const addressState = extractAddressFromBitGoAddressResponse(addressPayload);
    const now = Date.now();
    const checkoutId = crypto.randomUUID();
    const requestId = `bitgo_${checkoutId}`;
    const expiresAt = new Date(now + (params.expiresInSeconds ?? 300) * 1000).toISOString();

    const checkout: CheckoutRecord = {
      checkoutId,
      requestId,
      merchantId: merchant.merchantId,
      merchantAddress: merchant.merchantAddress,
      merchantName: params.merchantName ?? merchant.merchantName,
      walletId: merchant.bitgoWalletId,
      bitgoBaseAddress: merchant.bitgoBaseAddress,
      receiveAddress: addressState.address,
      amount: params.amount,
      tokenSymbol: params.tokenSymbol,
      tokenAddress: params.tokenAddress,
      chainId: params.chainId,
      coin: merchant.coin,
      rail: "bitgo",
      status: addressState.isInitializing ? "initializing_address" : "ready",
      expiresAt,
      bitgoWebhookEventIds: [],
      rawWebhookEvents: [],
      createdAt: nowIso(),
      updatedAt: nowIso(),
    };

    await this.store.transact((data) => {
      data.checkouts[checkout.checkoutId] = checkout;
      data.merchants[merchant.merchantId] = {
        ...merchant,
        updatedAt: nowIso(),
      };
    });

    return checkout;
  }

  private isExpired(checkout: CheckoutRecord) {
    return (
      !["settled", "failed", "expired"].includes(checkout.status) &&
      Date.now() > new Date(checkout.expiresAt).getTime()
    );
  }

  async getCheckout(checkoutId: string): Promise<CheckoutRecord | null> {
    const snapshot = await this.store.read();
    const checkout = snapshot.checkouts[checkoutId];

    if (!checkout) {
      return null;
    }

    if (this.isExpired(checkout)) {
      const expired = await this.store.transact((data) => {
        const current = data.checkouts[checkoutId];
        if (!current) {
          return null;
        }

        current.status = "expired";
        current.updatedAt = nowIso();
        return current;
      });
      return expired;
    }

    if (checkout.status === "payment_broadcasted" && checkout.customerTxHash) {
      await this.confirmCheckoutTransaction(checkoutId);
      const refreshed = await this.store.read();
      return refreshed.checkouts[checkoutId] ?? null;
    }

    return checkout;
  }

  async reportCustomerTransaction(params: {
    checkoutId: string;
    txHash: Hex;
    customerAddress: Address;
  }): Promise<CheckoutRecord> {
    const updated = await this.store.transact((data) => {
      const checkout = data.checkouts[params.checkoutId];

      if (!checkout) {
        throw new Error("Checkout not found");
      }

      if (this.isExpired(checkout)) {
        checkout.status = "expired";
        checkout.updatedAt = nowIso();
        throw new Error("Checkout expired");
      }

      checkout.customerTxHash = params.txHash;
      checkout.customerAddress = params.customerAddress;
      checkout.status = "payment_broadcasted";
      checkout.updatedAt = nowIso();
      return { ...checkout };
    });

    void this.confirmCheckoutTransaction(params.checkoutId);
    return updated;
  }

  async confirmCheckoutTransaction(checkoutId: string): Promise<CheckoutRecord | null> {
    const snapshot = await this.store.read();
    const checkout = snapshot.checkouts[checkoutId];

    if (!checkout?.customerTxHash) {
      return checkout ?? null;
    }

    try {
      const receipt = await this.publicClient.getTransactionReceipt({
        hash: checkout.customerTxHash,
      });

      if (receipt.status !== "success") {
        return this.store.transact((data) => {
          const current = data.checkouts[checkoutId];
          if (!current) {
            return null;
          }
          current.status = "failed";
          current.errorMessage = "Customer transaction reverted";
          current.updatedAt = nowIso();
          return current;
        });
      }

      if (!this.receiptMatchesCheckout(receipt, checkout)) {
        return null;
      }

      return this.store.transact((data) => {
        const current = data.checkouts[checkoutId];
        if (!current) {
          return null;
        }

        current.status = "settled";
        current.bitgoTxHash = checkout.customerTxHash;
        current.updatedAt = nowIso();
        return current;
      });
    } catch {
      return checkout;
    }
  }

  private receiptMatchesCheckout(receipt: TransactionReceipt, checkout: CheckoutRecord) {
    return receipt.logs.some((log) => {
      if (log.address.toLowerCase() !== checkout.tokenAddress.toLowerCase()) {
        return false;
      }

      try {
        const event = decodeEventLog({
          abi: ERC20_TRANSFER_ABI,
          data: log.data,
          topics: log.topics,
        });

        if (event.eventName !== "Transfer") {
          return false;
        }

        const args = event.args as {
          to?: Address;
          value?: bigint;
        };

        return (
          args.to?.toLowerCase() === checkout.receiveAddress.toLowerCase() &&
          args.value?.toString() === checkout.amount
        );
      } catch {
        return false;
      }
    });
  }

  async processWebhook(payload: Record<string, unknown>): Promise<{ accepted: boolean }> {
    const eventId = extractWebhookEventId(payload);
    const txHash = maybeHex(payload.txHash) ?? maybeHex(payload.hash);
    const transferId = extractTransferId(payload);

    let matchedCheckoutId: string | undefined;

    await this.store.transact((data) => {
      const checkout = Object.values(data.checkouts).find((candidate) => {
        if (eventId && candidate.bitgoWebhookEventIds.includes(eventId)) {
          return false;
        }

        return (
          payloadContainsAddress(payload, candidate.receiveAddress) ||
          (candidate.customerTxHash && payloadContainsTxHash(payload, candidate.customerTxHash)) ||
          (txHash ? payloadContainsTxHash(payload, txHash) : false)
        );
      });

      if (!checkout) {
        return;
      }

      matchedCheckoutId = checkout.checkoutId;
      if (eventId) {
        checkout.bitgoWebhookEventIds.push(eventId);
      }
      checkout.rawWebhookEvents.push(payload);

      if (checkout.status === "initializing_address") {
        checkout.status = "ready";
      }

      if (transferId) {
        checkout.bitgoTransferId = transferId;
      }

      if (txHash) {
        checkout.bitgoTxHash = txHash;
      }

      if (checkout.customerTxHash || txHash) {
        checkout.status = "settled";
      } else if (checkout.status !== "settled") {
        checkout.status = "deposit_detected";
      }

      checkout.updatedAt = nowIso();
    });

    if (matchedCheckoutId) {
      void this.confirmCheckoutTransaction(matchedCheckoutId);
    }

    return { accepted: Boolean(matchedCheckoutId) };
  }

  async withdrawMerchantFunds(params: {
    merchantAddress: Address;
    destinationAddress: Address;
    amount: string;
  }) {
    if (!this.config.BITGO_MERCHANT_TOKEN_NAME) {
      throw new Error("Missing BITGO_MERCHANT_TOKEN_NAME");
    }

    const snapshot = await this.store.read();
    const merchant = snapshot.merchants[this.buildMerchantId(params.merchantAddress)];

    if (!merchant) {
      throw new Error("Merchant BitGo wallet not found");
    }

    const wallet = await this.getWallet(merchant.bitgoWalletId);
    const sendMany = (wallet as BitGoWalletLike & {
      sendMany?: (params: Record<string, unknown>) => Promise<unknown>;
    }).sendMany;

    if (!sendMany) {
      throw new Error("BitGo wallet does not support sendMany");
    }

    const result = await sendMany.call(wallet, {
      walletPassphrase: this.config.BITGO_WALLET_PASSPHRASE,
      recipients: [
        {
          address: params.destinationAddress,
          amount: params.amount,
        },
      ],
      type: "transfer",
      isTss: true,
      tokenName: this.config.BITGO_MERCHANT_TOKEN_NAME,
    });

    return result;
  }
}
