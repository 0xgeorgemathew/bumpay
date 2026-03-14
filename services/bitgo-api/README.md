# BitGo Merchant API

Backend service for the Merchant BitGo privacy rail in Bump.

## Setup

1. Copy `.env.example` to `.env`
2. Fill in your BitGo test credentials and wallet passphrase
3. Install dependencies

```bash
npm install
```

4. Start the service

```bash
npm run dev
```

## Required config

- `BITGO_ACCESS_TOKEN`
- `BITGO_ENTERPRISE_ID`
- `BITGO_WALLET_PASSPHRASE`
- `BITGO_WEBHOOK_PUBLIC_URL`
- `MERCHANT_TOKEN_ADDRESS`
- `BITGO_MERCHANT_TOKEN_NAME` for BitGo-managed token withdrawals

## Notes

- This service uses BitGo test env with `tbaseeth`
- Checkout data is persisted to a local JSON store
- Customer payments are confirmed with a Base Sepolia RPC receipt fallback even if BitGo webhook delivery is delayed
- Merchant withdrawals use the BitGo SDK `wallet.sendMany(...)`
