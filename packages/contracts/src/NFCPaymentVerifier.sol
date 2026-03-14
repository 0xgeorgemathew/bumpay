// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {EIP712} from "openzeppelin-contracts/utils/cryptography/EIP712.sol";
import {SignatureChecker} from "openzeppelin-contracts/utils/cryptography/SignatureChecker.sol";
import {ReentrancyGuard} from "openzeppelin-contracts/utils/ReentrancyGuard.sol";
import {Ownable} from "openzeppelin-contracts/access/Ownable.sol";
import {IERC20} from "./interfaces/IERC20.sol";

/// @title NFC Payment Verifier
/// @notice Verifies EIP-712 signed payment authorizations and transfers tokens
/// @dev Supports both EOA signatures (ECDSA) and ERC-1271 smart wallet signatures
contract NFCPaymentVerifier is EIP712, ReentrancyGuard, Ownable {

    /// @notice Supported payment tokens (USDC, USDT)
    mapping(address token => bool supported) public supportedTokens;

    /// @notice Tracks used nonces per customer to prevent replay attacks
    mapping(address customer => mapping(uint256 nonce => bool used)) public usedNonces;

    /// @notice Emitted when a payment is successfully claimed
    event PaymentClaimed(
        address indexed customer,
        address indexed merchant,
        address indexed token,
        uint256 amount,
        uint256 nonce
    );

    /// @notice Emitted when a token is added or removed from support
    event TokenSupportUpdated(address indexed token, bool supported);

    /// @notice Thrown when signature verification fails
    error InvalidSignature();

    /// @notice Thrown when signature deadline has passed
    error SignatureExpired();

    /// @notice Thrown when nonce has already been used
    error NonceAlreadyUsed();

    /// @notice Thrown when token transfer fails
    error TransferFailed();

    /// @notice Thrown when token is not supported
    error TokenNotSupported();

    /// @notice The typehash for PaymentAuthorization struct (now includes token)
    bytes32 private constant PAYMENT_TYPEHASH = keccak256(
        "PaymentAuthorization(address token,address merchant,address customer,uint256 amount,uint256 nonce,uint256 deadline)"
    );

    /// @param usdc USDC token address
    /// @param usdt USDT token address
    /// @param initialOwner The initial contract owner
    constructor(address usdc, address usdt, address initialOwner)
        EIP712("NFC Payment Verifier", "1")
        Ownable(initialOwner)
    {
        supportedTokens[usdc] = true;
        supportedTokens[usdt] = true;
        emit TokenSupportUpdated(usdc, true);
        emit TokenSupportUpdated(usdt, true);
    }

    /// @notice Add or remove token support (owner only)
    function setTokenSupport(address token, bool supported) external onlyOwner {
        supportedTokens[token] = supported;
        emit TokenSupportUpdated(token, supported);
    }

    /// @notice Claims a payment using an EIP-712 signed authorization
    /// @param token The ERC20 token address for payment
    /// @param merchant The recipient address (POS wallet)
    /// @param customer The signer address (payment device wallet)
    /// @param amount The token amount to transfer
    /// @param nonce Unique identifier for this authorization
    /// @param deadline Expiration timestamp
    /// @param signature EIP-712 signature from customer
    function claimPayment(
        address token,
        address merchant,
        address customer,
        uint256 amount,
        uint256 nonce,
        uint256 deadline,
        bytes calldata signature
    ) external nonReentrant {
        if (!supportedTokens[token]) {
            revert TokenNotSupported();
        }

        if (block.timestamp > deadline) {
            revert SignatureExpired();
        }

        if (usedNonces[customer][nonce]) {
            revert NonceAlreadyUsed();
        }

        bytes32 digest = _hashPaymentAuthorization(
            token, merchant, customer, amount, nonce, deadline
        );

        if (!SignatureChecker.isValidSignatureNowCalldata(customer, digest, signature)) {
            revert InvalidSignature();
        }

        usedNonces[customer][nonce] = true;

        bool success = IERC20(token).transferFrom(customer, merchant, amount);
        if (!success) {
            revert TransferFailed();
        }

        emit PaymentClaimed(customer, merchant, token, amount, nonce);
    }

    /// @notice Computes the EIP-712 typed data hash for a payment authorization
    function hashPaymentAuthorization(
        address token,
        address merchant,
        address customer,
        uint256 amount,
        uint256 nonce,
        uint256 deadline
    ) external view returns (bytes32) {
        return _hashPaymentAuthorization(token, merchant, customer, amount, nonce, deadline);
    }

    /// @dev Internal function to compute the typed data hash
    function _hashPaymentAuthorization(
        address token,
        address merchant,
        address customer,
        uint256 amount,
        uint256 nonce,
        uint256 deadline
    ) internal view returns (bytes32) {
        return _hashTypedDataV4(keccak256(abi.encode(
            PAYMENT_TYPEHASH,
            token,
            merchant,
            customer,
            amount,
            nonce,
            deadline
        )));
    }
}
