// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {ERC20} from "openzeppelin-contracts/token/ERC20/ERC20.sol";

/// @notice Mock ERC20 token for testing - anyone can mint
contract MockERC20 is ERC20 {
    uint8 private constant DECIMALS = 6;

    constructor(string memory name, string memory symbol) ERC20(name, symbol) {}

    function decimals() public pure override returns (uint8) {
        return DECIMALS;
    }

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}
