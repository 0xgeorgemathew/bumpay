import * as Speech from 'expo-speech';

/**
 * Announce a received payment via text-to-speech
 */
export function announcePaymentReceived(amount: string, token: string) {
  const message = `${amount} ${token} Received on Bump Pay`;
  Speech.speak(message, { rate: 0.9 });
}

/**
 * Announce a received payment via text-to-speech (async version)
 * Resolves when speech is complete or on error
 */
export async function announcePaymentReceivedAsync(
  amount: string,
  token: string
): Promise<void> {
  return new Promise((resolve) => {
    const message = `${amount} ${token} Received on Bump Pay`;
    Speech.speak(message, {
      rate: 0.9,
      onDone: () => resolve(),
      onError: () => resolve(),
    });
  });
}
