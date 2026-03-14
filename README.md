# Bump

Bump is an Android app for sending and receiving crypto with a phone tap.

It brings together a wallet, a merchant checkout flow, human-readable ENS names, and simple payment records in one product. The goal is straightforward: make onchain payments feel closer to contactless payments people already understand.

[![Expo](https://img.shields.io/badge/Expo-55.0-000000?style=flat-square&logo=expo)](https://expo.dev)
[![Android](https://img.shields.io/badge/Android-Only-3DDC84?style=flat-square&logo=android&labelColor=000000)](https://developer.android.com)
[![Base](https://img.shields.io/badge/Base-Sepolia-0052FF?style=flat-square&logo=base&labelColor=000000)](https://www.base.org)

## What Bump Does

Bump is built around a few simple product ideas:

- Tap to pay instead of copying addresses or scanning codes
- Use an ENS name instead of a wallet string
- Let merchants create a quick checkout from the same app
- Keep a readable record of completed payments

In the app, a user can log in, get a wallet, claim a `*.bump.eth` name, receive money, pay another user, or run a merchant checkout flow. There is also an optional privacy flow for merchant payments backed by the BitGo service in this repo.

## Main Product Flows

### Wallet

- Sign in with email or Google
- Provision an embedded wallet and smart wallet
- View demo balances for `USDC` and `USDT`
- Send and receive payments from the app

### Identity

- Claim a `*.bump.eth` name during onboarding
- Save payment preferences to ENS
- Use a name people can remember instead of a long address

### Merchant Checkout

- Add items in a POS-style screen
- Create a payment request
- Let the customer tap and pay
- Track the payment through confirmation

### Payment Records

- Sync completed transactions into a Fileverse-backed ledger
- Keep a simple, readable history of what was sent or received

## Demo Flow

1. Open the app and sign in.
2. Let the wallet finish setting up.
3. Claim an ENS name.
4. Create a merchant checkout or open a receive flow.
5. Tap from the payer device to complete the payment.
6. Show the confirmed transaction and updated history.

## Tech Snapshot

| Layer | Stack |
| --- | --- |
| App | Expo 55, React Native 0.83, TypeScript |
| Auth and wallet | Privy |
| Network | Base Sepolia |
| Tokens | `USDC`, `USDT` |
| Identity | ENS |
| Records | Fileverse |
| Merchant privacy flow | BitGo sidecar service |
| Platform | Android only |

## Quick Start

### Prerequisites

- Node.js 18+
- npm
- Android Studio with an emulator or Android device

### Install

```bash
npm install
```

This repo already includes `legacy-peer-deps=true` in `.npmrc` for web3 dependency compatibility.

### Configure Environment

```bash
cp .env.example .env
```

Fill in the values below:

| Variable | Required | Purpose |
| --- | --- | --- |
| `EXPO_PUBLIC_PRIVY_APP_ID` | Yes | Privy app id |
| `EXPO_PUBLIC_PRIVY_CLIENT_ID` | Yes | Privy client id |
| `EXPO_PUBLIC_FILEVERSE_API_URL` | Optional | Fileverse API base URL |
| `EXPO_PUBLIC_FILEVERSE_API_KEY` | Optional | Fileverse API key |
| `EXPO_PUBLIC_BITGO_API_URL` | Optional | BitGo merchant API base URL |

### Run

```bash
npm start
```

```bash
npm run android
```

If the Android project needs to be generated first:

```bash
npm run prebuild
```

Bump is built for Android. The repo still includes Expo `ios` and `web` scripts, but Android is the supported product target here.

## Optional BitGo Service

The BitGo service is only needed for the merchant privacy flow.

```bash
cd services/bitgo-api
npm install
npm run dev
```

More setup details are in [`services/bitgo-api/README.md`](services/bitgo-api/README.md).

## Project Structure

| Path | Purpose |
| --- | --- |
| [`app/`](app/) | App screens and routes |
| [`components/`](components/) | Shared UI components |
| [`constants/`](constants/) | Theme values and app constants |
| [`lib/`](lib/) | Wallet, ENS, NFC, payment, and record logic |
| [`services/bitgo-api/`](services/bitgo-api/) | Optional merchant privacy backend |
| [`packages/contracts/`](packages/contracts/) | Contract workspace |

## Key Files

- [`app/_layout.tsx`](app/_layout.tsx) sets up the app shell and route stack.
- [`app/login.tsx`](app/login.tsx) handles sign-in.
- [`app/ens-onboarding.tsx`](app/ens-onboarding.tsx) handles ENS setup.
- [`app/receive.tsx`](app/receive.tsx) and [`app/pay-nfc.tsx`](app/pay-nfc.tsx) cover tap-based payment flows.
- [`app/pos-terminal.tsx`](app/pos-terminal.tsx) provides the merchant POS flow.
- [`lib/fileverse/ledger.ts`](lib/fileverse/ledger.ts) stores payment records in Fileverse.

## Related Docs

- [`services/bitgo-api/README.md`](services/bitgo-api/README.md)
- [`packages/contracts/README.md`](packages/contracts/README.md)
- [`AGENTS.md`](AGENTS.md)
