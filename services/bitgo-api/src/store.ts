import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import type { Address, Hex } from "viem";

export type CheckoutStatus =
  | "initializing_address"
  | "ready"
  | "payment_broadcasted"
  | "deposit_detected"
  | "sweeping"
  | "settled"
  | "expired"
  | "failed";

export interface MerchantRecord {
  merchantId: string;
  merchantAddress: Address;
  merchantName?: string;
  bitgoWalletId: string;
  bitgoBaseAddress?: Address;
  coin: string;
  label: string;
  createdAt: string;
  updatedAt: string;
}

export interface CheckoutRecord {
  checkoutId: string;
  requestId: string;
  merchantId: string;
  merchantAddress: Address;
  merchantName?: string;
  walletId: string;
  bitgoBaseAddress?: Address;
  receiveAddress: Address;
  amount: string;
  tokenSymbol: string;
  tokenAddress: Address;
  chainId: number;
  coin: string;
  rail: "bitgo";
  status: CheckoutStatus;
  expiresAt: string;
  customerAddress?: Address;
  customerTxHash?: Hex;
  bitgoTransferId?: string;
  bitgoTxHash?: Hex;
  bitgoWebhookEventIds: string[];
  rawWebhookEvents: Array<Record<string, unknown>>;
  errorMessage?: string;
  createdAt: string;
  updatedAt: string;
}

interface StoreData {
  merchants: Record<string, MerchantRecord>;
  checkouts: Record<string, CheckoutRecord>;
}

const EMPTY_STORE: StoreData = {
  merchants: {},
  checkouts: {},
};

export class JsonStore {
  private readonly filePath: string;
  private queue = Promise.resolve();

  constructor(filePath: string) {
    this.filePath = resolve(filePath);
  }

  private async ensureFile() {
    await mkdir(dirname(this.filePath), { recursive: true });

    try {
      await readFile(this.filePath, "utf8");
    } catch {
      await writeFile(this.filePath, JSON.stringify(EMPTY_STORE, null, 2), "utf8");
    }
  }

  private async readData(): Promise<StoreData> {
    await this.ensureFile();
    const raw = await readFile(this.filePath, "utf8");

    if (!raw.trim()) {
      return EMPTY_STORE;
    }

    try {
      const parsed = JSON.parse(raw) as StoreData;
      return {
        merchants: parsed.merchants ?? {},
        checkouts: parsed.checkouts ?? {},
      };
    } catch {
      return EMPTY_STORE;
    }
  }

  private async writeData(data: StoreData) {
    await this.ensureFile();
    await writeFile(this.filePath, JSON.stringify(data, null, 2), "utf8");
  }

  async read(): Promise<StoreData> {
    return this.readData();
  }

  async transact<T>(updater: (data: StoreData) => Promise<T> | T): Promise<T> {
    const run = async () => {
      const data = await this.readData();
      const result = await updater(data);
      await this.writeData(data);
      return result;
    };

    const next = this.queue.then(run, run);
    this.queue = next.then(
      () => undefined,
      () => undefined,
    );
    return next;
  }
}
