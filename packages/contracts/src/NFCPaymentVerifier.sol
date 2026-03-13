// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {EIP712} from "openzeppelin-contracts/utils/cryptography/EIP712.sol";
import {ECDSA} from "openzeppelin-contracts/utils/cryptography/ECDSA.sol";
import {ReentrancyGuard} from "openzeppelin-contracts/utils/ReentrancyGuard.sol";
import {Ownable} from "openzeppelin-contracts/access/Ownable.sol";
import {IERC20} from "./interfaces/IERC20.sol";

/// @title NFC Payment Verifier
/// @notice Verifies EIP-712 signed payment authorizations and transfers tokens
contract NFCPaymentVerifier is EIP712, ReentrancyGuard, Ownable {
    using ECDSA for bytes32;

    /// @notice The ERC20 token used for payments
    IERC20 public immutable token;

    /// @notice Tracks used nonces per customer to prevent replay attacks
    mapping(address customer => mapping(uint256 nonce => bool used)) public usedNonces;

    /// @notice Emitted when a payment is successfully claimed
    event PaymentClaimed(
        address indexed customer,
        address indexed merchant,
        uint256 amount,
        uint256 nonce
    );

    /// @notice Thrown when signature verification fails
    error InvalidSignature();

    /// @notice Thrown when signature deadline has passed
    error SignatureExpired();

    /// @notice Thrown when nonce has already been used
    error NonceAlreadyUsed();

    /// @notice Thrown when token transfer fails
    error TransferFailed();

    /// @notice The typehash for PaymentAuthorization struct
    bytes32 private constant PAYMENT_TYPEHASH = keccak256(
        "PaymentAuthorization(address merchant,address customer,uint256 amount,uint256 nonce,uint256 deadline)"
    );

    /// @param _token The ERC20 token address for payments
    /// @param initialOwner The initial contract owner
    constructor(address _token, address initialOwner)
        EIP712("NFC Payment Verifier", "1")
        Ownable(initialOwner)
    {
        token = IERC20(_token);
    }

    /// @notice Claims a payment using an EIP-712 signed authorization
    /// @param merchant The recipient address (POS wallet)
    /// @param customer The signer address (payment device wallet)
    /// @param amount The token amount to transfer
    /// @param nonce Unique identifier for this authorization
    /// @param deadline Expiration timestamp
    /// @param signature EIP-712 signature from customer
    function claimPayment(
        address merchant,
        address customer,
        uint256 amount,
        uint256 nonce,
        uint256 deadline,
        bytes calldata signature
    ) external nonReentrant {
        if (block.timestamp > deadline) {
            revert SignatureExpired();
        }

        if (usedNonces[customer][nonce]) {
            revert NonceAlreadyUsed();
        }

        bytes32 digest = _hashPaymentAuthorization(
            merchant, customer, amount, nonce, deadline
        );

        address signer = digest.recover(signature);
        if (signer != customer) {
            revert InvalidSignature();
        }

        usedNonces[customer][nonce] = true;

        bool success = token.transferFrom(customer, merchant, amount);
        if (!success) {
            revert TransferFailed();
        }

        emit PaymentClaimed(customer, merchant, amount, nonce);
    }

    /// @notice Computes the EIP-712 typed data hash for a payment authorization
    /// @param merchant The recipient address
    /// @param customer The signer address
    /// @param amount The token amount
    /// @param nonce Unique identifier
    /// @param deadline Expiration timestamp
    /// @return The EIP-712 typed data hash
    function hashPaymentAuthorization(
        address merchant,
        address customer,
        uint256 amount,
        uint256 nonce,
        uint256 deadline
    ) external view returns (bytes32) {
        return _hashPaymentAuthorization(merchant, customer, amount, nonce, deadline);
    }

    /// @dev Internal function to compute the typed data hash
    function _hashPaymentAuthorization(
        address merchant,
        address customer,
        uint256 amount,
        uint256 nonce,
        uint256 deadline
    ) internal view returns (bytes32) {
        return _hashTypedDataV4(keccak256(abi.encode(
            PAYMENT_TYPEHASH,
            merchant,
            customer,
            amount,
            nonce,
            deadline
        )));
    }
}
