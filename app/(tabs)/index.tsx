import { useEffect, useRef, useMemo } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable } from "react-native";
import { useRouter } from "expo-router";
import { usePrivy } from "@privy-io/expo";
import { HomeHeader } from "../../components/HomeHeader";
import { BalanceCard } from "../../components/BalanceCard";
import { ActionButtons } from "../../components/ActionButtons";
import { TransactionList } from "../../components/TransactionList";
import { COLORS } from "../../constants/theme";
import { useBalance } from "../../lib/balance-context";
import { fromTokenUnits } from "../../lib/blockchain/token-mint";
import { useOperationalWallet } from "../../lib/wallet";

export default function HomeScreen() {
  const router = useRouter();
  const { user, isReady } = usePrivy();
  const { state: balanceState, prefetchBalance } = useBalance();
  const wallet = useOperationalWallet();
  const hasInitialized = useRef(false);

  useEffect(() => {
    if (isReady && !user) {
      router.replace("/login");
    }
  }, [isReady, router, user]);

  useEffect(() => {
    if (!user) {
      hasInitialized.current = false;
      return;
    }

    if (wallet.isReady && !hasInitialized.current) {
      hasInitialized.current = true;
      prefetchBalance();
    }
  }, [prefetchBalance, user, wallet.isReady]);

  const tokens = useMemo(() => {
    const usdcBalance = fromTokenUnits(balanceState.balances.usdc);
    const usdtBalance = fromTokenUnits(balanceState.balances.usdt);
    return [
      {
        symbol: "USDC",
        balance: balanceState.balances.usdc,
        decimals: 6,
        usdValue: usdcBalance,
      },
      {
        symbol: "USDT",
        balance: balanceState.balances.usdt,
        decimals: 6,
        usdValue: usdtBalance,
      },
    ];
  }, [balanceState.balances]);

  if (!isReady || !user) {
    return (
      <View style={styles.container}>
        <View style={styles.loadingBox}>
          <Text style={styles.loadingText}>LOADING...</Text>
        </View>
      </View>
    );
  }

  const handlePay = () => {
    router.push("/pay" as never);
  };

  const handleReceive = () => {
    router.push("/receive" as never);
  };

  const handleDetails = () => {
    router.push("/(tabs)/settings" as never);
  };

  const handleViewAll = () => {
    router.push("/(tabs)/history" as never);
  };

  return (
    <View style={styles.container}>
      <HomeHeader />
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <BalanceCard
          tokens={tokens}
          onDetailsPress={handleDetails}
        />

        {!wallet.isReady ? (
          <View style={styles.provisioningShadow}>
            <View style={styles.provisioningCard}>
              <Text style={styles.provisioningLabel}>WALLET STATUS</Text>
              <Text style={styles.provisioningTitle}>
                {wallet.status === "error" ? "SETUP FAILED" : "SETTING UP YOUR WALLET"}
              </Text>
              <Text style={styles.provisioningText}>
                {wallet.error ??
                  (wallet.status === "creating_embedded"
                    ? "Creating your embedded signer for the first time."
                    : "Waiting for your smart wallet to finish provisioning.")}
              </Text>
              {wallet.status === "error" ? (
                <Pressable onPress={wallet.retryProvisioning} style={styles.retryButton}>
                  <Text style={styles.retryText}>RETRY</Text>
                </Pressable>
              ) : null}
            </View>
          </View>
        ) : null}

        <View style={styles.actionSection}>
          <ActionButtons
            onPay={handlePay}
            onReceive={handleReceive}
            payDisabled={!wallet.isReady}
            receiveDisabled={!wallet.isReady}
          />
        </View>

        <View style={styles.transactionSection}>
          <TransactionList onViewAll={handleViewAll} />
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.backgroundLight,
  },
  loadingBox: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  loadingText: {
    fontSize: 24,
    fontWeight: "900",
    color: COLORS.textPrimary,
    letterSpacing: 4,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    flexGrow: 1,
  },
  actionSection: {
    marginTop: 20,
  },
  transactionSection: {
    marginTop: 20,
  },
  provisioningShadow: {
    marginTop: 20,
    backgroundColor: COLORS.border,
  },
  provisioningCard: {
    backgroundColor: COLORS.yellow400,
    borderWidth: 4,
    borderColor: COLORS.border,
    padding: 16,
    gap: 8,
    transform: [{ translateX: -8 }, { translateY: -8 }],
  },
  provisioningLabel: {
    fontSize: 12,
    fontWeight: "900",
    color: COLORS.textPrimary,
    letterSpacing: 2,
  },
  provisioningTitle: {
    fontSize: 24,
    fontWeight: "900",
    color: COLORS.textPrimary,
  },
  provisioningText: {
    fontSize: 14,
    fontWeight: "700",
    color: COLORS.textPrimary,
    lineHeight: 20,
  },
  retryButton: {
    alignSelf: "flex-start",
    backgroundColor: COLORS.surface,
    borderWidth: 4,
    borderColor: COLORS.border,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  retryText: {
    fontSize: 12,
    fontWeight: "900",
    color: COLORS.textPrimary,
    letterSpacing: 2,
  },
});
