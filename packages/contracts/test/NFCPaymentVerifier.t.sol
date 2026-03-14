// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Test} from "forge-std/Test.sol";
import {NFCPaymentVerifier} from "../src/NFCPaymentVerifier.sol";
import {MockERC20} from "./mocks/MockERC20.sol";
import {ERC1271Wallet} from "./mocks/ERC1271Wallet.sol";

contract NFCPaymentVerifierTest is Test {
    NFCPaymentVerifier public verifier;
    MockERC20 public usdc;
    MockERC20 public usdt;

    address public owner;
    address public customerEOA;
    uint256 public customerEOAPrivateKey;
    address public merchant;
    address public customerSmartWallet;

    // Updated typehash includes token address for replay protection
    bytes32 private constant PAYMENT_TYPEHASH = keccak256(
        "PaymentAuthorization(address token,address merchant,address customer,uint256 amount,uint256 nonce,uint256 deadline)"
    );

    function setUp() public {
        owner = address(this);
        customerEOAPrivateKey = 0xA11CE;
        customerEOA = vm.addr(customerEOAPrivateKey);
        merchant = address(0xBEEF);
        customerSmartWallet = address(0xCAFE);

        // Deploy mock tokens
        usdc = new MockERC20("USD Coin", "USDC");
        usdt = new MockERC20("Tether USD", "USDT");

        // Mint tokens to customers
        usdc.mint(customerEOA, 1000 * 10**6);
        usdc.mint(customerSmartWallet, 1000 * 10**6);
        usdt.mint(customerEOA, 1000 * 10**6);
        usdt.mint(customerSmartWallet, 1000 * 10**6);

        // Deploy verifier with both tokens
        verifier = new NFCPaymentVerifier(address(usdc), address(usdt), owner);
    }

    // ============ EOA Signature Tests ============

    function test_ClaimPayment_EOASignature_USDC() public {
        _test_ClaimPayment_EOASignature(address(usdc));
    }

    function test_ClaimPayment_EOASignature_USDT() public {
        _test_ClaimPayment_EOASignature(address(usdt));
    }

    function _test_ClaimPayment_EOASignature(address token) internal {
        uint256 amount = 100 * 10**6;
        uint256 nonce = 1;
        uint256 deadline = block.timestamp + 1 hours;

        // Approve verifier
        vm.prank(customerEOA);
        MockERC20(token).approve(address(verifier), amount);

        // Create EIP-712 signature
        bytes32 digest = _hashTypedDataV4(
            _buildPaymentAuthorization(token, merchant, customerEOA, amount, nonce, deadline)
        );
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(customerEOAPrivateKey, digest);
        bytes memory signature = abi.encodePacked(r, s, v);

        // Claim payment
        vm.prank(merchant);
        verifier.claimPayment(token, merchant, customerEOA, amount, nonce, deadline, signature);

        // Verify transfer
        assertEq(MockERC20(token).balanceOf(merchant), amount);
        assertEq(MockERC20(token).balanceOf(customerEOA), 900 * 10**6);
        assertTrue(verifier.usedNonces(customerEOA, nonce));
    }

    function test_ClaimPayment_InvalidEOASignature() public {
        uint256 amount = 100 * 10**6;
        uint256 nonce = 1;
        uint256 deadline = block.timestamp + 1 hours;

        // Create signature from wrong signer
        bytes32 digest = _hashTypedDataV4(
            _buildPaymentAuthorization(address(usdc), merchant, address(0xDEAD), amount, nonce, deadline)
        );
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(customerEOAPrivateKey, digest);
        bytes memory signature = abi.encodePacked(r, s, v);

        // Should revert
        vm.expectRevert(NFCPaymentVerifier.InvalidSignature.selector);
        verifier.claimPayment(address(usdc), merchant, customerEOA, amount, nonce, deadline, signature);
    }

    function test_ClaimPayment_ExpiredDeadline() public {
        uint256 amount = 100 * 10**6;
        uint256 nonce = 1;
        uint256 deadline = block.timestamp - 1;

        bytes32 digest = _hashTypedDataV4(
            _buildPaymentAuthorization(address(usdc), merchant, customerEOA, amount, nonce, deadline)
        );
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(customerEOAPrivateKey, digest);
        bytes memory signature = abi.encodePacked(r, s, v);

        vm.expectRevert(NFCPaymentVerifier.SignatureExpired.selector);
        verifier.claimPayment(address(usdc), merchant, customerEOA, amount, nonce, deadline, signature);
    }

    function test_ClaimPayment_ReusedNonce() public {
        uint256 amount = 100 * 10**6;
        uint256 nonce = 1;
        uint256 deadline = block.timestamp + 1 hours;

        // First claim
        vm.prank(customerEOA);
        usdc.approve(address(verifier), amount * 2);

        bytes32 digest = _hashTypedDataV4(
            _buildPaymentAuthorization(address(usdc), merchant, customerEOA, amount, nonce, deadline)
        );
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(customerEOAPrivateKey, digest);
        bytes memory signature = abi.encodePacked(r, s, v);

        vm.prank(merchant);
        verifier.claimPayment(address(usdc), merchant, customerEOA, amount, nonce, deadline, signature);

        // Second claim with same nonce should fail
        vm.expectRevert(NFCPaymentVerifier.NonceAlreadyUsed.selector);
        verifier.claimPayment(address(usdc), merchant, customerEOA, amount, nonce, deadline, signature);
    }

    function test_ClaimPayment_UnsupportedToken() public {
        // Deploy a new token that's not supported
        MockERC20 unsupportedToken = new MockERC20("Unsupported", "UNSUP");
        unsupportedToken.mint(customerEOA, 1000 * 10**6);

        uint256 amount = 100 * 10**6;
        uint256 nonce = 1;
        uint256 deadline = block.timestamp + 1 hours;

        bytes32 digest = _hashTypedDataV4(
            _buildPaymentAuthorization(address(unsupportedToken), merchant, customerEOA, amount, nonce, deadline)
        );
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(customerEOAPrivateKey, digest);
        bytes memory signature = abi.encodePacked(r, s, v);

        vm.expectRevert(NFCPaymentVerifier.TokenNotSupported.selector);
        verifier.claimPayment(address(unsupportedToken), merchant, customerEOA, amount, nonce, deadline, signature);
    }

    function test_ReplayProtection_DifferentTokens() public {
        // Test that a signature for USDC cannot be used for USDT
        uint256 amount = 100 * 10**6;
        uint256 nonce = 1;
        uint256 deadline = block.timestamp + 1 hours;

        // Approve verifier for both tokens
        vm.prank(customerEOA);
        usdc.approve(address(verifier), amount);
        vm.prank(customerEOA);
        usdt.approve(address(verifier), amount);

        // Create signature for USDC
        bytes32 digest = _hashTypedDataV4(
            _buildPaymentAuthorization(address(usdc), merchant, customerEOA, amount, nonce, deadline)
        );
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(customerEOAPrivateKey, digest);
        bytes memory signature = abi.encodePacked(r, s, v);

        // Try to claim USDT with USDC signature - should fail
        vm.expectRevert(NFCPaymentVerifier.InvalidSignature.selector);
        verifier.claimPayment(address(usdt), merchant, customerEOA, amount, nonce, deadline, signature);

        // Now claim USDC with correct signature - should succeed
        vm.prank(merchant);
        verifier.claimPayment(address(usdc), merchant, customerEOA, amount, nonce, deadline, signature);
        assertEq(usdc.balanceOf(merchant), amount);
    }

    // ============ ERC-1271 Smart Wallet Tests ============

    function test_ClaimPayment_ERC1271Signature() public {
        // Deploy mock ERC-1271 wallet owned by customerEOA
        // The wallet validates signatures by checking if they recover to the owner
        ERC1271Wallet wallet = new ERC1271Wallet(customerEOA);
        address walletAddress = address(wallet);

        // Mint tokens to wallet
        usdc.mint(walletAddress, 1000 * 10**6);

        uint256 amount = 100 * 10**6;
        uint256 nonce = 1;
        uint256 deadline = block.timestamp + 1 hours;

        // Approve verifier from wallet
        vm.prank(walletAddress);
        usdc.approve(address(verifier), amount);

        // Create EIP-712 digest - customer signs with their key
        // The wallet will verify this signature against its owner (customerEOA)
        bytes32 digest = _hashTypedDataV4(
            _buildPaymentAuthorization(address(usdc), merchant, walletAddress, amount, nonce, deadline)
        );

        // Sign with owner's private key (customerEOAPrivateKey -> customerEOA)
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(customerEOAPrivateKey, digest);
        bytes memory signature = abi.encodePacked(r, s, v);

        // Claim payment - verifier checks ERC-1271 signature via wallet
        vm.prank(merchant);
        verifier.claimPayment(address(usdc), merchant, walletAddress, amount, nonce, deadline, signature);

        // Verify transfer
        assertEq(usdc.balanceOf(merchant), amount);
        assertEq(usdc.balanceOf(walletAddress), 900 * 10**6);
        assertTrue(verifier.usedNonces(walletAddress, nonce));
    }

    function test_ClaimPayment_ERC1271InvalidSignature() public {
        // Deploy mock ERC-1271 wallet that rejects all signatures
        ERC1271Wallet wallet = new ERC1271Wallet(address(0xDEAD));
        address walletAddress = address(wallet);

        uint256 amount = 100 * 10**6;
        uint256 nonce = 1;
        uint256 deadline = block.timestamp + 1 hours;

        bytes32 digest = _hashTypedDataV4(
            _buildPaymentAuthorization(address(usdc), merchant, walletAddress, amount, nonce, deadline)
        );

        // Sign with wrong key
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(customerEOAPrivateKey, digest);
        bytes memory signature = abi.encodePacked(r, s, v);

        vm.expectRevert(NFCPaymentVerifier.InvalidSignature.selector);
        verifier.claimPayment(address(usdc), merchant, walletAddress, amount, nonce, deadline, signature);
    }

    // ============ Token Support Management Tests ============

    function test_SetTokenSupport() public {
        MockERC20 newToken = new MockERC20("New Token", "NEW");

        // Initially not supported
        assertFalse(verifier.supportedTokens(address(newToken)));

        // Add support
        verifier.setTokenSupport(address(newToken), true);
        assertTrue(verifier.supportedTokens(address(newToken)));

        // Remove support
        verifier.setTokenSupport(address(newToken), false);
        assertFalse(verifier.supportedTokens(address(newToken)));
    }

    function test_SetTokenSupport_OnlyOwner() public {
        MockERC20 newToken = new MockERC20("New Token", "NEW");

        vm.prank(address(0xDEAD));
        vm.expectRevert();
        verifier.setTokenSupport(address(newToken), true);
    }

    // ============ Helper Functions ============

    function _buildPaymentAuthorization(
        address _token,
        address _merchant,
        address _customer,
        uint256 _amount,
        uint256 _nonce,
        uint256 _deadline
    ) internal pure returns (bytes32) {
        return keccak256(abi.encode(
            PAYMENT_TYPEHASH,
            _token,
            _merchant,
            _customer,
            _amount,
            _nonce,
            _deadline
        ));
    }

    function _hashTypedDataV4(bytes32 structHash) internal view returns (bytes32) {
        return keccak256(abi.encodePacked("\x19\x01", _domainSeparatorV4(), structHash));
    }

    function _domainSeparatorV4() internal view returns (bytes32) {
        bytes32 EIP712_DOMAIN_TYPEHASH = keccak256(
            "EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"
        );
        return keccak256(abi.encode(
            EIP712_DOMAIN_TYPEHASH,
            keccak256(bytes("NFC Payment Verifier")),
            keccak256(bytes("1")),
            block.chainid,
            address(verifier)
        ));
    }
}
