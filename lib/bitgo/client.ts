import type { Address, Hex } from "viem";

export type MerchantBitGoCheckoutStatus =
  | "initializing_address"
  | "ready"
  | "payment_broadcasted"
  | "deposit_detected"
  | "sweeping"
  | "settled"
  | "expired"
  | "failed";

export interface MerchantBitGoCheckout {
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
  status: MerchantBitGoCheckoutStatus;
  expiresAt: string;
  customerTxHash?: Hex;
  bitgoTransferId?: string;
  errorMessage?: string;
  createdAt: string;
  updatedAt: string;
}

export interface MerchantBitGoWithdrawalResult {
  txRequestId?: string;
  txid?: string;
  status?: string;
  appStatus?: "submitted" | "awaiting_signature" | "broadcasted" | "confirmed" | "failed";
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
}

export interface MerchantBitGoConsolidationResult {
  txid?: string;
  txHash?: string;
  hash?: string;
  success?: boolean;
  status?: string;
  result?: string;
}

export interface MerchantBitGoSummary {
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
}

interface ApiEnvelope<T> {
  success: boolean;
  data: T;
  message?: string;
}

interface ApiErrorEnvelope {
  success: false;
  error: string;
}

function getBaseUrl(): string {
  const baseUrl = process.env.EXPO_PUBLIC_BITGO_API_URL?.trim();

  if (!baseUrl) {
    throw new Error("Missing EXPO_PUBLIC_BITGO_API_URL");
  }

  return baseUrl.replace(/\/+$/, "");
}

async function request<T>(
  path: string,
  init?: RequestInit,
): Promise<T> {
  const response = await fetch(`${getBaseUrl()}${path}`, init);
  const payload = (await response.json()) as ApiEnvelope<T> | ApiErrorEnvelope;

  if (!response.ok) {
    throw new Error("error" in payload ? payload.error : `Request failed with ${response.status}`);
  }

  return (payload as ApiEnvelope<T>).data;
}

export async function createMerchantBitGoCheckout(params: {
  merchantAddress: Address;
  merchantName?: string;
  amount: string;
  tokenSymbol: string;
  tokenAddress: Address;
  chainId: number;
  expiresInSeconds?: number;
}): Promise<MerchantBitGoCheckout> {
  return request<MerchantBitGoCheckout>("/api/bitgo/merchant/checkouts", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(params),
  });
}

export async function getMerchantBitGoSummary(
  merchantAddress: Address,
): Promise<MerchantBitGoSummary> {
  const search = new URLSearchParams({ merchantAddress });
  return request<MerchantBitGoSummary>(`/api/bitgo/merchant/summary?${search.toString()}`);
}

export async function getMerchantBitGoCheckout(
  checkoutId: string,
): Promise<MerchantBitGoCheckout> {
  return request<MerchantBitGoCheckout>(`/api/bitgo/merchant/checkouts/${checkoutId}`);
}

export async function reportMerchantBitGoCustomerTransaction(params: {
  checkoutId: string;
  txHash: Hex;
  customerAddress: Address;
}): Promise<MerchantBitGoCheckout> {
  return request<MerchantBitGoCheckout>(
    `/api/bitgo/merchant/checkouts/${params.checkoutId}/customer-tx`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        txHash: params.txHash,
        customerAddress: params.customerAddress,
      }),
    },
  );
}

export async function withdrawMerchantBitGoFunds(params: {
  merchantAddress: Address;
  destinationAddress: Address;
  amount: string;
}): Promise<MerchantBitGoWithdrawalResult> {
  return request<MerchantBitGoWithdrawalResult>("/api/bitgo/merchant/withdrawals", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(params),
  });
}

export async function getMerchantBitGoWithdrawalStatus(params: {
  merchantAddress: Address;
  txRequestId?: string;
}): Promise<MerchantBitGoWithdrawalResult | null> {
  const search = new URLSearchParams({ merchantAddress: params.merchantAddress });
  if (params.txRequestId) {
    search.set("txRequestId", params.txRequestId);
  }

  return request<MerchantBitGoWithdrawalResult | null>(
    `/api/bitgo/merchant/withdrawals/status?${search.toString()}`,
  );
}

export async function consolidateMerchantBitGoFunds(params: {
  merchantAddress: Address;
}): Promise<MerchantBitGoConsolidationResult> {
  return request<MerchantBitGoConsolidationResult>("/api/bitgo/merchant/consolidate", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(params),
  });
}
