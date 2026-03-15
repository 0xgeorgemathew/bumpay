# BitGo Integration in Bump

This document describes how BitGo is used in the Bump project for merchant payment processing.


## Project Structure

```
services/bitgo-api/           # Standalone Express backend
├── src/
│   ├── index.ts              # Server entry point
│   ├── config.ts             # Environment configuration
│   ├── store.ts              # JSON file persistence layer
│   ├── bitgo-client.ts       # Core BitGo service logic
│   └── routes/
│       ├── merchant.ts       # Merchant API endpoints
│       └── webhooks.ts       # BitGo webhook handler

lib/bitgo/client.ts           # Frontend API client
```

## BitGo SDK Usage

### Initialization

```typescript
import { BitGo } from "bitgo";

const bitgo = new BitGo({
  env: "test",              // "test" or "prod"
  accessToken: "..."        // BitGo access token
});
```

**Source:** `services/bitgo-api/src/bitgo-client.ts:467-470`

### Configuration

| Variable | Description |
|----------|-------------|
| `BITGO_ENV` | Environment: `test` or `prod` |
| `BITGO_ACCESS_TOKEN` | API authentication token |
| `BITGO_ENTERPRISE_ID` | Enterprise ID for wallet creation |
| `BITGO_COIN` | Coin type (default: `tbaseeth`) |
| `BITGO_WALLET_PASSPHRASE` | Wallet encryption passphrase |
| `BITGO_MERCHANT_TOKEN_NAME` | Token for withdrawals (e.g., `tbaseeth:usdc`) |

**Source:** `services/bitgo-api/src/config.ts`

---

## BitGo APIs Used

### 1. Wallet Generation

**Endpoint:** `wallets().generateWallet()`

```typescript
const wallets = bitgo.coin("tbaseeth").wallets();
const wallet = await wallets.generateWallet({
  label: "Bump Merchant <name>",
  passphrase: "...",
  enterprise: "<enterprise-id>",
  type: "hot",
  multisigType: "tss",
  walletVersion: 5,
});
```

**Purpose:** Creates a new TSS (Threshold Signature Scheme) hot wallet for each merchant.

**Source:** `services/bitgo-api/src/bitgo-client.ts:885-893`

---

### 2. Get Wallet

**Endpoint:** `coin().wallets().get()`

```typescript
const wallet = await bitgo.coin("tbaseeth").wallets().get({ id: walletId });
```

**Purpose:** Retrieves wallet details including balance and addresses.

**Source:** `services/bitgo-api/src/bitgo-client.ts:646-648`

---

### 3. Create Receive Address

**Endpoint:** `wallet.createAddress()`

```typescript
const address = await wallet.createAddress({
  label: `checkout-${Date.now()}`
});
```

**Purpose:** Generates a unique deposit address for each checkout session.

**Source:** `services/bitgo-api/src/bitgo-client.ts:939-941`

---

### 4. Wallet Webhooks

**Endpoint:** `wallet.addWebhook()`

```typescript
await wallet.addWebhook({
  url: "https://<domain>/api/bitgo/webhooks/wallet",
  type: "transfer"  // or "transaction", "pendingapproval", "address_confirmation"
});
```

**Purpose:** Registers webhooks for wallet events (transfers, confirmations).

**Source:** `services/bitgo-api/src/bitgo-client.ts:859-865`

---

### 5. List Wallet Webhooks

**Endpoint:** `wallet.listWebhooks()`

```typescript
const webhooks = await wallet.listWebhooks();
```

**Purpose:** Checks existing webhook subscriptions before adding new ones.

**Source:** `services/bitgo-api/src/bitgo-client.ts:855`

---

### 6. Get Wallet Details (REST API)

**Endpoint:** `GET /api/v2/{coin}/wallet/{walletId}?allTokens=true`

```typescript
const payload = await bitgo.get(
  `${envUri}/api/v2/tbaseeth/wallet/${walletId}?allTokens=true`
);
```

**Purpose:** Fetches wallet snapshot including token balances and consolidation status.

**Source:** `services/bitgo-api/src/bitgo-client.ts:651-653`

---

### 7. List Wallet Transfers

**Endpoint:** `wallet.transfers()`

```typescript
const transfers = await wallet.transfers({
  limit: 500,
  address: [receiveAddresses],
  allTokens: true,
});
```

**Purpose:** Retrieves transfer history to verify customer payments.

**Source:** `services/bitgo-api/src/bitgo-client.ts:667-672`

---

### 8. Get Transfer by ID (REST API)

**Endpoint:** `GET /api/v2/{coin}/wallet/{walletId}/transfer/{transferId}`

```typescript
const transfer = await bitgo.get(
  `${envUri}/api/v2/tbaseeth/wallet/${walletId}/transfer/${transferId}`
);
```

**Purpose:** Fetches individual transfer details for verification.

**Source:** `services/bitgo-api/src/bitgo-client.ts:723-724`

---

### 9. Create Transaction Request (Withdrawal)

**Endpoint:** `POST /api/v2/wallet/{walletId}/txrequests`

```typescript
const response = await bitgo.post(
  `${envUri}/api/v2/wallet/${walletId}/txrequests`
).send({
  idempotencyKey: crypto.randomUUID(),
  intent: {
    intentType: "transferToken",
    recipients: [{
      address: { address: destinationAddress },
      amount: { value: "1000000", symbol: "tbaseeth:usdc" },
      tokenData: {
        tokenName: "tbaseeth:usdc",
        tokenType: "ERC20",
        tokenQuantity: "1000000"
      }
    }],
    isTss: true
  },
  apiVersion: "full",
  preview: false
});
```

**Purpose:** Creates a withdrawal request to transfer tokens from merchant wallet.

**Source:** `services/bitgo-api/src/bitgo-client.ts:486-520`

---

### 10. Get Transaction Request Status

**Endpoint:** `GET /api/v2/wallet/{walletId}/txrequests?txRequestIds={id}`

```typescript
const result = await bitgo.get(
  `${envUri}/api/v2/wallet/${walletId}/txrequests?txRequestIds=${txRequestId}`
);
```

**Purpose:** Polls withdrawal request status for updates.

**Source:** `services/bitgo-api/src/bitgo-client.ts:527-529`

---

### 11. Build Account Consolidations

**Endpoint:** `wallet.buildAccountConsolidations()`

```typescript
const consolidations = await wallet.buildAccountConsolidations({
  consolidateAddresses: [address1, address2, ...]
});
```

**Purpose:** Prepares consolidation transactions for multiple receive addresses.

**Source:** `services/bitgo-api/src/bitgo-client.ts:1418-1420`

---

### 12. Send Account Consolidation

**Endpoint:** `wallet.sendAccountConsolidation()`

```typescript
const result = await wallet.sendAccountConsolidation({
  walletPassphrase: "...",
  prebuildTx: consolidationTx
});
```

**Purpose:** Signs and broadcasts consolidation transactions.

**Source:** `services/bitgo-api/src/bitgo-client.ts:1428-1431`

---

## Frontend API Client

The mobile app communicates with the BitGo API service through `lib/bitgo/client.ts`:

| Function | Endpoint | Purpose |
|----------|----------|---------|
| `createMerchantBitGoCheckout()` | `POST /api/bitgo/merchant/checkouts` | Create payment checkout |
| `getMerchantBitGoSummary()` | `GET /api/bitgo/merchant/summary` | Get merchant balance |
| `getMerchantBitGoCheckout()` | `GET /api/bitgo/merchant/checkouts/:id` | Get checkout status |
| `reportMerchantBitGoCustomerTransaction()` | `POST /checkouts/:id/customer-tx` | Report customer payment |
| `withdrawMerchantBitGoFunds()` | `POST /api/bitgo/merchant/withdrawals` | Withdraw to external address |
| `getMerchantBitGoWithdrawalStatus()` | `GET /withdrawals/status` | Check withdrawal status |
| `consolidateMerchantBitGoFunds()` | `POST /api/bitgo/merchant/consolidate` | Consolidate receive addresses |

---

## Data Flow

### Checkout Creation

1. Merchant initiates checkout from mobile app
2. Backend ensures merchant has a BitGo wallet (creates if needed)
3. Backend generates a unique receive address via `wallet.createAddress()`
4. Checkout record is stored with status `ready` or `initializing_address`

### Payment Confirmation

1. Customer sends tokens to the receive address
2. BitGo webhook fires → `/api/bitgo/webhooks/wallet`
3. Backend matches webhook to checkout, updates status to `deposit_detected`
4. Alternatively, mobile app reports transaction hash directly
5. Backend verifies on-chain receipt via viem (Base Sepolia RPC)
6. Status updated to `settled` on successful confirmation

### Withdrawal Flow

1. Merchant requests withdrawal from mobile app
2. Backend validates withdrawal amount matches checkout receipts
3. Creates transaction request via BitGo txrequests API
4. Returns request ID for status polling
5. Signing happens in BitGo dashboard (requires enterprise approval)

---

## Environment

- **Network:** Base Sepolia testnet (chain ID: 84532)
- **Coin:** `tbaseeth` (test Base ETH)
- **Token:** USDC test token (`0x036CbD53842c5426634e7929541eC2318f3dCF7e`)
- **Wallet Type:** Hot wallet with TSS (multisigType: "tss")

---

## Key Implementation Details

1. **One wallet per merchant:** Each merchant address gets its own BitGo wallet
2. **Unique addresses per checkout:** New receive address generated for each payment
3. **Webhook + polling fallback:** Webhooks for real-time, RPC polling for confirmation
4. **Transaction verification:** Uses viem to verify ERC20 Transfer events on-chain
5. **Withdrawal limits:** Amount must exactly match `checkoutReceiptsAvailable` balance
