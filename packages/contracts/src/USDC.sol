// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {ERC20} from "openzeppelin-contracts/token/ERC20/ERC20.sol";

/// @notice Mock USDC for testing - anyone can mint
contract USDC is ERC20 {
    uint8 private constant DECIMALS = 6;

    constructor() ERC20("USD Coin", "USDC") {}

    function decimals() public pure override returns (uint8) {
        return DECIMALS;
    }

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}
