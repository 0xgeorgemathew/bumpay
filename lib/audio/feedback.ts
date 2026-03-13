import { NativeModules } from "react-native";

const { AudioFeedbackModule } = NativeModules as {
  AudioFeedbackModule?: {
    playNfcComplete: () => Promise<string>;
    playPaymentSuccess: () => Promise<string>;
  };
};

let hasWarnedMissingModule = false;

function warnMissingModule() {
  if (hasWarnedMissingModule) {
    return;
  }

  hasWarnedMissingModule = true;
  console.warn("AudioFeedbackModule is unavailable. Rebuild the Android app to enable sounds.");
}

async function play(method: "playNfcComplete" | "playPaymentSuccess") {
  if (!AudioFeedbackModule || typeof AudioFeedbackModule[method] !== "function") {
    warnMissingModule();
    return;
  }

  try {
    await AudioFeedbackModule[method]();
  } catch (error) {
    console.error(`Failed to play ${method} sound`, error);
  }
}

export function playNfcCompleteSound() {
  return play("playNfcComplete");
}

export function playPaymentSuccessSound() {
  return play("playPaymentSuccess");
}
