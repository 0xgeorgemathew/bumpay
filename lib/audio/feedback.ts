import { NativeModules } from "react-native";

const { AudioFeedbackModule } = NativeModules as {
  AudioFeedbackModule?: {
    playNfcComplete: () => Promise<string>;
    playNfcDone: () => Promise<string>;
    playPaymentSuccess: () => Promise<string>;
    playDisconnectBeep: () => Promise<string>;
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

async function play(method: "playNfcComplete" | "playNfcDone" | "playPaymentSuccess" | "playDisconnectBeep") {
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

export function playDisconnectBeep() {
  return play("playDisconnectBeep");
}

export async function playDisconnectBeepAsync() {
  if (!AudioFeedbackModule?.playDisconnectBeep) {
    warnMissingModule();
    return;
  }
  try {
    await AudioFeedbackModule.playDisconnectBeep();
    // Wait for beep + small gap before next sound
    await new Promise((resolve) => setTimeout(resolve, 250));
  } catch (error) {
    console.error("Failed to play disconnect beep", error);
  }
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
    // No artificial delay - sound plays immediately
  } catch (error) {
    console.error("Failed to play payment success sound", error);
  }
}
