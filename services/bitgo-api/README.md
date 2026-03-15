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
- Merchant withdrawals create a BitGo token withdrawal request and stop at request submission so signing can finish in the BitGo dashboard

## Deploy To Railway

This service is ready to deploy as its own Railway service.

### Railway service settings

Set the Railway service root directory to:

```bash
services/bitgo-api
```

Railway will detect the [`Dockerfile`](./Dockerfile) in that folder and build the backend from there.

### Railway environment variables

Add these variables in Railway:

- `BITGO_ENV`
- `BITGO_ACCESS_TOKEN`
- `BITGO_ENTERPRISE_ID`
- `BITGO_COIN`
- `BITGO_WALLET_PASSPHRASE`
- `BITGO_WEBHOOK_PUBLIC_URL`
- `BITGO_WEBHOOK_SECRET` if you use webhook verification
- `BITGO_MERCHANT_TOKEN_NAME`
- `MERCHANT_TOKEN_ADDRESS`
- `BASE_SEPOLIA_RPC_URL`
- `BITGO_STORE_FILE`

Recommended values for this project:

```bash
BITGO_ENV=test
BITGO_COIN=tbaseeth
BITGO_MERCHANT_TOKEN_NAME=tbaseeth:usdc
MERCHANT_TOKEN_ADDRESS=0x036CbD53842c5426634e7929541eC2318f3dCF7e
BASE_SEPOLIA_RPC_URL=https://sepolia.base.org
BITGO_STORE_FILE=./data/bitgo-store.json
```

### Webhook URL

After Railway generates your public domain, set:

```bash
BITGO_WEBHOOK_PUBLIC_URL=https://<your-railway-domain>/api/bitgo/webhooks/wallet
```

### Health check

Once deployed, this should respond:

```bash
GET https://<your-railway-domain>/health
```

### Persistence note

This service stores merchant checkout and withdrawal tracking data in `BITGO_STORE_FILE`.

On Railway, the container filesystem is ephemeral by default. For reliable state across redeploys and restarts, either:

- attach a Railway volume and point `BITGO_STORE_FILE` into that mounted path, or
- move this state into a real database later
