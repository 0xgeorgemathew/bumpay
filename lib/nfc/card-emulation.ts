import {
  NativeEventEmitter,
  NativeModules,
  type EmitterSubscription,
} from "react-native";
import {
  assertNativeModuleMethod,
  getNativeModuleError,
} from "./native-module";

const { CardEmulationModule } = NativeModules;

function assertCardEmulationMethod(methodName: string) {
  assertNativeModuleMethod("CardEmulationModule", CardEmulationModule, methodName);
}

export interface CardState {
  isReady: boolean;
  sessionId: string;
  hasPaymentRequest: boolean;
  hasPaymentIntent: boolean;
  errorMessage: string;
  lastCommand: string;
  isMerchantMode: boolean;
  hasPaymentAuthorization: boolean;
}

const CARD_EMULATION_EVENTS = {
  CARD_STATE_CHANGED: "onCardStateChanged",
} as const;

export const CardEmulation = {
  setReady: async (ready: boolean): Promise<string> => {
    assertCardEmulationMethod("setReady");
    return CardEmulationModule.setReady(ready);
  },

  setPaymentRequest: async (payload: string): Promise<string> => {
    assertCardEmulationMethod("setPaymentRequest");
    return CardEmulationModule.setPaymentRequest(payload);
  },

  clearPaymentRequest: async (): Promise<string> => {
    assertCardEmulationMethod("clearPaymentRequest");
    return CardEmulationModule.clearPaymentRequest();
  },

  getPaymentIntent: async (): Promise<string | null> => {
    assertCardEmulationMethod("getPaymentIntent");
    return CardEmulationModule.getPaymentIntent();
  },

  clearPaymentIntent: async (): Promise<string> => {
    assertCardEmulationMethod("clearPaymentIntent");
    return CardEmulationModule.clearPaymentIntent();
  },

  // ============ Merchant Mode Methods ============

  setMerchantMode: async (enabled: boolean): Promise<string> => {
    assertCardEmulationMethod("setMerchantMode");
    return CardEmulationModule.setMerchantMode(enabled);
  },

  getPaymentAuthorization: async (): Promise<string | null> => {
    assertCardEmulationMethod("getPaymentAuthorization");
    return CardEmulationModule.getPaymentAuthorization();
  },

  clearPaymentAuthorization: async (): Promise<string> => {
    assertCardEmulationMethod("clearPaymentAuthorization");
    return CardEmulationModule.clearPaymentAuthorization();
  },

  startListening: async (): Promise<string> => {
    assertCardEmulationMethod("startListening");
    return CardEmulationModule.startListening();
  },

  stopListening: async (): Promise<string> => {
    assertCardEmulationMethod("stopListening");
    return CardEmulationModule.stopListening();
  },
};

const cardEmulationEmitter = CardEmulationModule
  ? new NativeEventEmitter(CardEmulationModule)
  : null;

export const CardEmulationEvents = {
  onStateChanged: (
    callback: (state: CardState) => void,
  ): EmitterSubscription | null => {
    if (!cardEmulationEmitter) {
      console.error(getNativeModuleError("CardEmulationModule"));
      return null;
    }

    return cardEmulationEmitter.addListener(
      CARD_EMULATION_EVENTS.CARD_STATE_CHANGED,
      callback,
    );
  },
};
