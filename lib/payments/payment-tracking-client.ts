import { createPublicClient, http, webSocket } from "viem";
import { baseSepolia } from "viem/chains";

const BASE_SEPOLIA_HTTP_URL =
  "https://base-sepolia.g.alchemy.com/v2/M5m4J4YYl1se_c6UjF3mx";
const BASE_SEPOLIA_WS_URL =
  "wss://base-sepolia.g.alchemy.com/v2/M5m4J4YYl1se_c6UjF3mx";

const paymentTrackingPollingClient = createPublicClient({
  chain: baseSepolia,
  pollingInterval: 1_000,
  transport: http(BASE_SEPOLIA_HTTP_URL),
});

const paymentTrackingRealtimeClient = createPublicClient({
  chain: baseSepolia,
  transport: webSocket(BASE_SEPOLIA_WS_URL, {
    reconnect: true,
  }),
});

export function getPaymentTrackingClient() {
  return paymentTrackingPollingClient;
}

export function getPaymentTrackingPollingClient() {
  return paymentTrackingPollingClient;
}

export function getPaymentTrackingRealtimeClient() {
  return paymentTrackingRealtimeClient;
}
