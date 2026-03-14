// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Script, console} from "forge-std/Script.sol";

/// @notice Base contract for ScaffoldETH-style deployments
/// @dev Provides deployment tracking and export functionality
contract DeployHelpers is Script {
    /// @notice Tracks deployed contracts for export
    struct Deployment {
        string name;
        address addr;
    }

    /// @notice Array of deployed contracts
    Deployment[] public deployments;

    /// @notice Modifier to run deployment with broadcast
    modifier ScaffoldEthDeployerRunner() {
        vm.startBroadcast();
        _;
        vm.stopBroadcast();
        _exportDeployments();
    }

    /// @notice Adds a deployment to tracking
    /// @param name Contract name
    /// @param addr Deployed address
    function _addDeployment(string memory name, address addr) internal {
        deployments.push(Deployment({name: name, addr: addr}));
        console.log("Deployed %s at: %s", name, addr);
    }

    /// @notice Exports deployments to JSON file
    function _exportDeployments() internal {
        string memory chainId = vm.toString(block.chainid);
        string memory finalJson = "{";

        for (uint256 i = 0; i < deployments.length; i++) {
            if (i > 0) {
                finalJson = string.concat(finalJson, ",");
            }

            finalJson = string.concat(
                finalJson,
                "\"",
                deployments[i].name,
                "\":{\"address\":\"",
                vm.toString(deployments[i].addr),
                "\"}"
            );
        }

        if (deployments.length > 0) {
            finalJson = string.concat(finalJson, ",");
        }

        finalJson = string.concat(finalJson, "\"chainId\":\"", chainId, "\"}");

        string memory path = string.concat(
            "deployments/",
            chainId,
            ".json"
        );

        vm.writeJson(finalJson, path);
        console.log("Deployments exported to: %s", path);
    }

    /// @notice Funds Anvil accounts on local chain
    /// @param accounts Array of addresses to fund
    /// @param amount Amount to fund each account (in wei)
    function _fundAnvilAccounts(address[] memory accounts, uint256 amount) internal {
        if (block.chainid != 31337) return;

        for (uint256 i = 0; i < accounts.length; i++) {
            vm.deal(accounts[i], amount);
            console.log("Funded %s with %s wei", accounts[i], amount);
        }
    }
}
