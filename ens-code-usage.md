# ENS in Bump

> [!NOTE]
> Bump uses ENS names in the format `alice.bump.eth`, where the parent domain is `bump.eth`.

## Overview

ENS is the identity and payment-preferences layer in Bump.

It is used in two places:

1. P2P payments, where a payer resolves the receiver from `alice.bump.eth`.
2. Merchant payments, where the merchant profile is resolved from ENS before the NFC payment is signed and claimed.

## ENS Profile

When a user claims a Bump name, Bump stores both the ENS name and the payment profile onchain.

The app writes these ENS text records:

| Text Record | Purpose |
| :--- | :--- |
| `bump.profile.version` | Profile schema version |
| `bump.mode` | Profile mode: `p2p`, `merchant`, or `both` |
| `bump.default.chain` | Default receiving chain |
| `bump.default.token` | Default receiving token |

This means `alice.bump.eth` is not just a label. It also carries the default asset configuration the app uses when building payments.

| Component | File |
| :--- | :--- |
| **ENS onboarding** | [app/ens-onboarding.tsx](app/ens-onboarding.tsx#L227) |
| **Text record model** | [lib/ens/bump-ens.ts](lib/ens/bump-ens.ts#L169) |
| **ENS read/write service** | [lib/ens/service.ts](lib/ens/service.ts#L62) |
| **Preferences UI** | [components/EnsPreferencesCard.tsx](components/EnsPreferencesCard.tsx#L273) |

## P2P Mode

In P2P mode, ENS is used as the payment destination.

Simple flow:

1. The receiver shares `alice.bump.eth`.
2. The payer resolves `alice.bump.eth` onchain.
3. The payer reads the ENS profile.
4. The app gets the receiver wallet address from ENS.
5. The app uses `bump.default.chain` and `bump.default.token` to decide how to build the payment.

So in P2P mode, ENS is the source of truth for:

- who gets paid
- which chain is expected
- which token is expected

| Component | File |
| :--- | :--- |
| **ENS resolution** | [lib/ens/service.ts](lib/ens/service.ts#L243) |
| **Recipient resolution** | [lib/recipient-profile/index.ts](lib/recipient-profile/index.ts#L90) |
| **P2P NFC request shape** | [lib/payments/request.ts](lib/payments/request.ts#L9) |
| **P2P pay flow** | [app/pay-nfc.tsx](app/pay-nfc.tsx#L327) |

## Merchant Mode

In merchant mode, ENS is used in two steps:

1. The merchant device resolves its own ENS profile before starting checkout.
2. The payer device resolves the merchant ENS name again before signing the payment authorization.

### Merchant side

Before a merchant starts an NFC checkout session, the app:

1. reverse-resolves the merchant wallet to get the merchant ENS name
2. resolves that ENS profile
3. reads the merchant address from ENS
4. reads the default token and chain from ENS
5. creates the checkout session from those ENS-derived values

The merchant NFC payload then publishes:

- `merchantEnsName`
- amount
- chain id
- verifier contract
- nonce
- deadline

The merchant does not need to send the merchant address or token in the NFC request. Those are kept in the merchant session locally and are re-derived by the payer from ENS.

| Component | File |
| :--- | :--- |
| **Merchant tab** | [app/(tabs)/merchant.tsx](app/(tabs)/merchant.tsx#L10) |
| **POS terminal ENS display** | [app/pos-terminal.tsx](app/pos-terminal.tsx#L35) |
| **Merchant session start** | [app/request-payment.tsx](app/request-payment.tsx#L484) |
| **Merchant session model** | [lib/payments/merchant-session.ts](lib/payments/merchant-session.ts#L24) |
| **Merchant NFC request message** | [lib/nfc/protocol.ts](lib/nfc/protocol.ts#L76) |

### Payer side

When the payer taps the merchant device, the app:

1. receives `merchantEnsName` from NFC
2. resolves that ENS name onchain
3. reads the merchant address from ENS
4. reads the merchant default token and chain from ENS
5. signs the existing `NFCPaymentVerifier` authorization using the resolved concrete values
6. sends back the signature together with the resolved merchant address and token

The merchant app compares the returned resolved address and token against its own cached ENS-derived session values before calling `claimPayment(...)`.

So in merchant mode, ENS is the source of truth for:

- which merchant is being paid
- which token should be used
- which wallet receives the funds

| Component | File |
| :--- | :--- |
| **Merchant ENS resolution on payer device** | [app/pay-merchant.tsx](app/pay-merchant.tsx#L211) |
| **Merchant NFC reader payload** | [lib/nfc/reader.ts](lib/nfc/reader.ts#L47) |
| **Authorization payload over NFC** | [lib/payments/merchant-session.ts](lib/payments/merchant-session.ts#L129) |
| **EIP-712 typed data** | [lib/blockchain/eip712-signing.ts](lib/blockchain/eip712-signing.ts#L25) |
| **Verifier claim call** | [lib/blockchain/payment-verifier.ts](lib/blockchain/payment-verifier.ts#L27) |

## ENS In The UI

The app also uses ENS as the visible identity layer across the product.

That includes:

- the header and profile area
- receive screens
- merchant screens
- payment success/history labels

| Component | File |
| :--- | :--- |
| **Header display** | [components/HomeHeader.tsx](components/HomeHeader.tsx#L35) |
| **Receive flow** | [app/receive.tsx](app/receive.tsx#L256) |
| **Merchant request screen** | [app/request-payment.tsx](app/request-payment.tsx#L690) |
| **Merchant payer screen** | [app/pay-merchant.tsx](app/pay-merchant.tsx#L594) |

## Contracts And Addresses

### ENS contracts

| Contract | Address | Explorer | Used for |
| :--- | :--- | :--- | :--- |
| **ENS L2 Registrar** | `0x5DCD7071366b400880E01886De44555570F2D4a8` | [BaseScan](https://sepolia.basescan.org/address/0x5DCD7071366b400880E01886De44555570F2D4a8) | Reverse lookup and registration |
| **ENS L2 Registry** | `0xeb1b97aeda7124560f660f2d900ccd594598525d` | [BaseScan](https://sepolia.basescan.org/address/0xeb1b97aeda7124560f660f2d900ccd594598525d) | Address resolution and text records |

### Payment contract

| Contract | Address | Explorer | Used for |
| :--- | :--- | :--- | :--- |
| **NFCPaymentVerifier** | `0xe1247d0F2F2bd41c4bA1f10bC2D1394F1462Ca13` | [BaseScan](https://sepolia.basescan.org/address/0xe1247d0F2F2bd41c4bA1f10bC2D1394F1462Ca13) | Merchant authorization claim |

### Supported default tokens from ENS profile

| Token | Address | Explorer |
| :--- | :--- | :--- |
| **USDC on Base Sepolia** | `0xba50Cd2A20f6DA35D788639E581bca8d0B5d4D5f` | [BaseScan](https://sepolia.basescan.org/address/0xba50Cd2A20f6DA35D788639E581bca8d0B5d4D5f) |
| **USDT on Base Sepolia** | `0x0a215D8ba66387DCA84B284D18c3B4ec3de6E54a` | [BaseScan](https://sepolia.basescan.org/address/0x0a215D8ba66387DCA84B284D18c3B4ec3de6E54a) |

## Manual Verification

### Resolve `alice.bump.eth` to an address

Open:

[ENS L2 Registry Read Contract](https://sepolia.basescan.org/address/0xeb1b97aeda7124560f660f2d900ccd594598525d#readContract)

Call:

1. `baseNode()`
2. `makeNode(baseNode, "alice")`
3. `addr(node)`

The `addr(node)` result is the wallet address for `alice.bump.eth`.

### Verify address back to ENS

Open:

[ENS L2 Registrar Read Contract](https://sepolia.basescan.org/address/0x5DCD7071366b400880E01886De44555570F2D4a8#readContract)

Call:

1. `getFullName(address)`

That returns the ENS name claimed by the address.

### Read ENS text records

Using the same `node`, call:

1. `text(node, "bump.mode")`
2. `text(node, "bump.default.chain")`
3. `text(node, "bump.default.token")`

These are the values the app reads when building P2P and merchant payment flows.

## `cast` Commands

```bash
REGISTRAR=0x5DCD7071366b400880E01886De44555570F2D4a8
REGISTRY=0xeb1b97aeda7124560f660f2d900ccd594598525d

BASE_NODE=$(cast call $REGISTRY "baseNode()(bytes32)" --rpc-url $BASE_SEPOLIA_RPC_URL)
NODE=$(cast call $REGISTRY "makeNode(bytes32,string)(bytes32)" $BASE_NODE "alice" --rpc-url $BASE_SEPOLIA_RPC_URL)

# ENS -> address
cast call $REGISTRY "addr(bytes32)(address)" $NODE --rpc-url $BASE_SEPOLIA_RPC_URL

# address -> ENS
cast call $REGISTRAR "getFullName(address)(string)" 0xUSER_ADDRESS --rpc-url $BASE_SEPOLIA_RPC_URL

# ENS text records
cast call $REGISTRY "text(bytes32,string)(string)" $NODE "bump.mode" --rpc-url $BASE_SEPOLIA_RPC_URL
cast call $REGISTRY "text(bytes32,string)(string)" $NODE "bump.default.chain" --rpc-url $BASE_SEPOLIA_RPC_URL
cast call $REGISTRY "text(bytes32,string)(string)" $NODE "bump.default.token" --rpc-url $BASE_SEPOLIA_RPC_URL
```

## Minimal Code Pointers

| Description | File |
| :--- | :--- |
| **ENS config** | [lib/ens/config.ts](lib/ens/config.ts#L17) |
| **ENS ABIs** | [lib/ens/contracts.ts](lib/ens/contracts.ts#L20) |
| **ENS service layer** | [lib/ens/service.ts](lib/ens/service.ts#L62) |
| **Recipient resolution** | [lib/recipient-profile/index.ts](lib/recipient-profile/index.ts#L90) |
| **Merchant session logic** | [lib/payments/merchant-session.ts](lib/payments/merchant-session.ts#L24) |
| **Payment verifier contract** | [packages/contracts/src/NFCPaymentVerifier.sol](packages/contracts/src/NFCPaymentVerifier.sol#L13) |
