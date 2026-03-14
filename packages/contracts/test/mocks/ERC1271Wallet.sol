// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {ECDSA} from "openzeppelin-contracts/utils/cryptography/ECDSA.sol";

/// @title Mock ERC-1271 Smart Wallet
/// @notice Simple mock for testing ERC-1271 signature validation
contract ERC1271Wallet {
    using ECDSA for bytes32;

    address public owner;
    bytes4 private constant MAGIC_VALUE = 0x1626ba7e;
    bytes4 private constant INVALID_VALUE = 0xffffffff;

    constructor(address _owner) {
        owner = _owner;
    }

    /// @notice ERC-1271 signature validation
    function isValidSignature(bytes32 hash, bytes memory signature)
        external
        view
        returns (bytes4)
    {
        address recovered = hash.recover(signature);
        if (recovered == owner) {
            return MAGIC_VALUE;
        }
        return INVALID_VALUE;
    }

    /// @notice Allow owner to execute calls
    function execute(address to, uint256 value, bytes calldata data)
        external
        returns (bytes memory)
    {
        require(msg.sender == owner, "Only owner");
        (bool success, bytes memory result) = to.call{value: value}(data);
        require(success, "Call failed");
        return result;
    }

    /// @notice Allow receiving ETH
    receive() external payable {}
}
