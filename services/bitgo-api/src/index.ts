import cors from "cors";
import dotenv from "dotenv";
import express from "express";
import { loadConfig } from "./config.js";
import { JsonStore } from "./store.js";
import { BitGoMerchantService } from "./bitgo-client.js";
import { createMerchantRouter } from "./routes/merchant.js";
import { createWebhookRouter } from "./routes/webhooks.js";

dotenv.config();

const config = loadConfig();
const store = new JsonStore(config.BITGO_STORE_FILE);
const service = new BitGoMerchantService(config, store);

const app = express();
app.use(cors());
app.use(express.json({ limit: "1mb" }));

app.get("/health", (_req, res) => {
  res.json({
    status: "ok",
    coin: config.BITGO_COIN,
    env: config.BITGO_ENV,
    chainId: config.MERCHANT_CHAIN_ID,
    timestamp: new Date().toISOString(),
  });
});

app.use("/api/bitgo/merchant", createMerchantRouter(service));
app.use("/api/bitgo/webhooks", createWebhookRouter(service));

app.listen(config.PORT, () => {
  console.log(`BitGo API server running on port ${config.PORT}`);
  console.log(`BitGo env: ${config.BITGO_ENV}`);
  console.log(`BitGo coin: ${config.BITGO_COIN}`);
});
