import { NativeModules } from "react-native";

const { AudioFeedbackModule } = NativeModules as {
  AudioFeedbackModule?: {
    playNfcComplete: () => Promise<string>;
    playNfcDone: () => Promise<string>;
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

async function play(method: "playNfcComplete" | "playNfcDone" | "playPaymentSuccess") {
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

export function playNfcDoneSound() {
  return play("playNfcDone");
}

export function playPaymentSuccessSound() {
  return play("playPaymentSuccess");
}

export async function playPaymentSuccessSoundAsync() {
  if (!AudioFeedbackModule?.playPaymentSuccess) {
    warnMissingModule();
    return;
  }
  try {
    await AudioFeedbackModule.playPaymentSuccess();
    // Wait for sound to complete
    await new Promise((resolve) => setTimeout(resolve, 800));
  } catch (error) {
    console.error("Failed to play payment success sound", error);
  }
}
