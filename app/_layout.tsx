import { Stack } from "expo-router";
import { PrivyProvider } from "@privy-io/expo";
import { PrivyElements } from "@privy-io/expo/ui";
import { SmartWalletsProvider } from "@privy-io/expo/smart-wallets";
import { baseSepolia } from "viem/chains";
import { COLORS } from "../constants/theme";
import { BalanceProvider } from "../lib/balance-context";
import { TransactionProvider } from "../lib/transaction-context";
import { BumpEnsDraftProvider } from "../lib/ens/bump-ens-context";
import { OperationalWalletProvider } from "../lib/wallet";

export default function RootLayout() {
  return (
    <PrivyProvider
      appId={process.env.EXPO_PUBLIC_PRIVY_APP_ID || ""}
      clientId={process.env.EXPO_PUBLIC_PRIVY_CLIENT_ID || ""}
      supportedChains={[baseSepolia]}
      config={{
        embedded: {
          ethereum: {
            createOnLogin: "all-users",
          },
        },
      }}
    >
      <SmartWalletsProvider>
        <OperationalWalletProvider>
          <BumpEnsDraftProvider>
            <BalanceProvider>
              <TransactionProvider>
                <Stack
                screenOptions={{
                  headerShown: false,
                  contentStyle: { backgroundColor: COLORS.background },
                  animation: "none",
                }}
              >
                <Stack.Screen name="index" />
                <Stack.Screen name="login" />
                <Stack.Screen name="(tabs)" />
                <Stack.Screen name="pay" />
                <Stack.Screen name="pay-nfc" />
                <Stack.Screen name="request-payment" />
                <Stack.Screen name="pay-merchant" />
                <Stack.Screen name="receive" />
                <Stack.Screen name="payment-success" />
                <Stack.Screen name="ens-onboarding" />
                <Stack.Screen name="ens-profile" />
                </Stack>
              </TransactionProvider>
            </BalanceProvider>
          </BumpEnsDraftProvider>
        </OperationalWalletProvider>
      </SmartWalletsProvider>
      <PrivyElements />
    </PrivyProvider>
  );
}
