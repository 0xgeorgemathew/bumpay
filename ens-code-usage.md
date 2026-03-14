# ENS Code Usage

> A deep map of how this repo uses ENS on Base Sepolia.
>
> Scope: `bump.eth` subdomains, Base Sepolia (`84532`), ENS-backed P2P identity, and the payment contracts that consume ENS-resolved recipients.

---

## 1. At A Glance

| Layer | Purpose | Primary code |
| --- | --- | --- |
| Domain rules | Defines `bump.eth`, chain ID, registrar/registry addresses, and text record keys | [lib/ens/config.ts](/Users/george/Workspace/bumpay/lib/ens/config.ts#L17) |
| Contract surface | Defines the ENS registrar + registry ABI the app actually calls | [lib/ens/contracts.ts](/Users/george/Workspace/bumpay/lib/ens/contracts.ts#L20) |
| Runtime ENS service | Reverse lookup, label checks, node derivation, address resolution, text reads, profile writes | [lib/ens/service.ts](/Users/george/Workspace/bumpay/lib/ens/service.ts#L62) |
| Profile model | Normalizes ENS profile data and builds the `bump.*` text records | [lib/ens/bump-ens.ts](/Users/george/Workspace/bumpay/lib/ens/bump-ens.ts#L39) |
| Recipient resolution | Converts an ENS name into the payment recipient profile used by the NFC flow | [lib/recipient-profile/index.ts](/Users/george/Workspace/bumpay/lib/recipient-profile/index.ts#L90) |
| NFC payloads | Sends ENS names over NFC instead of raw recipient addresses for P2P | [lib/payments/request.ts](/Users/george/Workspace/bumpay/lib/payments/request.ts#L9), [lib/nfc/protocol.ts](/Users/george/Workspace/bumpay/lib/nfc/protocol.ts#L21) |
| User flows | Claim ENS, sync profile records, show ENS names in receive/pay screens | [app/ens-onboarding.tsx](/Users/george/Workspace/bumpay/app/ens-onboarding.tsx#L107), [components/EnsPreferencesCard.tsx](/Users/george/Workspace/bumpay/components/EnsPreferencesCard.tsx#L75) |

---

## 2. Contract Inventory

### Core ENS contracts used by the app

| Contract | Role in this repo | Address | Base Sepolia link | Code/config |
| --- | --- | --- | --- | --- |
| ENS L2 Registrar | Reverse lookup, availability checks, subdomain registration | `0x5DCD7071366b400880E01886De44555570F2D4a8` | [Open on BaseScan](https://sepolia.basescan.org/address/0x5DCD7071366b400880E01886De44555570F2D4a8) | [lib/ens/config.ts](/Users/george/Workspace/bumpay/lib/ens/config.ts#L32), [lib/ens/contracts.ts](/Users/george/Workspace/bumpay/lib/ens/contracts.ts#L20) |
| ENS L2 Registry | Node derivation, owner checks, address resolution, text records | `0xeb1b97aeda7124560f660f2d900ccd594598525d` | [Open on BaseScan](https://sepolia.basescan.org/address/0xeb1b97aeda7124560f660f2d900ccd594598525d) | [lib/ens/config.ts](/Users/george/Workspace/bumpay/lib/ens/config.ts#L38), [lib/ens/contracts.ts](/Users/george/Workspace/bumpay/lib/ens/contracts.ts#L62) |

### Bump payment-path contracts connected to ENS resolution

| Contract | Role in this repo | Address | Base Sepolia link | Code/config |
| --- | --- | --- | --- | --- |
| NFCPaymentVerifier | Final payment claim contract after the client resolves ENS to a wallet address | `0xe1247d0F2F2bd41c4bA1f10bC2D1394F1462Ca13` | [Open on BaseScan](https://sepolia.basescan.org/address/0xe1247d0F2F2bd41c4bA1f10bC2D1394F1462Ca13) | [lib/blockchain/contracts.ts](/Users/george/Workspace/bumpay/lib/blockchain/contracts.ts#L22), [packages/contracts/src/NFCPaymentVerifier.sol](/Users/george/Workspace/bumpay/packages/contracts/src/NFCPaymentVerifier.sol#L13), [packages/contracts/deployments/84532.json](/Users/george/Workspace/bumpay/packages/contracts/deployments/84532.json#L1) |
| USDC faucet token | Default ENS profile token and default payment token | `0xba50Cd2A20f6DA35D788639E581bca8d0B5d4D5f` | [Open on BaseScan](https://sepolia.basescan.org/address/0xba50Cd2A20f6DA35D788639E581bca8d0B5d4D5f) | [lib/blockchain/contracts.ts](/Users/george/Workspace/bumpay/lib/blockchain/contracts.ts#L16) |
| USDT faucet token | Alternate supported payment token | `0x0a215D8ba66387DCA84B284D18c3B4ec3de6E54a` | [Open on BaseScan](https://sepolia.basescan.org/address/0x0a215D8ba66387DCA84B284D18c3B4ec3de6E54a) | [lib/blockchain/contracts.ts](/Users/george/Workspace/bumpay/lib/blockchain/contracts.ts#L18) |
| Faucet | Third-party mint helper for test tokens | `0xD9145b5F45Ad4519c7ACcD6E0A4A82e83bB8A6Dc` | [Open on BaseScan](https://sepolia.basescan.org/address/0xD9145b5F45Ad4519c7ACcD6E0A4A82e83bB8A6Dc) | [lib/blockchain/external-contracts.ts](/Users/george/Workspace/bumpay/lib/blockchain/external-contracts.ts#L9) |

### Solidity contracts present in the repo

| Contract | Status | Base Sepolia address | Source |
| --- | --- | --- | --- |
| `NFCPaymentVerifier` | Deployed and wired into the app | `0xe1247d0F2F2bd41c4bA1f10bC2D1394F1462Ca13` | [packages/contracts/src/NFCPaymentVerifier.sol](/Users/george/Workspace/bumpay/packages/contracts/src/NFCPaymentVerifier.sol#L13) |
| `BumpExecutor` | Source-only, not listed in deployment metadata | None in repo metadata | [packages/contracts/src/BumpExecutor.sol](/Users/george/Workspace/bumpay/packages/contracts/src/BumpExecutor.sol#L12) |
| `IERC20` | Interface only | N/A | [packages/contracts/src/interfaces/IERC20.sol](/Users/george/Workspace/bumpay/packages/contracts/src/interfaces/IERC20.sol#L6) |
| `ERC1271Wallet` | Test mock only | N/A | [packages/contracts/test/mocks/ERC1271Wallet.sol](/Users/george/Workspace/bumpay/packages/contracts/test/mocks/ERC1271Wallet.sol#L8) |
| `MockERC20` | Test mock only | N/A | [packages/contracts/test/mocks/MockERC20.sol](/Users/george/Workspace/bumpay/packages/contracts/test/mocks/MockERC20.sol#L7) |

---

## 3. Deep ENS Code Map

### Core ENS implementation

| File | What it does |
| --- | --- |
| [lib/ens/config.ts](/Users/george/Workspace/bumpay/lib/ens/config.ts#L17) | Defines the ENS parent domain (`bump.eth`), chain ID, registrar address, registry address, and the four Bump text record keys. |
| [lib/ens/contracts.ts](/Users/george/Workspace/bumpay/lib/ens/contracts.ts#L20) | Defines the ABI surface the app relies on: `getFullName`, `available`, `register`, `baseNode`, `makeNode`, `owner`, `resolver`, `addr`, `text`, `setText`. |
| [lib/ens/service.ts](/Users/george/Workspace/bumpay/lib/ens/service.ts#L62) | Main runtime service. Reads reverse names, checks availability, derives nodes, resolves `addr`, reads `text`, writes `setText`, and encodes `register`. |
| [lib/ens/bump-ens.ts](/Users/george/Workspace/bumpay/lib/ens/bump-ens.ts#L61) | Defines the normalized ENS profile shape and converts it into `bump.profile.version`, `bump.mode`, `bump.default.chain`, and `bump.default.token`. |
| [lib/ens/bump-ens-context.tsx](/Users/george/Workspace/bumpay/lib/ens/bump-ens-context.tsx#L23) | Stores the in-app ENS draft before or after syncing it onchain. |

### Recipient and NFC resolution path

| File | What it does |
| --- | --- |
| [lib/recipient-profile/index.ts](/Users/george/Workspace/bumpay/lib/recipient-profile/index.ts#L90) | Resolves ENS names into recipient profiles for payment planning and validates the resolved onchain profile. |
| [lib/payments/request.ts](/Users/george/Workspace/bumpay/lib/payments/request.ts#L9) | Defines the ENS-first P2P NFC request format: the sender can publish `ensName` instead of a raw recipient address. |
| [lib/nfc/protocol.ts](/Users/george/Workspace/bumpay/lib/nfc/protocol.ts#L45) | Serializes/deserializes the NFC messages and explicitly supports ENS-based requests. |

### Claim + profile sync UI

| File | What it does |
| --- | --- |
| [app/ens-onboarding.tsx](/Users/george/Workspace/bumpay/app/ens-onboarding.tsx#L107) | Full ENS onboarding flow: detect existing claim, check availability, claim subdomain, verify ownership, then write Bump text records. |
| [components/EnsPreferencesCard.tsx](/Users/george/Workspace/bumpay/components/EnsPreferencesCard.tsx#L75) | Settings/profile card version of the same flow: hydrate draft from chain, claim a name, save preferences to ENS. |
| [app/ens-profile.tsx](/Users/george/Workspace/bumpay/app/ens-profile.tsx#L37) | Dedicated ENS profile screen that hosts `EnsPreferencesCard`. |
| [components/HomeHeader.tsx](/Users/george/Workspace/bumpay/components/HomeHeader.tsx#L35) | Reads claim status and profile name to show the active ENS identity in the app header. |

### ENS in the payment UX

| File | What it does |
| --- | --- |
| [app/receive.tsx](/Users/george/Workspace/bumpay/app/receive.tsx#L256) | Blocks receive flow until the current wallet has a verified ENS claim, then publishes the ENS name in the NFC request. |
| [app/pay-nfc.tsx](/Users/george/Workspace/bumpay/app/pay-nfc.tsx#L327) | Resolves recipient ENS from NFC, plans the payment, and shows payer/recipient ENS labels in the success flow. |
| [app/pay-merchant.tsx](/Users/george/Workspace/bumpay/app/pay-merchant.tsx#L133) | Resolves merchant and payer ENS names for display during merchant NFC payments. |
| [app/request-payment.tsx](/Users/george/Workspace/bumpay/app/request-payment.tsx#L137) | Resolves merchant and customer ENS names during request-payment sessions for display/state. |

---

## 4. What The ENS Flow Actually Is In This Repo

1. The app treats `bump.eth` as the only valid parent domain for its ENS UX and ignores reverse names outside that suffix. See [extractLabelFromEnsName()](/Users/george/Workspace/bumpay/lib/ens/config.ts#L124) and [getEnsClaimStatus()](/Users/george/Workspace/bumpay/lib/ens/service.ts#L62).
2. Address to ENS is not done through a separate reverse resolver in app code. It calls the registrar directly via `getFullName(address)`. See [lib/ens/contracts.ts](/Users/george/Workspace/bumpay/lib/ens/contracts.ts#L20) and [lib/ens/service.ts](/Users/george/Workspace/bumpay/lib/ens/service.ts#L62).
3. ENS name to address is also not resolved through a separate resolver contract in app code. The app derives the node with `baseNode()` + `makeNode(parent,label)` and then reads `addr(node)` from the registry. See [getNodeForLabel()](/Users/george/Workspace/bumpay/lib/ens/service.ts#L121) and [resolveEnsAddress()](/Users/george/Workspace/bumpay/lib/ens/service.ts#L243).
4. Bump profile metadata is stored as ENS text records directly on the registry using `setText(node,key,value)`. See [prepareSetTextTransaction()](/Users/george/Workspace/bumpay/lib/ens/service.ts#L370) and [buildBumpTextRecordUpdates()](/Users/george/Workspace/bumpay/lib/ens/bump-ens.ts#L169).
5. The payment contract does not resolve ENS onchain. The mobile client resolves ENS first, validates the profile, then passes the resolved wallet into the payment flow. See [lib/recipient-profile/index.ts](/Users/george/Workspace/bumpay/lib/recipient-profile/index.ts#L91) and [packages/contracts/src/NFCPaymentVerifier.sol](/Users/george/Workspace/bumpay/packages/contracts/src/NFCPaymentVerifier.sol#L72).

---

## 5. Bump ENS Text Records

| Key | Meaning | Defined in |
| --- | --- | --- |
| `bump.profile.version` | Profile schema version | [lib/ens/config.ts](/Users/george/Workspace/bumpay/lib/ens/config.ts#L48) |
| `bump.mode` | User mode: `p2p`, `merchant`, or `both` | [lib/ens/config.ts](/Users/george/Workspace/bumpay/lib/ens/config.ts#L48) |
| `bump.default.chain` | Default receiving chain ID | [lib/ens/config.ts](/Users/george/Workspace/bumpay/lib/ens/config.ts#L48) |
| `bump.default.token` | Default receiving token address | [lib/ens/config.ts](/Users/george/Workspace/bumpay/lib/ens/config.ts#L48) |

Current profile normalization and write logic lives in [lib/ens/bump-ens.ts](/Users/george/Workspace/bumpay/lib/ens/bump-ens.ts#L125) and [lib/ens/service.ts](/Users/george/Workspace/bumpay/lib/ens/service.ts#L403).

---

## 6. Check And Verify A User Manually

### ENS name to address

Use this when somebody gives you `alice.bump.eth` and you want the wallet that the app will pay.

#### In the app's actual logic

1. Strip the label from the full name with [extractLabelFromEnsName()](/Users/george/Workspace/bumpay/lib/ens/config.ts#L124).
2. Ask the registry for `baseNode()`.
3. Ask the registry for `makeNode(baseNode, "alice")`.
4. Ask the registry for `addr(node)`.
5. If the result is the zero address, treat it as unresolved.

#### Manually in BaseScan

1. Open the registry: [ENS L2 Registry on BaseScan](https://sepolia.basescan.org/address/0xeb1b97aeda7124560f660f2d900ccd594598525d#readContract)
2. Call `baseNode()`.
3. Call `makeNode(parentNode, label)` using the `baseNode` result and the label only, for example `alice`.
4. Call `addr(node)` with the node from step 3.
5. Compare that address against the wallet you expect.

#### Manually with `cast`

```bash
REGISTRY=0xeb1b97aeda7124560f660f2d900ccd594598525d
BASE_NODE=$(cast call $REGISTRY "baseNode()(bytes32)" --rpc-url $BASE_SEPOLIA_RPC_URL)
NODE=$(cast call $REGISTRY "makeNode(bytes32,string)(bytes32)" $BASE_NODE "alice" --rpc-url $BASE_SEPOLIA_RPC_URL)
cast call $REGISTRY "addr(bytes32)(address)" $NODE --rpc-url $BASE_SEPOLIA_RPC_URL
```

### Address to ENS name

Use this when somebody gives you a wallet and you want to know which `*.bump.eth` name the app will show.

#### In the app's actual logic

1. Call the registrar's `getFullName(address)`.
2. If the result is empty, the app treats the wallet as having no ENS claim.
3. If the returned name is not under `bump.eth`, the app ignores it for the Bump ENS flow.

See [getEnsClaimStatus()](/Users/george/Workspace/bumpay/lib/ens/service.ts#L62).

#### Manually in BaseScan

1. Open the registrar: [ENS L2 Registrar on BaseScan](https://sepolia.basescan.org/address/0x5DCD7071366b400880E01886De44555570F2D4a8#readContract)
2. Call `getFullName(address)` with the user wallet.
3. Confirm the result ends with `.bump.eth`.

#### Manually with `cast`

```bash
REGISTRAR=0x5DCD7071366b400880E01886De44555570F2D4a8
cast call $REGISTRAR "getFullName(address)(string)" 0xUSER_ADDRESS --rpc-url $BASE_SEPOLIA_RPC_URL
```

### Resolve a text record

Use this when you want to read Bump profile metadata from ENS.

#### In the app's actual logic

1. Derive the node exactly the same way as ENS name to address.
2. Call `text(node, key)` on the registry.
3. The important keys are:
   - `bump.profile.version`
   - `bump.mode`
   - `bump.default.chain`
   - `bump.default.token`

See [readTextRecord()](/Users/george/Workspace/bumpay/lib/ens/service.ts#L177) and [readEnsProfileByNode()](/Users/george/Workspace/bumpay/lib/ens/service.ts#L208).

#### Manually in BaseScan

1. Open the registry read page: [ENS L2 Registry on BaseScan](https://sepolia.basescan.org/address/0xeb1b97aeda7124560f660f2d900ccd594598525d#readContract)
2. Compute the node with `baseNode()` and `makeNode(parentNode,label)`.
3. Call `text(node, key)` with one of the keys above.

#### Manually with `cast`

```bash
REGISTRY=0xeb1b97aeda7124560f660f2d900ccd594598525d
BASE_NODE=$(cast call $REGISTRY "baseNode()(bytes32)" --rpc-url $BASE_SEPOLIA_RPC_URL)
NODE=$(cast call $REGISTRY "makeNode(bytes32,string)(bytes32)" $BASE_NODE "alice" --rpc-url $BASE_SEPOLIA_RPC_URL)
cast call $REGISTRY "text(bytes32,string)(string)" $NODE "bump.mode" --rpc-url $BASE_SEPOLIA_RPC_URL
cast call $REGISTRY "text(bytes32,string)(string)" $NODE "bump.default.chain" --rpc-url $BASE_SEPOLIA_RPC_URL
cast call $REGISTRY "text(bytes32,string)(string)" $NODE "bump.default.token" --rpc-url $BASE_SEPOLIA_RPC_URL
```

### Best manual verification flow for a user

If you want to be strict, do all of this:

1. Start from the wallet address and call `getFullName(address)` on the registrar.
2. Confirm the returned name is under `bump.eth`.
3. Extract the label and derive the node with `baseNode()` and `makeNode(parentNode,label)`.
4. Read `owner(node)` and confirm it matches the wallet that is supposed to control the name.
5. Read `addr(node)` and confirm it matches the payment wallet you expect to send funds to.
6. Read the Bump text records with `text(node,key)` and confirm the mode, chain, and token settings are correct.

`owner(node)` is especially important when verifying who controls the ENS record before writing profile data. The app uses the same check in [app/ens-onboarding.tsx](/Users/george/Workspace/bumpay/app/ens-onboarding.tsx#L395) and [components/EnsPreferencesCard.tsx](/Users/george/Workspace/bumpay/components/EnsPreferencesCard.tsx#L289).

---

## 7. Important Caveats Found In The Scan

| Caveat | Why it matters | Where enforced |
| --- | --- | --- |
| Only `*.bump.eth` is accepted for the Bump ENS flow | Reverse names outside this parent domain are ignored | [lib/ens/config.ts](/Users/george/Workspace/bumpay/lib/ens/config.ts#L124), [lib/ens/service.ts](/Users/george/Workspace/bumpay/lib/ens/service.ts#L75) |
| `merchant` mode alone is rejected for payment resolution | A profile can exist onchain but still fail payment validation | [lib/ens/service.ts](/Users/george/Workspace/bumpay/lib/ens/service.ts#L429) |
| Base Sepolia is the only supported settlement chain in v1 | ENS profile chain must be `84532` | [lib/ens/service.ts](/Users/george/Workspace/bumpay/lib/ens/service.ts#L440) |
| Supported settlement tokens are pinned to the configured USDC/USDT addresses | A valid ENS name can still be rejected if its token record is unsupported | [lib/blockchain/contracts.ts](/Users/george/Workspace/bumpay/lib/blockchain/contracts.ts#L16), [lib/ens/service.ts](/Users/george/Workspace/bumpay/lib/ens/service.ts#L445) |
| The app exposes `resolver(node)` in ABI but does not use it in runtime resolution | This implementation resolves via the registry contract directly | [lib/ens/contracts.ts](/Users/george/Workspace/bumpay/lib/ens/contracts.ts#L109), [lib/ens/service.ts](/Users/george/Workspace/bumpay/lib/ens/service.ts#L243) |

---

## 8. Fast Navigation Index

| Destination | Link |
| --- | --- |
| ENS config | [lib/ens/config.ts](/Users/george/Workspace/bumpay/lib/ens/config.ts) |
| ENS ABI definitions | [lib/ens/contracts.ts](/Users/george/Workspace/bumpay/lib/ens/contracts.ts) |
| ENS service layer | [lib/ens/service.ts](/Users/george/Workspace/bumpay/lib/ens/service.ts) |
| ENS profile model | [lib/ens/bump-ens.ts](/Users/george/Workspace/bumpay/lib/ens/bump-ens.ts) |
| ENS draft context | [lib/ens/bump-ens-context.tsx](/Users/george/Workspace/bumpay/lib/ens/bump-ens-context.tsx) |
| Recipient resolution | [lib/recipient-profile/index.ts](/Users/george/Workspace/bumpay/lib/recipient-profile/index.ts) |
| Payment request types | [lib/payments/request.ts](/Users/george/Workspace/bumpay/lib/payments/request.ts) |
| NFC protocol | [lib/nfc/protocol.ts](/Users/george/Workspace/bumpay/lib/nfc/protocol.ts) |
| ENS onboarding screen | [app/ens-onboarding.tsx](/Users/george/Workspace/bumpay/app/ens-onboarding.tsx) |
| ENS profile screen | [app/ens-profile.tsx](/Users/george/Workspace/bumpay/app/ens-profile.tsx) |
| ENS preferences card | [components/EnsPreferencesCard.tsx](/Users/george/Workspace/bumpay/components/EnsPreferencesCard.tsx) |
| Home header ENS display | [components/HomeHeader.tsx](/Users/george/Workspace/bumpay/components/HomeHeader.tsx) |
| Receive flow ENS verification | [app/receive.tsx](/Users/george/Workspace/bumpay/app/receive.tsx) |
| P2P pay flow ENS resolution | [app/pay-nfc.tsx](/Users/george/Workspace/bumpay/app/pay-nfc.tsx) |
| Merchant pay screen ENS display | [app/pay-merchant.tsx](/Users/george/Workspace/bumpay/app/pay-merchant.tsx) |
| Merchant request screen ENS display | [app/request-payment.tsx](/Users/george/Workspace/bumpay/app/request-payment.tsx) |
| Payment verifier contract | [packages/contracts/src/NFCPaymentVerifier.sol](/Users/george/Workspace/bumpay/packages/contracts/src/NFCPaymentVerifier.sol) |
| Alternate executor contract | [packages/contracts/src/BumpExecutor.sol](/Users/george/Workspace/bumpay/packages/contracts/src/BumpExecutor.sol) |
| Deployment metadata | [packages/contracts/deployments/84532.json](/Users/george/Workspace/bumpay/packages/contracts/deployments/84532.json) |

