import {
  NativeEventEmitter,
  NativeModules,
  type EmitterSubscription,
} from "react-native";
import type { Address } from "viem";
import {
  parseProtocolMessage,
  type PublishedPaymentRequest,
  type MerchantPaymentRequestMessage,
  type MerchantBitGoPaymentRequestMessage,
} from "./protocol";
import {
  assertNativeModuleMethod,
  getNativeModuleError,
} from "./native-module";

const { NfcReaderModule } = NativeModules;

function assertReaderMethod(methodName: string) {
  assertNativeModuleMethod("NfcReaderModule", NfcReaderModule, methodName);
}

/**
 * Merchant payment request received via NFC
 * Used when paying a merchant (POS)
 */
export interface MerchantPaymentRequest {
  sessionId: string;
  requestId: string;
  merchantAddress: Address;
  amount: bigint;
  tokenAddress: Address;
  chainId: number;
  verifyingContract: Address;
  deadline: number;
  nonce: bigint;
  merchantName?: string;
}

export interface MerchantBitGoPaymentRequest {
  sessionId: string;
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

function parsePublishedPaymentRequest(payload: string): PublishedPaymentRequest | null {
  const message = parseProtocolMessage(payload);
  if (!message || message.kind !== "PAYMENT_REQUEST") {
    return null;
  }

  // Determine if this is P2P (ensName required) or legacy (recipientAddress required)
  const isP2P = message.ensName && !message.recipientAddress;

  if (isP2P) {
    // P2P format: ensName is required, recipientAddress is not included
    return {
      sessionId: message.sessionId,
      requestId: message.requestId,
      ensName: message.ensName!,
      amountHint: message.amountHint,
      profileVersion: message.profileVersion,
    };
  }

  // Legacy format: recipientAddress is required
  if (!message.recipientAddress) {
    return null;
  }

  return {
    sessionId: message.sessionId,
    requestId: message.requestId,
    recipientAddress: message.recipientAddress,
    ensName: message.ensName,
    displayName: message.displayName,
    amountHint: message.amountHint,
    preferredChains: message.preferredChains,
    preferredTokens: message.preferredTokens,
    profileVersion: message.profileVersion,
    mode: message.mode,
  };
}

function parseMerchantPaymentRequest(payload: string): MerchantPaymentRequest | null {
  const message = parseProtocolMessage(payload);
  if (!message || message.kind !== "MERCHANT_PAYMENT_REQUEST") {
    return null;
  }

  return {
    sessionId: message.sessionId,
    requestId: message.requestId,
    merchantAddress: message.merchantAddress,
    amount: BigInt(message.amount),
    tokenAddress: message.tokenAddress,
    chainId: message.chainId,
    verifyingContract: message.verifyingContract,
    deadline: message.deadline,
    nonce: BigInt(message.nonce),
    merchantName: message.merchantName,
  };
}

function parseMerchantBitGoPaymentRequest(payload: string): MerchantBitGoPaymentRequest | null {
  const message = parseProtocolMessage(payload);
  if (!message || message.kind !== "MERCHANT_BITGO_PAYMENT_REQUEST") {
    return null;
  }

  return {
    sessionId: message.sessionId,
    checkoutId: message.checkoutId,
    requestId: message.requestId,
    receiveAddress: message.receiveAddress,
    amount: BigInt(message.amount),
    tokenSymbol: message.tokenSymbol,
    tokenAddress: message.tokenAddress,
    chainId: message.chainId,
    expiresAt: message.expiresAt,
    merchantName: message.merchantName,
    rail: message.rail,
  };
}

const NFC_READER_EVENTS = {
  PAYMENT_REQUEST: "onPaymentRequest",
  ERROR: "onError",
} as const;

/**
 * Union type for all payment request types
 */
export type AnyPaymentRequest = PublishedPaymentRequest | MerchantPaymentRequest;

export const NfcReader = {
  isSupported: (): Promise<boolean> => {
    assertReaderMethod("isNfcSupported");
    return NfcReaderModule.isNfcSupported();
  },

  isEnabled: (): Promise<boolean> => {
    assertReaderMethod("isNfcEnabled");
    return NfcReaderModule.isNfcEnabled();
  },

  setScanSession: async (sessionId: string): Promise<string> => {
    assertReaderMethod("setScanSession");
    return NfcReaderModule.setScanSession(sessionId);
  },

  clearScanSession: async (): Promise<string> => {
    assertReaderMethod("clearScanSession");
    return NfcReaderModule.clearScanSession();
  },

  sendPaymentIntent: async (payload: string): Promise<string> => {
    assertReaderMethod("sendPaymentIntent");
    return NfcReaderModule.sendPaymentIntent(payload);
  },

  sendMerchantAuthorization: async (payload: string): Promise<string> => {
    assertReaderMethod("sendMerchantAuthorization");
    return NfcReaderModule.sendMerchantAuthorization(payload);
  },

  startReader: async (): Promise<string> => {
    assertReaderMethod("startReader");
    return NfcReaderModule.startReader();
  },

  stopReader: async (): Promise<string> => {
    assertReaderMethod("stopReader");
    return NfcReaderModule.stopReader();
  },
};

const nfcReaderEmitter = NfcReaderModule ? new NativeEventEmitter(NfcReaderModule) : null;

export const NfcReaderEvents = {
  onPaymentRequest: (
    callback: (payload: PublishedPaymentRequest) => void,
  ): EmitterSubscription | null => {
    if (!nfcReaderEmitter) {
      console.error(getNativeModuleError("NfcReaderModule"));
      return null;
    }

    return nfcReaderEmitter.addListener(NFC_READER_EVENTS.PAYMENT_REQUEST, (data: string) => {
      const request = parsePublishedPaymentRequest(data);
      if (!request) {
        console.error("Failed to parse NFC payment request");
        return;
      }

      callback(request);
    });
  },

  /**
   * Listen for merchant payment requests (POS tap-to-pay)
   */
  onMerchantPaymentRequest: (
    callback: (payload: MerchantPaymentRequest) => void,
  ): EmitterSubscription | null => {
    if (!nfcReaderEmitter) {
      console.error(getNativeModuleError("NfcReaderModule"));
      return null;
    }

    return nfcReaderEmitter.addListener(NFC_READER_EVENTS.PAYMENT_REQUEST, (data: string) => {
      const request = parseMerchantPaymentRequest(data);
      if (!request) {
        // Not a merchant request, ignore (might be P2P request)
        return;
      }

      callback(request);
    });
  },

  onMerchantBitGoPaymentRequest: (
    callback: (payload: MerchantBitGoPaymentRequest) => void,
  ): EmitterSubscription | null => {
    if (!nfcReaderEmitter) {
      console.error(getNativeModuleError("NfcReaderModule"));
      return null;
    }

    return nfcReaderEmitter.addListener(NFC_READER_EVENTS.PAYMENT_REQUEST, (data: string) => {
      const request = parseMerchantBitGoPaymentRequest(data);
      if (!request) {
        return;
      }

      callback(request);
    });
  },

  onError: (callback: (message: string) => void): EmitterSubscription | null => {
    if (!nfcReaderEmitter) {
      console.error(getNativeModuleError("NfcReaderModule"));
      return null;
    }

    return nfcReaderEmitter.addListener(NFC_READER_EVENTS.ERROR, callback);
  },
};
