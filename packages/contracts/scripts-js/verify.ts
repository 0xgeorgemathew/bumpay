#!/usr/bin/env bun
import { $ } from "bun";
import { existsSync, readdirSync, readFileSync } from "fs";
import { join } from "path";

const NETWORKS: Record<string, { rpcUrl: string; etherscanKey: string }> = {
  baseSepolia: {
    rpcUrl: "https://sepolia.base.org",
    etherscanKey: "BASESCAN_API_KEY",
  },
};

function parseArgs(): { network: string } {
  const args = process.argv.slice(2);
  let network = "baseSepolia";

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--network" || args[i] === "-n") {
      network = args[++i];
    }
  }

  return { network };
}

interface Transaction {
  transactionType: string;
  contractName: string;
  contractAddress: string;
}

interface BroadcastRun {
  chain: number;
  transactions: Transaction[];
}

function findLatestRunFile(chainId: string): string | null {
  const broadcastDir = join(
    process.cwd(),
    "broadcast",
    "Deploy.s.sol",
    chainId,
  );

  if (!existsSync(broadcastDir)) {
    return null;
  }

  const runFiles = readdirSync(broadcastDir)
    .filter((f) => f.startsWith("run-") && f.endsWith(".json"))
    .sort()
    .reverse();

  return runFiles.length > 0 ? join(broadcastDir, runFiles[0]) : null;
}

async function verify() {
  console.log("\n🔍 Verifying deployed contracts\n");

  const { network } = parseArgs();
  const networkConfig = NETWORKS[network];

  if (!networkConfig) {
    console.log(`❌ Unknown network: ${network}`);
    console.log(`Available networks: ${Object.keys(NETWORKS).join(", ")}`);
    process.exit(1);
  }

  const apiKey = process.env[networkConfig.etherscanKey];
  if (!apiKey) {
    console.log(
      `❌ ${networkConfig.etherscanKey} environment variable not set`,
    );
    process.exit(1);
  }

  // Find the latest broadcast for this network
  // Map network names to chain IDs
  const chainIds: Record<string, string> = {
    baseSepolia: "84532",
    localhost: "31337",
  };

  const chainId = chainIds[network];
  if (!chainId) {
    console.log(`❌ Unknown chain ID for network: ${network}`);
    process.exit(1);
  }

  const runFilePath = findLatestRunFile(chainId);
  if (!runFilePath) {
    console.log(`❌ No deployment broadcast found for chain ${chainId}`);
    console.log("Run deployment first: bun run deploy --network " + network);
    process.exit(1);
  }

  const runData: BroadcastRun = JSON.parse(readFileSync(runFilePath, "utf-8"));
  const contracts = runData.transactions.filter(
    (tx) => tx.transactionType === "CREATE" && tx.contractName,
  );

  if (contracts.length === 0) {
    console.log("❌ No CREATE transactions found in broadcast");
    process.exit(1);
  }

  console.log(`Found ${contracts.length} contracts to verify:\n`);

  let verified = 0;
  for (const contract of contracts) {
    console.log(
      `Verifying ${contract.contractName} at ${contract.contractAddress}...`,
    );

    try {
      await $`forge verify-contract ${contract.contractAddress} ${contract.contractName} --chain-id ${chainId} --etherscan-api-key ${apiKey} --watch --optimizer-runs 200`.quiet();
      console.log(`  ✅ Verified\n`);
      verified++;
    } catch (error) {
      console.log(`  ⚠️  Verification failed (may already be verified)\n`);
    }
  }

  console.log(`✅ Verified ${verified}/${contracts.length} contracts\n`);
}

verify();
