// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {console} from "forge-std/Script.sol";
import {USDC} from "../src/USDC.sol";
import {NFCPaymentVerifier} from "../src/NFCPaymentVerifier.sol";
import {DeployHelpers} from "./DeployHelpers.s.sol";

/// @title Main Deployment Script
/// @notice Deploys USDC mock token and NFCPaymentVerifier
contract DeployScript is DeployHelpers {
    /// @notice Deployer address (set via PRIVATE_KEY or keystore)
    address internal deployer;

    /// @notice Deploys all contracts in order
    function run() external ScaffoldEthDeployerRunner {
        deployer = msg.sender;
        console.log("Deploying from: %s", deployer);

        // 1. Deploy USDC mock token
        USDC usdc = new USDC();
        _addDeployment("USDC", address(usdc));

        // 2. Deploy NFCPaymentVerifier with USDC address
        NFCPaymentVerifier verifier = new NFCPaymentVerifier(
            address(usdc),
            deployer // initial owner
        );
        _addDeployment("NFCPaymentVerifier", address(verifier));

        console.log("Deployment complete!");
    }
}
