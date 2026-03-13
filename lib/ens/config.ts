/**
 * ENS configuration for Bump P2P payments
 *
 * All ENS-related constants are centralized here for easy migration
 * from grid.eth to bump.eth through configuration changes only.
 */

import type { Address } from "viem";
import { CHAIN_ID } from "../blockchain/contracts";

// =============================================================================
// Domain Configuration
// =============================================================================

/**
 * Parent domain for Bump ENS subdomains
 * Change this to "bump.eth" when ready to migrate
 */
export const ENS_PARENT_DOMAIN = "grid.eth";

/**
 * Chain ID for ENS operations (Base Sepolia)
 */
export const ENS_CHAIN_ID = CHAIN_ID;

// =============================================================================
// Contract Addresses (Base Sepolia)
// =============================================================================

/**
 * ENS L2 Registrar address on Base Sepolia
 * Handles subdomain registration under the parent domain
 */
export const ENS_REGISTRAR_ADDRESS: Address = "0x85465BBfF2b825481E67A7F1C9eB309e693814E7";

/**
 * ENS L2 Registry address on Base Sepolia
 * Handles text record storage and resolution
 */
export const ENS_REGISTRY_ADDRESS: Address = "0xef46c8e7876f8a84e4b4f7e1a641fa6497bd532d";

// =============================================================================
// Text Record Keys
// =============================================================================

/**
 * Bump-specific ENS text record keys
 * Using "bump." prefix ensures app ownership, not domain ownership
 */
export const ENS_TEXT_KEYS = {
  /** Profile schema version */
  PROFILE_VERSION: "bump.profile.version",
  /** Mode: p2p, merchant, or both */
  MODE: "bump.mode",
  /** Default chain ID for receiving payments */
  DEFAULT_CHAIN: "bump.default.chain",
  /** Default token address for receiving payments */
  DEFAULT_TOKEN: "bump.default.token",
} as const;

export type EnsTextKey = (typeof ENS_TEXT_KEYS)[keyof typeof ENS_TEXT_KEYS];

/**
 * All Bump text record keys as an array
 */
export const ALL_ENS_TEXT_KEYS: readonly EnsTextKey[] = [
  ENS_TEXT_KEYS.PROFILE_VERSION,
  ENS_TEXT_KEYS.MODE,
  ENS_TEXT_KEYS.DEFAULT_CHAIN,
  ENS_TEXT_KEYS.DEFAULT_TOKEN,
];

// =============================================================================
// Supported Values
// =============================================================================

/**
 * Supported ENS profile modes
 */
export const ENS_MODE_OPTIONS = ["p2p", "merchant", "both"] as const;
export type EnsMode = (typeof ENS_MODE_OPTIONS)[number];

/**
 * Current profile schema version
 */
export const ENS_PROFILE_VERSION = "1" as const;

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Normalizes a label (subdomain part) for ENS
 * - Lowercase
 * - Trimmed
 * - No parent domain suffix
 */
export function normalizeEnsLabel(label: string): string {
  const normalized = label.trim().toLowerCase();
  const parentSuffix = `.${ENS_PARENT_DOMAIN.toLowerCase()}`;

  if (normalized.endsWith(parentSuffix)) {
    return normalized.slice(0, -parentSuffix.length);
  }

  if (normalized.endsWith(".eth")) {
    return normalized.slice(0, -".eth".length);
  }

  return normalized;
}

/**
 * Formats a full ENS name from a label
 * - Uses configured parent domain
 * - Returns empty string if label is empty
 */
export function formatFullEnsName(label: string): string {
  const normalized = normalizeEnsLabel(label);
  if (!normalized) {
    return "";
  }
  return `${normalized}.${ENS_PARENT_DOMAIN}`;
}

/**
 * Extracts the label from a full ENS name
 * Returns null if the name doesn't match the parent domain
 */
export function extractLabelFromEnsName(fullName: string): string | null {
  const normalized = fullName.trim().toLowerCase();
  const suffix = `.${ENS_PARENT_DOMAIN.toLowerCase()}`;

  if (normalized.endsWith(suffix)) {
    return normalized.slice(0, -suffix.length);
  }

  // Also handle plain labels
  if (!normalized.includes(".")) {
    return normalized;
  }

  return null;
}

/**
 * Validates a label for ENS registration
 * Returns null if valid, or an error message if invalid
 */
export function validateEnsLabel(label: string): string | null {
  const normalized = normalizeEnsLabel(label);

  if (!normalized) {
    return "Username is required";
  }

  if (normalized.length < 3) {
    return "Username must be at least 3 characters";
  }

  if (normalized.length > 64) {
    return "Username must be at most 64 characters";
  }

  // ENS labels can only contain letters, numbers, and hyphens
  if (!/^[a-z0-9-]+$/.test(normalized)) {
    return "Username can only contain lowercase letters, numbers, and hyphens";
  }

  // Cannot start or end with hyphen
  if (normalized.startsWith("-") || normalized.endsWith("-")) {
    return "Username cannot start or end with a hyphen";
  }

  return null;
}
