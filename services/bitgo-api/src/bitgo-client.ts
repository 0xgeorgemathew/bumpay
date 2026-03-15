import { BitGo, Environments } from "bitgo";
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
import {
  CheckoutRecord,
  JsonStore,
  type MerchantRecord,
  type WithdrawalRequestAppStatus,
  type WithdrawalRequestRecord,
} from "./store.js";

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
  transfers?: (params?: Record<string, unknown>) => Promise<unknown>;
  sendMany?: (params: Record<string, unknown>) => Promise<unknown>;
  buildAccountConsolidations?: (params?: Record<string, unknown>) => Promise<unknown>;
  sendAccountConsolidation?: (params: Record<string, unknown>) => Promise<unknown>;
};

type MerchantSummary = {
  merchantId: string;
  merchantAddress: Address;
  walletId?: string;
  walletAddress?: Address;
  tokenSymbol: string;
  tokenAddress: Address;
  merchantBaselineBalance: string;
  receivedViaCheckouts: string;
  confirmedBalance: string;
  spendableBalance: string;
  needsConsolidation: boolean;
  checkoutReceiptsAvailable: string;
  checkoutCount: number;
  receiveAddressCount: number;
};

type WalletTokenSnapshot = {
  walletAddress?: Address;
  confirmedBalance: string;
  spendableBalance: string;
  needsConsolidation: boolean;
};

type VerifiedTransfer = {
  transferId: string;
  receiveAddress: Address;
  amount: string;
  txHash?: Hex;
  tokenName?: string;
  state?: string;
};

type WithdrawalResult = {
  txRequestId?: string;
  txid?: string;
  status?: string;
  transfer?: {
    id?: string;
    coin?: string;
    state?: string;
    valueString?: string;
  };
  pendingApproval?: {
    id?: string;
    state?: string;
  };
};

type TxRequestIntent = {
  intentType: "transferToken";
  recipients: Array<{
    address: { address: string };
    amount: { value: string; symbol: string };
    tokenData: {
      tokenName: string;
      tokenType: "ERC20";
      tokenQuantity: string;
    };
  }>;
  isTss: boolean;
};

type TxRequestResult = {
  txRequestId: string;
  version: number;
  state: string;
  walletId: string;
  walletType: string;
  pendingApprovalId?: string;
  latest?: boolean;
  transactions?: Array<{
    txHash?: string;
    state: string;
    unsignedTx?: {
      serializedTxHex?: string;
      feeInfo?: { feeString?: string };
    };
  }>;
};

function nowIso() {
  return new Date().toISOString();
}

function sumAmounts(values: string[]) {
  return values.reduce((total, value) => total + BigInt(value), BigInt(0)).toString();
}

function clampNonNegative(value: bigint) {
  return value > BigInt(0) ? value : BigInt(0);
}

function minBigInt(left: bigint, right: bigint) {
  return left < right ? left : right;
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

function readStringField(record: Record<string, unknown>, ...keys: string[]) {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.length > 0) {
      return value;
    }
  }

  return undefined;
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

function readStringNumber(record: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.length > 0) {
      return value;
    }
    if (typeof value === "number" && Number.isFinite(value)) {
      return Math.trunc(value).toString();
    }
  }

  return undefined;
}

function readBoolean(record: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "boolean") {
      return value;
    }
  }

  return undefined;
}

function extractResponseBody<T = unknown>(response: unknown): T {
  if (response && typeof response === "object" && "body" in response) {
    return (response as { body: T }).body;
  }

  return response as T;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function extractTokenCandidates(payload: Record<string, unknown>) {
  const candidates: Record<string, unknown>[] = [];
  const queue = [payload.tokens, payload.tokenBalances, payload.balance];

  for (const item of queue) {
    if (Array.isArray(item)) {
      for (const nested of item) {
        if (isRecord(nested)) {
          candidates.push(nested);
        }
      }
      continue;
    }

    if (isRecord(item)) {
      for (const [key, value] of Object.entries(item)) {
        if (isRecord(value)) {
          candidates.push({ ...value, tokenName: value.tokenName ?? key, id: value.id ?? key });
        }
      }
    }
  }

  return candidates;
}

function matchesTokenName(record: Record<string, unknown>, tokenName?: string) {
  if (!tokenName) {
    return false;
  }

  const values = [
    record.tokenName,
    record.name,
    record.coin,
    record.type,
    record.id,
    record.token,
  ];

  return values.some((value) => typeof value === "string" && value.toLowerCase() === tokenName.toLowerCase());
}

function extractWalletSnapshot(
  payload: Record<string, unknown>,
  tokenName?: string,
): WalletTokenSnapshot {
  const tokenRecord =
    extractTokenCandidates(payload).find((candidate) => matchesTokenName(candidate, tokenName)) ?? payload;

  return {
    walletAddress:
      extractBaseAddress(payload) ??
      extractBaseAddress(tokenRecord) ??
      extractBaseAddress((payload.wallet as Record<string, unknown> | undefined) ?? undefined),
    confirmedBalance:
      readStringNumber(tokenRecord, [
        "confirmedBalanceString",
        "confirmedBalance",
        "balanceString",
        "balance",
      ]) ?? "0",
    spendableBalance:
      readStringNumber(tokenRecord, [
        "spendableBalanceString",
        "spendableBalance",
        "confirmedBalanceString",
        "confirmedBalance",
        "balanceString",
        "balance",
      ]) ?? "0",
    needsConsolidation:
      readBoolean(tokenRecord, ["needsConsolidation"]) ??
      readBoolean(payload, ["needsConsolidation"]) ??
      false,
  };
}

function extractTransferList(payload: unknown) {
  if (!payload || typeof payload !== "object") {
    return [];
  }

  const candidate = payload as Record<string, unknown>;
  const transfers = candidate.transfers;

  if (!Array.isArray(transfers)) {
    return [];
  }

  return transfers.filter(isRecord);
}

function extractTransferAmount(transfer: Record<string, unknown>) {
  return (
    readStringNumber(transfer, ["valueString", "value", "amountString", "amount"]) ?? "0"
  );
}

function extractTransferTxHash(transfer: Record<string, unknown>) {
  const value = [transfer.txid, transfer.txHash, transfer.hash].find(
    (item): item is string => typeof item === "string" && item.startsWith("0x"),
  );

  return value as Hex | undefined;
}

function transferMatchesAddress(transfer: Record<string, unknown>, receiveAddress: Address) {
  return payloadContainsAddress(transfer, receiveAddress);
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

  private bitgoApiUrl(path: string) {
    return `${Environments[this.bitgo.getEnv()].uri}${path}`;
  }

  private async createTransactionRequest(params: {
    walletId: string;
    recipientAddress: Address;
    amount: string;
    tokenName: string;
  }): Promise<TxRequestResult> {
    const url = `/api/v2/wallet/${params.walletId}/txrequests`;

    const body = {
      idempotencyKey: crypto.randomUUID(),
      intent: {
        intentType: "transferToken" as const,
        recipients: [
          {
            address: { address: params.recipientAddress },
            amount: {
              value: params.amount,
              symbol: params.tokenName,
            },
            tokenData: {
              tokenName: params.tokenName,
              tokenType: "ERC20" as const,
              tokenQuantity: params.amount,
            },
          },
        ],
        isTss: true,
      },
      apiVersion: "full",
      preview: false,
    };

    const request = this.bitgo.post(this.bitgoApiUrl(url));
    const response = await request.send(body);
    return extractResponseBody<TxRequestResult>(response);
  }

  private async getTransactionRequest(params: {
    txRequestId: string;
    walletId: string;
  }): Promise<TxRequestResult> {
    const payload = await this.requestBitGo<{ txRequests?: TxRequestResult[] }>(
      `/api/v2/wallet/${params.walletId}/txrequests?txRequestIds=${encodeURIComponent(params.txRequestId)}`,
    );
    const txRequests = Array.isArray(payload.txRequests) ? payload.txRequests : [];
    const txRequest =
      txRequests.find((item) => item.txRequestId === params.txRequestId && item.latest) ??
      txRequests[txRequests.length - 1];

    if (!txRequest) {
      throw new Error(`BitGo withdrawal request not found (${params.txRequestId})`);
    }

    return txRequest;
  }

  private async getWithdrawalReceiptState(txHash: Hex) {
    try {
      const receipt = await this.publicClient.getTransactionReceipt({ hash: txHash });
      return receipt.status === "success" ? "confirmed" : "failed";
    } catch {
      return "broadcasted";
    }
  }

  private mapTxRequestToAppStatus(txRequest: TxRequestResult): WithdrawalRequestAppStatus {
    const txRequestState = txRequest.state.toLowerCase();
    const transactionState = txRequest.transactions?.[0]?.state?.toLowerCase();
    const txHash = txRequest.transactions?.[0]?.txHash as Hex | undefined;

    if (
      txRequestState === "failed" ||
      txRequestState === "rejected" ||
      txRequestState === "canceled" ||
      transactionState === "failed" ||
      transactionState === "rejected"
    ) {
      return "failed";
    }

    if (txHash) {
      return "broadcasted";
    }

    if (
      txRequestState === "pendingdelivery" ||
      txRequestState === "unsigned" ||
      txRequestState === "pendingsignature" ||
      transactionState?.startsWith("ecdsa") ||
      transactionState === "readytocombineshares"
    ) {
      return "awaiting_signature";
    }

    return "submitted";
  }

  private async toWithdrawalRequestRecord(params: {
    merchantId: string;
    walletId: string;
    destinationAddress: Address;
    amount: string;
    tokenName: string;
    txRequest: TxRequestResult;
  }): Promise<WithdrawalRequestRecord> {
    const txHash = params.txRequest.transactions?.[0]?.txHash as Hex | undefined;
    const appStatus = this.mapTxRequestToAppStatus(params.txRequest);
    const finalizedStatus =
      appStatus === "broadcasted" && txHash ? await this.getWithdrawalReceiptState(txHash) : appStatus;

    return {
      txRequestId: params.txRequest.txRequestId,
      merchantId: params.merchantId,
      walletId: params.walletId,
      destinationAddress: params.destinationAddress,
      amount: params.amount,
      tokenName: params.tokenName,
      status: params.txRequest.state,
      appStatus: finalizedStatus,
      txHash,
      pendingApprovalId: params.txRequest.pendingApprovalId,
      errorMessage:
        finalizedStatus === "failed"
          ? `BitGo withdrawal request failed (${params.txRequest.txRequestId})`
          : undefined,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    };
  }

  private toWithdrawalResult(record: WithdrawalRequestRecord): WithdrawalResult & { appStatus: WithdrawalRequestAppStatus } {
    return {
      txRequestId: record.txRequestId,
      txid: record.txHash,
      status: record.status,
      appStatus: record.appStatus,
      pendingApproval: record.pendingApprovalId
        ? { id: record.pendingApprovalId, state: "pendingApproval" }
        : undefined,
    };
  }

  private async saveWithdrawalRecord(record: WithdrawalRequestRecord) {
    await this.store.transact((data) => {
      data.withdrawalRequests[record.txRequestId] = record;
    });
  }

  private async latestWithdrawalRecord(merchantId: string) {
    const snapshot = await this.store.read();
    return Object.values(snapshot.withdrawalRequests)
      .filter((record) => record.merchantId === merchantId)
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt))[0];
  }

  private async requestBitGo<T = unknown>(path: string): Promise<T> {
    const response = await this.bitgo.get(this.bitgoApiUrl(path));
    return extractResponseBody<T>(response);
  }

  private async getWallet(walletId: string): Promise<BitGoWalletLike> {
    return (await this.coin().wallets().get({ id: walletId })) as BitGoWalletLike;
  }

  private async getWalletSnapshot(walletId: string): Promise<WalletTokenSnapshot> {
    const payload = await this.requestBitGo<Record<string, unknown>>(
      `/api/v2/${this.config.BITGO_COIN}/wallet/${walletId}?allTokens=true`,
    );

    return extractWalletSnapshot(payload, this.config.BITGO_MERCHANT_TOKEN_NAME);
  }

  private async listWalletTransfers(
    walletId: string,
    receiveAddresses: Address[],
  ): Promise<VerifiedTransfer[]> {
    if (receiveAddresses.length === 0) {
      return [];
    }

    const wallet = await this.getWallet(walletId);
    const payload = wallet.transfers
      ? await wallet.transfers({
          limit: 500,
          address: receiveAddresses,
          allTokens: true,
        })
      : await this.requestBitGo<Record<string, unknown>>(
          `/api/v2/${this.config.BITGO_COIN}/wallet/${walletId}/transfer?allTokens=true`,
        );

    const transfers = extractTransferList(payload);
    const deduped = new Map<string, VerifiedTransfer>();

    for (const transfer of transfers) {
      const transferId = readStringNumber(transfer, ["id"]) ?? readStringNumber(transfer, ["transferId"]);
      const tokenName =
        [transfer.tokenName, transfer.coin, transfer.type].find(
          (value): value is string => typeof value === "string" && value.length > 0,
        ) ?? undefined;

      if (this.config.BITGO_MERCHANT_TOKEN_NAME && tokenName !== this.config.BITGO_MERCHANT_TOKEN_NAME) {
        continue;
      }

      const receiveAddress = receiveAddresses.find((address) => transferMatchesAddress(transfer, address));
      if (!receiveAddress) {
        continue;
      }

      const amount = extractTransferAmount(transfer);
      if (BigInt(amount) <= BigInt(0)) {
        continue;
      }

      const dedupeKey = transferId ?? `${receiveAddress.toLowerCase()}:${amount}:${extractTransferTxHash(transfer) ?? "nohash"}`;
      if (deduped.has(dedupeKey)) {
        continue;
      }

      deduped.set(dedupeKey, {
        transferId: transferId ?? dedupeKey,
        receiveAddress,
        amount,
        txHash: extractTransferTxHash(transfer),
        tokenName,
        state:
          [transfer.state, transfer.status].find(
            (value): value is string => typeof value === "string" && value.length > 0,
          ) ?? undefined,
      });
    }

    return Array.from(deduped.values());
  }

  private async getTransferById(walletId: string, transferId: string): Promise<VerifiedTransfer | null> {
    const payload = await this.requestBitGo<Record<string, unknown>>(
      `/api/v2/${this.config.BITGO_COIN}/wallet/${walletId}/transfer/${transferId}`,
    );

    const amount = extractTransferAmount(payload);
    const tokenName =
      [payload.tokenName, payload.coin, payload.type].find(
        (value): value is string => typeof value === "string" && value.length > 0,
      ) ?? undefined;

    if (this.config.BITGO_MERCHANT_TOKEN_NAME && tokenName !== this.config.BITGO_MERCHANT_TOKEN_NAME) {
      return null;
    }

    const receiveAddress = this.extractReceiveAddressForTransfer(payload);
    if (!receiveAddress || BigInt(amount) <= BigInt(0)) {
      return null;
    }

    return {
      transferId,
      receiveAddress,
      amount,
      txHash: extractTransferTxHash(payload),
      tokenName,
      state:
        [payload.state, payload.status].find(
          (value): value is string => typeof value === "string" && value.length > 0,
        ) ?? undefined,
    };
  }

  private extractReceiveAddressForTransfer(payload: Record<string, unknown>): Address | null {
    const snapshot = payload as Record<string, unknown>;
    const values = [
      snapshot.address,
      snapshot.destinationAddress,
      snapshot.coinSpecificAddress,
      isRecord(snapshot.transfer) ? snapshot.transfer.address : undefined,
    ];

    const directAddress = values.find(
      (value): value is Address => typeof value === "string" && value.startsWith("0x"),
    );
    if (directAddress) {
      return directAddress;
    }

    const nestedAddresses = new Set<string>();
    collectStringValues(payload, nestedAddresses);
    const candidate = Array.from(nestedAddresses).find((value) => value.startsWith("0x") && value.length === 42);
    return (candidate as Address | undefined) ?? null;
  }

  private async persistVerifiedTransfers(
    merchant: MerchantRecord,
    transfers: VerifiedTransfer[],
  ) {
    if (transfers.length === 0) {
      return;
    }

    await this.store.transact((data) => {
      for (const transfer of transfers) {
        data.verifiedTransfers[transfer.transferId] = {
          transferId: transfer.transferId,
          merchantId: merchant.merchantId,
          walletId: merchant.bitgoWalletId,
          receiveAddress: transfer.receiveAddress,
          tokenName: transfer.tokenName,
          amount: transfer.amount,
          txHash: transfer.txHash,
          state: transfer.state,
          createdAt: data.verifiedTransfers[transfer.transferId]?.createdAt ?? nowIso(),
          updatedAt: nowIso(),
        };
      }
    });
  }

  private async ensureMerchantBaseline(
    merchant: MerchantRecord,
    walletSnapshot: WalletTokenSnapshot,
    receivedViaCheckouts: string,
  ): Promise<MerchantRecord> {
    if (
      typeof merchant.baselineConfirmedBalance === "string" &&
      typeof merchant.baselineSpendableBalance === "string"
    ) {
      return merchant;
    }

    const received = BigInt(receivedViaCheckouts);
    const confirmed = BigInt(walletSnapshot.confirmedBalance);
    const spendable = BigInt(walletSnapshot.spendableBalance);
    const baselineConfirmed = clampNonNegative(confirmed - received).toString();
    const baselineSpendable = clampNonNegative(spendable - received).toString();

    await this.store.transact((data) => {
      const current = data.merchants[merchant.merchantId];
      if (!current) {
        return;
      }

      current.baselineConfirmedBalance = baselineConfirmed;
      current.baselineSpendableBalance = baselineSpendable;
      current.updatedAt = nowIso();
    });

    return {
      ...merchant,
      baselineConfirmedBalance: baselineConfirmed,
      baselineSpendableBalance: baselineSpendable,
    };
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
    const walletSnapshot = await this.getWalletSnapshot(walletId);

    const now = nowIso();
    const record: MerchantRecord = {
      merchantId,
      merchantAddress,
      merchantName,
      bitgoWalletId: walletId,
      bitgoBaseAddress: walletSnapshot.walletAddress ?? extractBaseAddress(wallet),
      baselineConfirmedBalance: walletSnapshot.confirmedBalance,
      baselineSpendableBalance: walletSnapshot.spendableBalance,
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

  async getMerchantSummary(merchantAddress: Address): Promise<MerchantSummary> {
    const merchantId = this.buildMerchantId(merchantAddress);
    const snapshot = await this.store.read();
    const merchant = snapshot.merchants[merchantId];
    const checkouts = Object.values(snapshot.checkouts).filter((checkout) => checkout.merchantId === merchantId);

    if (!merchant) {
      return {
        merchantId,
        merchantAddress,
        tokenSymbol: this.config.MERCHANT_ASSET_SYMBOL,
        tokenAddress: this.config.MERCHANT_TOKEN_ADDRESS as Address,
        merchantBaselineBalance: "0",
        receivedViaCheckouts: "0",
        confirmedBalance: "0",
        spendableBalance: "0",
        needsConsolidation: false,
        checkoutReceiptsAvailable: "0",
        checkoutCount: checkouts.length,
        receiveAddressCount: checkouts.length,
      };
    }

    const receiveAddresses = Array.from(
      new Set(checkouts.map((checkout) => checkout.receiveAddress.toLowerCase())),
    ).map((address) => address as Address);
    const walletSnapshot = await this.getWalletSnapshot(merchant.bitgoWalletId);
    const verifiedTransfers = await this.listWalletTransfers(merchant.bitgoWalletId, receiveAddresses);
    await this.persistVerifiedTransfers(merchant, verifiedTransfers);

    const receivedViaCheckouts = sumAmounts(verifiedTransfers.map((transfer) => transfer.amount));
    const hydratedMerchant = await this.ensureMerchantBaseline(merchant, walletSnapshot, receivedViaCheckouts);
    const baselineSpendable = BigInt(hydratedMerchant.baselineSpendableBalance ?? "0");
    const spendable = BigInt(walletSnapshot.spendableBalance);
    const checkoutReceiptsAvailable = minBigInt(
      BigInt(receivedViaCheckouts),
      clampNonNegative(spendable - baselineSpendable),
    ).toString();

    return {
      merchantId,
      merchantAddress,
      walletId: merchant.bitgoWalletId,
      walletAddress: walletSnapshot.walletAddress ?? hydratedMerchant.bitgoBaseAddress,
      tokenSymbol: this.config.MERCHANT_ASSET_SYMBOL,
      tokenAddress: this.config.MERCHANT_TOKEN_ADDRESS as Address,
      merchantBaselineBalance: hydratedMerchant.baselineSpendableBalance ?? "0",
      receivedViaCheckouts,
      confirmedBalance: walletSnapshot.confirmedBalance,
      spendableBalance: walletSnapshot.spendableBalance,
      needsConsolidation: walletSnapshot.needsConsolidation,
      checkoutReceiptsAvailable,
      checkoutCount: checkouts.length,
      receiveAddressCount: receiveAddresses.length,
    };
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

    if (matchedCheckoutId && transferId) {
      const refreshed = await this.store.read();
      const checkout = refreshed.checkouts[matchedCheckoutId];
      const merchant = checkout ? refreshed.merchants[checkout.merchantId] : undefined;

      if (checkout && merchant) {
        const verifiedTransfer = await this.getTransferById(merchant.bitgoWalletId, transferId).catch(() => null);
        await this.persistVerifiedTransfers(
          merchant,
          verifiedTransfer
            ? [verifiedTransfer]
            : [
                {
                  transferId,
                  receiveAddress: checkout.receiveAddress,
                  amount: checkout.amount,
                  txHash: txHash ?? checkout.customerTxHash,
                  tokenName: this.config.BITGO_MERCHANT_TOKEN_NAME,
                  state: checkout.status,
                },
              ],
        );
      }
    }

    if (matchedCheckoutId) {
      void this.confirmCheckoutTransaction(matchedCheckoutId);
    }

    return { accepted: Boolean(matchedCheckoutId) };
  }

  async withdrawMerchantFunds(params: {
    merchantAddress: Address;
    destinationAddress: Address;
    amount: string;
  }): Promise<WithdrawalResult & { appStatus: WithdrawalRequestAppStatus }> {
    if (!this.config.BITGO_MERCHANT_TOKEN_NAME) {
      throw new Error("Missing BITGO_MERCHANT_TOKEN_NAME");
    }

    const snapshot = await this.store.read();
    const merchant = snapshot.merchants[this.buildMerchantId(params.merchantAddress)];

    if (!merchant) {
      throw new Error("Merchant BitGo wallet not found");
    }

    const summary = await this.getMerchantSummary(params.merchantAddress);
    if (summary.checkoutReceiptsAvailable !== params.amount) {
      throw new Error("Withdrawal amount must match the BitGo checkout receipts available balance");
    }

    console.info("[bitgo-withdraw] creating withdrawal request", {
      merchantId: merchant.merchantId,
      walletId: merchant.bitgoWalletId,
      destinationAddress: params.destinationAddress,
      amount: params.amount,
      tokenName: this.config.BITGO_MERCHANT_TOKEN_NAME,
      flow: "txrequests-manual-handoff",
    });

    try {
      const txRequest = await this.createTransactionRequest({
        walletId: merchant.bitgoWalletId,
        recipientAddress: params.destinationAddress,
        amount: params.amount,
        tokenName: this.config.BITGO_MERCHANT_TOKEN_NAME,
      });

      const record = await this.toWithdrawalRequestRecord({
        merchantId: merchant.merchantId,
        walletId: merchant.bitgoWalletId,
        destinationAddress: params.destinationAddress,
        amount: params.amount,
        tokenName: this.config.BITGO_MERCHANT_TOKEN_NAME,
        txRequest,
      });
      await this.saveWithdrawalRecord(record);

      console.info("[bitgo-withdraw] withdrawal request created", {
        txRequestId: txRequest.txRequestId,
        status: record.status,
        appStatus: record.appStatus,
        pendingApprovalId: record.pendingApprovalId,
      });

      if (record.pendingApprovalId) {
        throw new Error(
          `BitGo withdrawal requires approval (${record.pendingApprovalId}). ` +
          `Verify the wallet whitelist policy auto-approves withdrawals.`,
        );
      }

      if (record.appStatus === "failed") {
        throw new Error(record.errorMessage ?? `BitGo withdrawal failed (${record.txRequestId})`);
      }

      return this.toWithdrawalResult(record);
    } catch (error) {
      console.error("[bitgo-withdraw] withdrawal failed", {
        merchantId: merchant.merchantId,
        walletId: merchant.bitgoWalletId,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  async getWithdrawalStatus(params: {
    merchantAddress: Address;
    txRequestId?: string;
  }): Promise<(WithdrawalResult & { appStatus: WithdrawalRequestAppStatus }) | null> {
    const merchantId = this.buildMerchantId(params.merchantAddress);
    const snapshot = await this.store.read();
    const merchant = snapshot.merchants[merchantId];

    if (!merchant) {
      return null;
    }

    const storedRecord =
      (params.txRequestId ? snapshot.withdrawalRequests[params.txRequestId] : undefined) ??
      (await this.latestWithdrawalRecord(merchantId));

    if (!storedRecord) {
      return null;
    }

    const txRequest = await this.getTransactionRequest({
      walletId: merchant.bitgoWalletId,
      txRequestId: storedRecord.txRequestId,
    });

    const refreshedRecord: WithdrawalRequestRecord = {
      ...storedRecord,
      status: txRequest.state,
      pendingApprovalId: txRequest.pendingApprovalId,
      txHash: (txRequest.transactions?.[0]?.txHash as Hex | undefined) ?? storedRecord.txHash,
      updatedAt: nowIso(),
    };

    const appStatus = this.mapTxRequestToAppStatus(txRequest);
    refreshedRecord.appStatus =
      appStatus === "broadcasted" && refreshedRecord.txHash
        ? await this.getWithdrawalReceiptState(refreshedRecord.txHash)
        : appStatus;
    refreshedRecord.errorMessage =
      refreshedRecord.appStatus === "failed"
        ? `BitGo withdrawal request failed (${refreshedRecord.txRequestId})`
        : undefined;

    await this.saveWithdrawalRecord(refreshedRecord);
    return this.toWithdrawalResult(refreshedRecord);
  }

  async consolidateMerchantFunds(params: { merchantAddress: Address }) {
    const snapshot = await this.store.read();
    const merchant = snapshot.merchants[this.buildMerchantId(params.merchantAddress)];

    if (!merchant) {
      throw new Error("Merchant BitGo wallet not found");
    }

    const consolidateAddresses = Array.from(
      new Set(
        Object.values(snapshot.checkouts)
          .filter((checkout) => checkout.merchantId === merchant.merchantId)
          .map((checkout) => checkout.receiveAddress),
      ),
    );

    if (consolidateAddresses.length === 0) {
      throw new Error("No checkout receive addresses available to consolidate");
    }

    const wallet = await this.getWallet(merchant.bitgoWalletId);

    if (!wallet.buildAccountConsolidations || !wallet.sendAccountConsolidation) {
      throw new Error("BitGo wallet does not support account consolidation");
    }

    const unsignedConsolidations = (await wallet.buildAccountConsolidations({
      consolidateAddresses,
    })) as unknown[];

    if (!Array.isArray(unsignedConsolidations) || unsignedConsolidations.length === 0) {
      throw new Error("No BitGo consolidation transactions were created");
    }

    const results: unknown[] = [];
    for (const prebuildTx of unsignedConsolidations) {
      const result = await wallet.sendAccountConsolidation({
        walletPassphrase: this.config.BITGO_WALLET_PASSPHRASE,
        prebuildTx,
      });
      results.push(result);
    }

    return extractResponseBody<Record<string, unknown>>(results[results.length - 1] ?? {});
  }
}
