The Date is March 2026
This file provides guidance to AI Agents when working with code in this repository.

## Project Overview

Bump is an NFC tap-to-pay wallet mobile app built with Expo (Android only). It uses Privy for authentication and embedded EVM smart wallets on Base Sepolia testnet.

## Commands

```bash
# Start development server
npm start

# Platform-specific start
npm run android
npm run ios
npm run web

# Generate native Android project (required before first build)
npm run prebuild
```

**Note:** This project requires `legacy-peer-deps=true` (already in `.npmrc`) due to web3 dependency conflicts.

## Architecture

### Navigation

- Uses `expo-router` with file-based routing in `app/` directory
- `app/_layout.tsx` wraps the app with `PrivyProvider` and required polyfills
- `app/index.tsx` - Splash screen with animated logo
- `app/login.tsx` - Authentication screen with email OTP and Google OAuth

### Design System: Neobrutalism

The app uses a bold, mechanical design language defined in `constants/theme.ts`:

- **Borders:** 3px solid black, `borderRadius: 0` (sharp corners)
- **Shadows:** Hard offset `{ width: 4, height: 4 }`, no blur
- **Haptics:** Heavy impact feedback on every button press via `expo-haptics`
- **Animations:** Mechanical, abrupt - no soft transitions

UI components (`NeoButton`, `NeoInput`) implement this design system consistently.

### Web3/Crypto Support

React Native doesn't have built-in Node.js modules. Custom polyfills are configured in `metro.config.js`:

```
crypto → react-native-quick-crypto
stream → readable-stream
buffer, util, process → Node polyfills
zlib, http, https, net → Custom stubs in polyfills/
```

The Metro config also forces the `jose` package to use its browser build and handles `ox` module extensions.

### Privy Configuration

- Environment variables required: `EXPO_PUBLIC_PRIVY_APP_ID`, `EXPO_PUBLIC_PRIVY_CLIENT_ID`
- Embedded wallets auto-created on login (`createOnLogin: 'all-users'`)
- Target chain: Base Sepolia (chain ID: 84532)

### TypeScript Configuration

- Path alias: `@/*` maps to root directory
- Extends `expo/tsconfig.base` with strict mode enabled

## Platform

- **Android only** - iOS is not supported
- Package name: `com.bump.wallet`
- URL scheme: `bump://`
- New Architecture enabled (`newArchEnabled: true`)

## File Structure

```
app/           # Screens (expo-router file-based routing)
components/    # Reusable UI components (NeoButton, NeoInput)
constants/     # Theme configuration (colors, shadows, borders)
polyfills/     # Node.js polyfills for React Native (zlib, http, net)
docs/plans/    # Design and implementation planning documents
```
