import type { Address } from "viem";
import {
  PROTOCOL_VERSION,
  serializeProtocolMessage,
  type MerchantBitGoPaymentRequestMessage,
} from "../nfc/protocol";

export interface MerchantBitGoCheckoutSession {
  checkoutId: string;
  requestId: string;
  receiveAddress: Address;
  amount: bigint;
  tokenSymbol: string;
  tokenAddress: Address;
  chainId: number;
  expiresAt: number;
  merchantName?: string;
  rail: "bitgo";
}

export function buildMerchantBitGoPaymentRequestMessage(
  session: MerchantBitGoCheckoutSession,
): string {
  const message: MerchantBitGoPaymentRequestMessage = {
    version: PROTOCOL_VERSION,
    sessionId: session.checkoutId,
    kind: "MERCHANT_BITGO_PAYMENT_REQUEST",
    checkoutId: session.checkoutId,
    requestId: session.requestId,
    receiveAddress: session.receiveAddress,
    amount: session.amount.toString(),
    tokenSymbol: session.tokenSymbol,
    tokenAddress: session.tokenAddress,
    chainId: session.chainId,
    expiresAt: session.expiresAt,
    merchantName: session.merchantName,
    rail: "bitgo",
  };

  return serializeProtocolMessage(message);
}
