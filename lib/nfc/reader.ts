import {
  NativeEventEmitter,
  NativeModules,
  type EmitterSubscription,
} from "react-native";
import {
  parseProtocolMessage,
  type PublishedPaymentRequest,
} from "./protocol";
import {
  assertNativeModuleMethod,
  getNativeModuleError,
} from "./native-module";

const { NfcReaderModule } = NativeModules;

function assertReaderMethod(methodName: string) {
  assertNativeModuleMethod("NfcReaderModule", NfcReaderModule, methodName);
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

const NFC_READER_EVENTS = {
  PAYMENT_REQUEST: "onPaymentRequest",
  ERROR: "onError",
} as const;

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

  onError: (callback: (message: string) => void): EmitterSubscription | null => {
    if (!nfcReaderEmitter) {
      console.error(getNativeModuleError("NfcReaderModule"));
      return null;
    }

    return nfcReaderEmitter.addListener(NFC_READER_EVENTS.ERROR, callback);
  },
};
