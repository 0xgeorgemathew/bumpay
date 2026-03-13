#!/usr/bin/env bun
import { $ } from "bun";
import { existsSync, mkdirSync } from "fs";
import { join } from "path";

const NETWORKS: Record<
  string,
  { rpc: string; keystore: string; chainId: number }
> = {
  localhost: {
    rpc: "http://127.0.0.1:8545",
    keystore: "anvilKey0",
    chainId: 31337,
  },
  "base-sepolia": {
    rpc: "https://sepolia.base.org",
    keystore: "sepolia-deployer",
    chainId: 84532,
  },
};

function parseArgs(): { network: string } {
  const args = process.argv.slice(2);
  let network = "localhost";

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--network" || args[i] === "-n") {
      network = args[++i];
    }
  }

  return { network };
}

// Small delay to ensure broadcast files are fully written
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function deploy() {
  console.log("\n🚀 NFC Payment Contract Deployment\n");

  const { network } = parseArgs();
  const config = NETWORKS[network];

  if (!config) {
    console.log(`❌ Unknown network: ${network}`);
    console.log(`Available networks: ${Object.keys(NETWORKS).join(", ")}`);
    process.exit(1);
  }

  console.log(`Network: ${network}`);
  console.log(`Chain ID: ${config.chainId}`);
  console.log(`RPC: ${config.rpc}`);
  console.log(`Keystore: ${config.keystore}\n`);

  // Ensure deployments directory exists (for forge writeJson)
  const deploymentsDir = join(process.cwd(), "deployments");
  if (!existsSync(deploymentsDir)) {
    mkdirSync(deploymentsDir, { recursive: true });
  }

  // Build first
  console.log("📦 Building contracts...\n");
  try {
    await $`forge build`.quiet();
  } catch {
    console.log("❌ Build failed");
    process.exit(1);
  }

  // Deploy with cast wallet (prompts for password)
  console.log("📤 Deploying contracts...\n");
  try {
    await $`forge script script/Deploy.s.sol --rpc-url ${config.rpc} --account ${config.keystore} --broadcast --ffi`;
  } catch (error) {
    // Check if broadcast actually happened (forge may fail on writeJson but contracts deployed)
    const broadcastDir = join(
      process.cwd(),
      "broadcast",
      "Deploy.s.sol",
      String(config.chainId),
    );
    if (!existsSync(broadcastDir)) {
      console.log("❌ Deployment failed");
      process.exit(1);
    }
    console.log(
      "⚠️  Forge exited with error but broadcast exists, continuing...\n",
    );
  }

  // Small delay to ensure broadcast JSON is fully flushed to disk
  await delay(500);

  // Generate ABIs by running as a separate process (avoids module caching)
  console.log("\n📦 Generating TypeScript ABIs...\n");
  await $`bun run ${join(process.cwd(), "scripts-js", "generateTsAbis.ts")}`;

  console.log("✅ Deployment complete!\n");
}

deploy();
