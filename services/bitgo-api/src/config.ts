import { z } from "zod";

const configSchema = z.object({
  PORT: z.coerce.number().default(3002),
  BITGO_ENV: z.enum(["test", "prod"]).default("test"),
  BITGO_ACCESS_TOKEN: z.string().min(1),
  BITGO_ENTERPRISE_ID: z.string().min(1),
  BITGO_COIN: z.string().default("tbaseeth"),
  BITGO_WALLET_LABEL_PREFIX: z.string().default("Bump Merchant"),
  BITGO_WALLET_PASSPHRASE: z.string().min(1),
  BITGO_WEBHOOK_PUBLIC_URL: z.string().url().optional(),
  BITGO_WEBHOOK_SECRET: z.string().optional(),
  BITGO_MERCHANT_TOKEN_NAME: z.string().optional(),
  BITGO_REQUIRE_APPROVAL_USD: z.coerce.number().default(100),
  BITGO_DAILY_WITHDRAWAL_LIMIT_USD: z.coerce.number().default(1000),
  MERCHANT_ASSET_SYMBOL: z.string().default("USDC"),
  MERCHANT_CHAIN_ID: z.coerce.number().default(84532),
  MERCHANT_TOKEN_ADDRESS: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
  BASE_SEPOLIA_RPC_URL: z.string().url().default("https://sepolia.base.org"),
  BITGO_STORE_FILE: z.string().default("./data/bitgo-store.json"),
});

export type Config = z.infer<typeof configSchema>;

export function loadConfig(): Config {
  return configSchema.parse({
    PORT: process.env.PORT,
    BITGO_ENV: process.env.BITGO_ENV,
    BITGO_ACCESS_TOKEN: process.env.BITGO_ACCESS_TOKEN,
    BITGO_ENTERPRISE_ID: process.env.BITGO_ENTERPRISE_ID,
    BITGO_COIN: process.env.BITGO_COIN,
    BITGO_WALLET_LABEL_PREFIX: process.env.BITGO_WALLET_LABEL_PREFIX,
    BITGO_WALLET_PASSPHRASE: process.env.BITGO_WALLET_PASSPHRASE,
    BITGO_WEBHOOK_PUBLIC_URL: process.env.BITGO_WEBHOOK_PUBLIC_URL,
    BITGO_WEBHOOK_SECRET: process.env.BITGO_WEBHOOK_SECRET,
    BITGO_MERCHANT_TOKEN_NAME: process.env.BITGO_MERCHANT_TOKEN_NAME,
    BITGO_REQUIRE_APPROVAL_USD: process.env.BITGO_REQUIRE_APPROVAL_USD,
    BITGO_DAILY_WITHDRAWAL_LIMIT_USD: process.env.BITGO_DAILY_WITHDRAWAL_LIMIT_USD,
    MERCHANT_ASSET_SYMBOL: process.env.MERCHANT_ASSET_SYMBOL,
    MERCHANT_CHAIN_ID: process.env.MERCHANT_CHAIN_ID,
    MERCHANT_TOKEN_ADDRESS: process.env.MERCHANT_TOKEN_ADDRESS,
    BASE_SEPOLIA_RPC_URL: process.env.BASE_SEPOLIA_RPC_URL,
    BITGO_STORE_FILE: process.env.BITGO_STORE_FILE,
  });
}
