/**
 * ENS contract ABIs and typed helpers for Base Sepolia
 *
 * Verified contract surface from grid-games ENS deployment:
 * - ENS L2 Registrar: 0x85465BBfF2b825481E67A7F1C9eB309e693814E7
 * - ENS L2 Registry: 0xef46c8e7876f8a84e4b4f7e1a641fa6497bd532d
 */

import type { Address } from "viem";
import { ENS_REGISTRAR_ADDRESS, ENS_REGISTRY_ADDRESS } from "./config";

// =============================================================================
// Registrar ABI
// =============================================================================

/**
 * ENS L2 Registrar ABI
 * Handles subdomain registration and reverse resolution
 */
export const ENS_REGISTRAR_ABI = [
  {
    type: "function",
    name: "getFullName",
    inputs: [{ name: "addr", type: "address", internalType: "address" }],
    outputs: [{ name: "", type: "string", internalType: "string" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "getName",
    inputs: [{ name: "addr", type: "address", internalType: "address" }],
    outputs: [{ name: "", type: "string", internalType: "string" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "available",
    inputs: [{ name: "label", type: "string", internalType: "string" }],
    outputs: [{ name: "", type: "bool", internalType: "bool" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "register",
    inputs: [
      { name: "label", type: "string", internalType: "string" },
      { name: "owner", type: "address", internalType: "address" },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
] as const;

// =============================================================================
// Registry ABI
// =============================================================================

/**
 * ENS L2 Registry ABI
 * Handles text record storage and node operations
 */
export const ENS_REGISTRY_ABI = [
  {
    type: "function",
    name: "text",
    inputs: [
      { name: "node", type: "bytes32", internalType: "bytes32" },
      { name: "key", type: "string", internalType: "string" },
    ],
    outputs: [{ name: "", type: "string", internalType: "string" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "setText",
    inputs: [
      { name: "node", type: "bytes32", internalType: "bytes32" },
      { name: "key", type: "string", internalType: "string" },
      { name: "value", type: "string", internalType: "string" },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "baseNode",
    inputs: [],
    outputs: [{ name: "", type: "bytes32", internalType: "bytes32" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "makeNode",
    inputs: [
      { name: "parentNode", type: "bytes32", internalType: "bytes32" },
      { name: "label", type: "string", internalType: "string" },
    ],
    outputs: [{ name: "", type: "bytes32", internalType: "bytes32" }],
    stateMutability: "pure",
  },
  {
    type: "function",
    name: "owner",
    inputs: [{ name: "node", type: "bytes32", internalType: "bytes32" }],
    outputs: [{ name: "", type: "address", internalType: "address" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "resolver",
    inputs: [{ name: "node", type: "bytes32", internalType: "bytes32" }],
    outputs: [{ name: "", type: "address", internalType: "address" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "addr",
    inputs: [{ name: "node", type: "bytes32", internalType: "bytes32" }],
    outputs: [{ name: "", type: "address", internalType: "address" }],
    stateMutability: "view",
  },
] as const;

// =============================================================================
// Contract Addresses
// =============================================================================

/**
 * Get the ENS Registrar contract address
 */
export function getEnsRegistrarAddress(): Address {
  return ENS_REGISTRAR_ADDRESS;
}

/**
 * Get the ENS Registry contract address
 */
export function getEnsRegistryAddress(): Address {
  return ENS_REGISTRY_ADDRESS;
}

// =============================================================================
// Type Exports
// =============================================================================

export type EnsRegistrarAbi = typeof ENS_REGISTRAR_ABI;
export type EnsRegistryAbi = typeof ENS_REGISTRY_ABI;
