/**
 * External contract configuration for third-party contracts
 * 
 * These contracts are not deployed by this project and are managed externally.
 */

import type { Address } from "viem";

export const FAUCET_ADDRESS: Address = "0xD9145b5F45Ad4519c7ACcD6E0A4A82e83bB8A6Dc";

export const FAUCET_ABI = [
  {
    type: "function",
    name: "mint",
    inputs: [
      {
        name: "token",
        type: "address",
        internalType: "address",
      },
      {
        name: "to",
        type: "address",
        internalType: "address",
      },
      {
        name: "amount",
        type: "uint256",
        internalType: "uint256",
      },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
] as const;
