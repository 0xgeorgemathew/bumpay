/**
 * ENS Service Layer
 *
 * Provides read and write operations for ENS on Base Sepolia.
 * Read operations use a public client directly.
 * Write operations require a wallet client to be passed in.
 */

import { createPublicClient, encodeFunctionData, http, zeroAddress, type Address, type Hex } from "viem";
import { baseSepolia } from "viem/chains";
import { CHAIN_ID, isSupportedPaymentToken } from "../blockchain/contracts";
import {
  ENS_PARENT_DOMAIN,
  ENS_TEXT_KEYS,
  ENS_REGISTRAR_ADDRESS,
  ENS_REGISTRY_ADDRESS,
  extractLabelFromEnsName,
  formatFullEnsName,
  normalizeEnsLabel,
  type EnsMode,
} from "./config";
import {
  ENS_REGISTRAR_ABI,
  ENS_REGISTRY_ABI,
} from "./contracts";
import {
  type BumpEnsProfile,
  buildBumpTextRecordUpdates,
  normalizeBumpEnsProfile,
  DEFAULT_BUMP_ENS_PROFILE,
} from "./bump-ens";

// =============================================================================
// Public Client Setup
// =============================================================================

const publicClient = createPublicClient({
  chain: baseSepolia,
  transport: http(),
});

// =============================================================================
// Read Operations
// =============================================================================

/**
 * Result of checking ENS claim status
 */
export interface EnsClaimStatus {
  /** Whether the address has an ENS name claimed */
  hasClaim: boolean;
  /** Full ENS name if claimed (e.g., "alice.bump.eth") */
  fullName: string | null;
  /** Just the label if claimed (e.g., "alice") */
  label: string | null;
}

/**
 * Check if an address has an ENS name claimed
 * Uses the registrar's reverse lookup
 */
export async function getEnsClaimStatus(address: Address): Promise<EnsClaimStatus> {
  try {
    const fullName = await (publicClient.readContract({
      address: ENS_REGISTRAR_ADDRESS,
      abi: ENS_REGISTRAR_ABI,
      functionName: "getFullName",
      args: [address],
    }) as Promise<string>);

    if (!fullName || fullName.trim() === "") {
      return { hasClaim: false, fullName: null, label: null };
    }

    const label = extractLabelFromEnsName(fullName);
    if (!label) {
      console.warn(
        `Ignoring ENS claim outside ${ENS_PARENT_DOMAIN}: ${fullName} for ${address}`,
      );
      return { hasClaim: false, fullName: null, label: null };
    }

    return {
      hasClaim: true,
      fullName: formatFullEnsName(label),
      label,
    };
  } catch (error) {
    console.error("Failed to check ENS claim status:", error);
    return { hasClaim: false, fullName: null, label: null };
  }
}

/**
 * Check if a label is available for registration
 */
export async function checkLabelAvailability(label: string): Promise<boolean> {
  const normalized = normalizeEnsLabel(label);
  if (!normalized) {
    return false;
  }

  try {
    const isAvailable = await (publicClient.readContract({
      address: ENS_REGISTRAR_ADDRESS,
      abi: ENS_REGISTRAR_ABI,
      functionName: "available",
      args: [normalized],
    }) as Promise<boolean>);

    return isAvailable;
  } catch (error) {
    console.error("Failed to check label availability:", error);
    return false;
  }
}

/**
 * Get the node (bytes32) for a label under the parent domain
 */
export async function getNodeForLabel(label: string): Promise<Hex | null> {
  const normalized = normalizeEnsLabel(label);
  if (!normalized) {
    return null;
  }

  try {
    // First get the base node
    const baseNode = await (publicClient.readContract({
      address: ENS_REGISTRY_ADDRESS,
      abi: ENS_REGISTRY_ABI,
      functionName: "baseNode",
      args: [],
    }) as Promise<Hex>);

    // Then derive the subdomain node
    const node = await (publicClient.readContract({
      address: ENS_REGISTRY_ADDRESS,
      abi: ENS_REGISTRY_ABI,
      functionName: "makeNode",
      args: [baseNode, normalized],
    }) as Promise<Hex>);

    return node;
  } catch (error) {
    console.error("Failed to get node for label:", error);
    return null;
  }
}

/**
 * Read the ENS NFT owner for a node.
 */
export async function getNodeOwner(node: Hex): Promise<Address | null> {
  try {
    const owner = await (publicClient.readContract({
      address: ENS_REGISTRY_ADDRESS,
      abi: ENS_REGISTRY_ABI,
      functionName: "owner",
      args: [node],
    }) as Promise<Address>);

    if (!owner || owner.toLowerCase() === zeroAddress.toLowerCase()) {
      return null;
    }

    return owner;
  } catch (error) {
    console.error("Failed to read ENS node owner:", error);
    return null;
  }
}

/**
 * Read a single text record from ENS
 */
export async function readTextRecord(node: Hex, key: string): Promise<string> {
  try {
    const value = await (publicClient.readContract({
      address: ENS_REGISTRY_ADDRESS,
      abi: ENS_REGISTRY_ABI,
      functionName: "text",
      args: [node, key],
    }) as Promise<string>);

    return value;
  } catch (error) {
    console.error(`Failed to read text record ${key}:`, error);
    return "";
  }
}

/**
 * Read all Bump text records for a label
 */
export async function readEnsProfileByLabel(label: string): Promise<BumpEnsProfile | null> {
  const node = await getNodeForLabel(label);
  if (!node) {
    return null;
  }

  return readEnsProfileByNode(node, label);
}

/**
 * Read all Bump text records for a node
 */
export async function readEnsProfileByNode(node: Hex, label: string): Promise<BumpEnsProfile | null> {
  try {
    const [version, mode, chainStr, tokenStr] = await Promise.all([
      readTextRecord(node, ENS_TEXT_KEYS.PROFILE_VERSION),
      readTextRecord(node, ENS_TEXT_KEYS.MODE),
      readTextRecord(node, ENS_TEXT_KEYS.DEFAULT_CHAIN),
      readTextRecord(node, ENS_TEXT_KEYS.DEFAULT_TOKEN),
    ]);

    // If no records exist, return null
    if (!version && !mode && !chainStr && !tokenStr) {
      return null;
    }

    // Construct profile from individual records
    const ensName = formatFullEnsName(label);
    const chainId = chainStr ? parseInt(chainStr, 10) : undefined;
    const token = tokenStr && tokenStr.startsWith("0x") ? (tokenStr as Address) : undefined;

    return normalizeBumpEnsProfile({
      ensName,
      profileVersion: "1",
      mode: (mode || "p2p") as EnsMode,
      defaultAsset: chainId && token ? { chainId, token } : undefined,
    });
  } catch (error) {
    console.error("Failed to read ENS profile:", error);
    return null;
  }
}

/**
 * Resolve an ENS name to its address
 * Reads the address record from the registry
 */
export async function resolveEnsAddress(label: string): Promise<Address | null> {
  const node = await getNodeForLabel(label);
  if (!node) {
    return null;
  }

  try {
    const address = await (publicClient.readContract({
      address: ENS_REGISTRY_ADDRESS,
      abi: ENS_REGISTRY_ABI,
      functionName: "addr",
      args: [node],
    }) as Promise<Address>);

    if (!address || address.toLowerCase() === zeroAddress.toLowerCase()) {
      return null;
    }

    return address;
  } catch (error) {
    console.error("Failed to resolve ENS address:", error);
    return null;
  }
}

/**
 * Full ENS resolution for payment purposes
 * Returns address, profile, and validation status
 */
export interface ResolvedEnsProfile {
  ensName: string;
  label: string;
  address: Address;
  profile: BumpEnsProfile;
}

export async function resolveEnsForPayment(ensName: string): Promise<ResolvedEnsProfile | null> {
  const label = extractLabelFromEnsName(ensName);
  if (!label) {
    console.error(`Invalid ENS name format for ${ENS_PARENT_DOMAIN}:`, ensName);
    return null;
  }

  // Get node
  const node = await getNodeForLabel(label);
  if (!node) {
    return null;
  }

  // Resolve address and profile in parallel
  const [address, profile] = await Promise.all([
    resolveEnsAddress(label),
    readEnsProfileByNode(node, label),
  ]);

  if (!address) {
    console.error("No address resolved for ENS name:", ensName);
    return null;
  }

  // Use default profile if none found
  const resolvedProfile = profile || {
    ...DEFAULT_BUMP_ENS_PROFILE,
    ensName: formatFullEnsName(label),
  };

  const normalizedProfile = normalizeBumpEnsProfile(resolvedProfile);

  return {
    ensName: formatFullEnsName(label),
    label,
    address,
    profile: normalizedProfile,
  };
}

// =============================================================================
// Write Operations (Transaction Builders)
// =============================================================================

/**
 * Wallet client interface for write operations
 * Matches the Privy smart wallet client interface
 */
export interface WalletWriteClient {
  sendTransaction(args: { to: Address; data: Hex; value?: bigint }): Promise<Hex>;
}

/**
 * Prepare a register transaction
 * Returns encoded data for the registrar call
 */
export function prepareRegisterTransaction(label: string, owner: Address): {
  to: Address;
  data: Hex;
} {
  const normalized = normalizeEnsLabel(label);

  const data = encodeFunctionData({
    abi: ENS_REGISTRAR_ABI,
    functionName: "register",
    args: [normalized, owner],
  });

  return {
    to: ENS_REGISTRAR_ADDRESS,
    data,
  };
}

/**
 * Claim an ENS subdomain
 * Registers the label to the owner address
 */
export async function claimSubdomain(
  client: WalletWriteClient,
  label: string,
  owner: Address,
): Promise<Hex> {
  const { to, data } = prepareRegisterTransaction(label, owner);
  return client.sendTransaction({ to, data });
}

/**
 * Prepare a setText transaction
 * Returns encoded data for the registry call
 */
export function prepareSetTextTransaction(node: Hex, key: string, value: string): {
  to: Address;
  data: Hex;
} {
  const data = encodeFunctionData({
    abi: ENS_REGISTRY_ABI,
    functionName: "setText",
    args: [node, key, value],
  });

  return {
    to: ENS_REGISTRY_ADDRESS,
    data,
  };
}

/**
 * Write a single text record
 */
export async function writeTextRecord(
  client: WalletWriteClient,
  node: Hex,
  key: string,
  value: string,
): Promise<Hex> {
  const { to, data } = prepareSetTextTransaction(node, key, value);
  return client.sendTransaction({ to, data });
}

/**
 * Write all Bump text records for a profile
 * Returns transaction hashes for each write
 */
export async function writeEnsProfile(
  client: WalletWriteClient,
  node: Hex,
  profile: BumpEnsProfile,
): Promise<Hex[]> {
  const records = buildBumpTextRecordUpdates(profile);
  const txHashes: Hex[] = [];

  for (const record of records) {
    if (record.value) {
      const txHash = await writeTextRecord(client, node, record.key, record.value);
      txHashes.push(txHash);
    }
  }

  return txHashes;
}

// =============================================================================
// Validation Helpers
// =============================================================================

/**
 * Validate a resolved profile for payment
 * Returns null if valid, or an error message if invalid
 */
export function validateProfileForPayment(profile: BumpEnsProfile): string | null {
  // Check default asset exists
  if (!profile.defaultAsset) {
    return "Recipient has not set up payment preferences";
  }

  // Check chain is supported (Base Sepolia only for v1)
  if (profile.defaultAsset.chainId !== CHAIN_ID) {
    return `Unsupported chain: ${profile.defaultAsset.chainId}. Only Base Sepolia is supported.`;
  }

  if (!isSupportedPaymentToken(profile.defaultAsset.token)) {
    return "Settlement token must be a supported ERC-20 payment token";
  }

  return null;
}
