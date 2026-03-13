// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Script, stdJson, console} from "forge-std/Script.sol";

/// @title Contract Verification Script
/// @notice Verifies all deployed contracts on block explorer
contract VerifyAll is Script {
    using stdJson for string;

    /// @notice Path to broadcast directory
    string constant BROADCAST_DIR = "broadcast/Deploy.s.sol";

    /// @notice Verifies all CREATE transactions from latest broadcast
    function run() external {
        uint256 chainId = block.chainid;
        string memory chainIdStr = vm.toString(chainId);

        string memory runPath = string.concat(
            BROADCAST_DIR,
            "/",
            chainIdStr,
            "/run-latest.json"
        );

        // Check if broadcast file exists
        if (!vm.exists(runPath)) {
            console.log("No broadcast found at: %s", runPath);
            console.log("Run deployment first: forge script script/Deploy.s.sol --rpc-url $RPC_URL --broadcast");
            return;
        }

        string memory json = vm.readFile(runPath);
        bytes memory transactionsData = json.parseRaw(".transactions");
        Transaction[] memory transactions = abi.decode(transactionsData, (Transaction[]));

        uint256 verifiedCount = 0;

        for (uint256 i = 0; i < transactions.length; i++) {
            Transaction memory txn = transactions[i];

            // Only verify CREATE transactions
            if (keccak256(bytes(txn.transactionType)) != keccak256(bytes("CREATE"))) {
                continue;
            }

            console.log("Verifying %s at %s...", txn.contractName, txn.contractAddress);

            // Build verify command
            string[] memory cmd = new string[](9);
            cmd[0] = "forge";
            cmd[1] = "verify-contract";
            cmd[2] = txn.contractAddress;
            cmd[3] = txn.contractName;
            cmd[4] = "--chain-id";
            cmd[5] = chainIdStr;
            cmd[6] = "--watch";
            cmd[7] = "--optimizer-runs";
            cmd[8] = "200";

            // Add constructor args if present
            if (bytes(txn.arguments).length > 0) {
                // Flatten for command line would require additional handling
                console.log("  Constructor args detected, may need manual verification");
            }

            try vm.ffi(cmd) {
                console.log("  Verified!");
                verifiedCount++;
            } catch {
                console.log("  Verification failed (may already be verified)");
            }
        }

        console.log("Verified %s contracts", verifiedCount);
    }

    /// @notice Transaction structure from broadcast JSON
    struct Transaction {
        string transactionType;
        string contractName;
        string contractAddress;
        string arguments;
    }
}
