# ENS in Bump

> [!NOTE]
> Bump uses ENS names in the format `alice.bump.eth`, where the parent domain is `bump.eth`.

---

## How ENS Is Used Throughout The Product

Bump uses ENS as the human-readable identity layer for peer-to-peer payments on Base Sepolia.

---

### 1. Claim a Bump ENS name

During onboarding, a user can claim a name like `alice.bump.eth`.

| Component | File |
| :--- | :--- |
| **App flow** | [app/ens-onboarding.tsx](app/ens-onboarding.tsx#L227) |
| **Claim transaction builder** | [lib/ens/service.ts](lib/ens/service.ts#L335) |

---

### 2. Save payment preferences to ENS text records

After claiming the name, Bump writes payment preferences directly to ENS text records:

| Text Record | Purpose |
| :--- | :--- |
| `bump.profile.version` | Profile schema version |
| `bump.mode` | Payment mode setting |
| `bump.default.chain` | Default receiving chain |
| `bump.default.token` | Default receiving token |

This lets `alice.bump.eth` carry not just an address, but also the default receiving token and chain.

| Component | File |
| :--- | :--- |
| **Text record model** | [lib/ens/bump-ens.ts](lib/ens/bump-ens.ts#L169) |
| **Write path** | [lib/ens/service.ts](lib/ens/service.ts#L370) |
| **Settings/profile UI** | [components/EnsPreferencesCard.tsx](components/EnsPreferencesCard.tsx#L273) |

---

### 3. Resolve ENS during payment

When a payer taps to pay, Bump resolves the ENS name onchain before building the payment.

> **Example flow:**
> - Receiver shares `alice.bump.eth`
> - Bump resolves `alice.bump.eth` → wallet address
> - Bump reads ENS text records
> - Bump uses `bump.default.token` to know which token Alice expects

| Component | File |
| :--- | :--- |
| **ENS resolution** | [lib/ens/service.ts](lib/ens/service.ts#L243) |
| **Payment recipient resolution** | [lib/recipient-profile/index.ts](lib/recipient-profile/index.ts#L90) |
| **NFC request shape** | [lib/payments/request.ts](lib/payments/request.ts#L9) |
| **Pay flow** | [app/pay-nfc.tsx](app/pay-nfc.tsx#L327) |

---

### 4. Show ENS as the visible user identity

The app displays the user's ENS name in the product UI and uses it in receive/pay flows.

| Component | File |
| :--- | :--- |
| **Header display** | [components/HomeHeader.tsx](components/HomeHeader.tsx#L35) |
| **Receive flow** | [app/receive.tsx](app/receive.tsx#L256) |
| **Merchant/customer name display** | [app/request-payment.tsx](app/request-payment.tsx#L137), [app/pay-merchant.tsx](app/pay-merchant.tsx#L133) |

---

## Contracts Judges May Want To Verify

### ENS Contracts

| Contract | Address | Explorer | Used for |
| :--- | :--- | :--- | :--- |
| **ENS L2 Registrar** | `0x5DCD7071366b400880E01886De44555570F2D4a8` | [BaseScan](https://sepolia.basescan.org/address/0x5DCD7071366b400880E01886De44555570F2D4a8) | Reverse lookup, availability, registration |
| **ENS L2 Registry** | `0xeb1b97aeda7124560f660f2d900ccd594598525d` | [BaseScan](https://sepolia.basescan.org/address/0xeb1b97aeda7124560f660f2d900ccd594598525d) | Node derivation, owner, address, text records |

### Bump Payment Contract

| Contract | Address | Explorer | Used for |
| :--- | :--- | :--- | :--- |
| **NFCPaymentVerifier** | `0xe1247d0F2F2bd41c4bA1f10bC2D1394F1462Ca13` | [BaseScan](https://sepolia.basescan.org/address/0xe1247d0F2F2bd41c4bA1f10bC2D1394F1462Ca13) | Final token payment claim after ENS resolution |

### Default Token Referenced from ENS Profile

| Token | Address | Explorer |
| :--- | :--- | :--- |
| **USDC on Base Sepolia** | `0xba50Cd2A20f6DA35D788639E581bca8d0B5d4D5f` | [BaseScan](https://sepolia.basescan.org/address/0xba50Cd2A20f6DA35D788639E581bca8d0B5d4D5f) |

---

## Quick Manual Verification For `alice.bump.eth`

### A. Resolve `alice.bump.eth` to an address

Open the registry read page:

> [ENS L2 Registry Read Contract](https://sepolia.basescan.org/address/0xeb1b97aeda7124560f660f2d900ccd594598525d#readContract)

**Steps:**

1. Call `baseNode()`
2. Call `makeNode(baseNode, "alice")`
3. Call `addr(node)`

That final `addr(node)` result is the resolved wallet for `alice.bump.eth`.

---

### B. Verify address back to ENS

Open the registrar read page:

> [ENS L2 Registrar Read Contract](https://sepolia.basescan.org/address/0x5DCD7071366b400880E01886De44555570F2D4a8#readContract)

**Steps:**

1. Call `getFullName(address)`
2. Confirm it returns `alice.bump.eth`

---

### C. Read ENS text records, including token address

Using the same `node` from step A, call:

1. `text(node, "bump.mode")`
2. `text(node, "bump.default.chain")`
3. `text(node, "bump.default.token")`

> [!IMPORTANT]
> `bump.default.token` is the token address Bump reads from ENS for that profile.

---

## `cast` Commands

```bash
# --- Configuration ---
REGISTRAR=0x5DCD7071366b400880E01886De44555570F2D4a8
REGISTRY=0xeb1b97aeda7124560f660f2d900ccd594598525d

# --- Derive node for alice.bump.eth ---
BASE_NODE=$(cast call $REGISTRY "baseNode()(bytes32)" --rpc-url $BASE_SEPOLIA_RPC_URL)
NODE=$(cast call $REGISTRY "makeNode(bytes32,string)(bytes32)" $BASE_NODE "alice" --rpc-url $BASE_SEPOLIA_RPC_URL)

# --- Resolve ENS to address ---
# alice.bump.eth -> address
cast call $REGISTRY "addr(bytes32)(address)" $NODE --rpc-url $BASE_SEPOLIA_RPC_URL

# --- Reverse lookup ---
# address -> alice.bump.eth
cast call $REGISTRAR "getFullName(address)(string)" 0xUSER_ADDRESS --rpc-url $BASE_SEPOLIA_RPC_URL

# --- Read ENS text records ---
cast call $REGISTRY "text(bytes32,string)(string)" $NODE "bump.mode" --rpc-url $BASE_SEPOLIA_RPC_URL
cast call $REGISTRY "text(bytes32,string)(string)" $NODE "bump.default.chain" --rpc-url $BASE_SEPOLIA_RPC_URL
cast call $REGISTRY "text(bytes32,string)(string)" $NODE "bump.default.token" --rpc-url $BASE_SEPOLIA_RPC_URL
```

---

## Minimal Code Pointers

| Description | File |
| :--- | :--- |
| **Domain + ENS addresses** | [lib/ens/config.ts](lib/ens/config.ts#L17) |
| **ENS ABI surface** | [lib/ens/contracts.ts](lib/ens/contracts.ts#L20) |
| **ENS read/write service** | [lib/ens/service.ts](lib/ens/service.ts#L62) |
| **ENS-backed recipient resolution** | [lib/recipient-profile/index.ts](lib/recipient-profile/index.ts#L90) |
| **Payment verifier contract** | [packages/contracts/src/NFCPaymentVerifier.sol](packages/contracts/src/NFCPaymentVerifier.sol#L13) |
