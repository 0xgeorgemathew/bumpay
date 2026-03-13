import { createPublicClient, webSocket } from "viem";
import { baseSepolia } from "viem/chains";

const BASE_SEPOLIA_WS_URL =
  "wss://base-sepolia.g.alchemy.com/v2/Op4w5u75JLigrxQiAs8av";

const paymentTrackingClient = createPublicClient({
  chain: baseSepolia,
  transport: webSocket(BASE_SEPOLIA_WS_URL, {
    reconnect: false,
  }),
});

export function getPaymentTrackingClient() {
  return paymentTrackingClient;
}
