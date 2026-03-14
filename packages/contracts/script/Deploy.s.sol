// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {console} from "forge-std/Script.sol";
import {NFCPaymentVerifier} from "../src/NFCPaymentVerifier.sol";
import {DeployHelpers} from "./DeployHelpers.s.sol";

/// @title Main Deployment Script
/// @notice Deploys NFCPaymentVerifier with support for Aave faucet tokens
contract DeployScript is DeployHelpers {
    // Real Aave faucet tokens on Base Sepolia
    address internal constant USDC = 0xba50Cd2A20f6DA35D788639E581bca8d0B5d4D5f;
    address internal constant USDT = 0x0a215D8ba66387DCA84B284D18c3B4ec3de6E54a;

    /// @notice Deployer address (set via PRIVATE_KEY or keystore)
    address internal deployer;

    /// @notice Deploys all contracts
    function run() external ScaffoldEthDeployerRunner {
        deployer = msg.sender;
        console.log("Deploying from: %s", deployer);

        NFCPaymentVerifier verifier = new NFCPaymentVerifier(
            USDC,
            USDT,
            deployer
        );
        _addDeployment("NFCPaymentVerifier", address(verifier));

        console.log("Deployment complete!");
        console.log("Supported tokens: USDC=%s, USDT=%s", USDC, USDT);
    }
}
