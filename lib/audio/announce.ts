import * as Speech from 'expo-speech';

/**
 * PhonePe-style TTS options
 * - Fast, energetic pace
 * - Higher pitch for excitement
 * - Indian English accent
 */
const PHONEPE_TTS_OPTIONS: Speech.SpeechOptions = {
  rate: 1.0, // PhonePe-style fast pace
  pitch: 1.1, // Slightly higher pitch for energy
  language: "en-IN", // Indian English accent
};

/**
 * Announce a received payment via text-to-speech (PhonePe style)
 */
export function announcePaymentReceived(amount: string, token: string) {
  const message = `${amount} ${token} Received on Bump Wallet`;
  Speech.speak(message, PHONEPE_TTS_OPTIONS);
}

/**
 * Announce a received payment via text-to-speech (async version, PhonePe style)
 * Resolves when speech is complete or on error
 */
export async function announcePaymentReceivedAsync(
  amount: string,
  token: string
): Promise<void> {
  return new Promise((resolve) => {
    const message = `${amount} ${token} Received on Bump Wallet`;
    Speech.speak(message, {
      ...PHONEPE_TTS_OPTIONS,
      onDone: () => resolve(),
      onError: () => resolve(),
    });
  });
}
