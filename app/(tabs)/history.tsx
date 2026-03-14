import { useCallback, useEffect, useState } from "react";
import { View, Text, StyleSheet, Pressable, ScrollView } from "react-native";
import { useRouter } from "expo-router";
import { usePrivy } from "@privy-io/expo";
import * as Haptics from "expo-haptics";
import { Ionicons } from "@expo/vector-icons";
import { formatUnits } from "viem";
import { HomeHeader } from "../../components/HomeHeader";
import { COLORS, BORDER_THICK } from "../../constants/theme";
import { BITGO_MERCHANT_TOKEN, TOKEN_DECIMALS } from "../../lib/blockchain/contracts";
import {
  getMerchantBitGoSummary,
  type MerchantBitGoSummary,
  type MerchantBitGoWithdrawalResult,
  withdrawMerchantBitGoFunds,
} from "../../lib/bitgo";
import { useOperationalWallet } from "../../lib/wallet";

export default function HistoryScreen() {
  const router = useRouter();
  const { user, isReady } = usePrivy();
  const { smartWalletAddress, isReady: walletReady, readTokenBalance } = useOperationalWallet();
  const [summary, setSummary] = useState<MerchantBitGoSummary | null>(null);
  const [merchantTokenBalance, setMerchantTokenBalance] = useState<bigint>(BigInt(0));
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isWithdrawing, setIsWithdrawing] = useState(false);
  const [withdrawResult, setWithdrawResult] = useState<MerchantBitGoWithdrawalResult | null>(null);

  useEffect(() => {
    if (isReady && !user) {
      router.replace("/login");
    }
  }, [isReady, router, user]);

  const loadSummary = useCallback(async () => {
    if (!walletReady || !smartWalletAddress) {
      setSummary(null);
      setError(null);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const [nextSummary, nextBalance] = await Promise.all([
        getMerchantBitGoSummary(smartWalletAddress),
        readTokenBalance(BITGO_MERCHANT_TOKEN.address),
      ]);
      setSummary(nextSummary);
      setMerchantTokenBalance(nextBalance);
    } catch (nextError) {
      setSummary(null);
      setMerchantTokenBalance(BigInt(0));
      setError(nextError instanceof Error ? nextError.message : "Failed to load merchant privacy summary");
    } finally {
      setIsLoading(false);
    }
  }, [readTokenBalance, smartWalletAddress, walletReady]);

  useEffect(() => {
    loadSummary().catch(() => undefined);
  }, [loadSummary]);

  const handleRefresh = useCallback(async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    await loadSummary();
  }, [loadSummary]);

  const handleWithdraw = useCallback(async () => {
    if (!smartWalletAddress || BigInt(summary?.unclaimedAmount ?? "0") <= BigInt(0)) {
      return;
    }

    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    setIsWithdrawing(true);
    setError(null);
    setWithdrawResult(null);

    try {
      const result = await withdrawMerchantBitGoFunds({
        merchantAddress: smartWalletAddress,
        destinationAddress: smartWalletAddress,
        amount: summary?.unclaimedAmount ?? "0",
      });

      setWithdrawResult(result);
      await loadSummary();
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Failed to withdraw merchant funds");
    } finally {
      setIsWithdrawing(false);
    }
  }, [loadSummary, smartWalletAddress, summary?.unclaimedAmount]);

  const handleCreateCheckout = useCallback(async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    router.push("/merchant-bitgo" as never);
  }, [router]);

  const handlePayMerchant = useCallback(async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    router.push("/pay-merchant-bitgo" as never);
  }, [router]);

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <HomeHeader />

        <View style={styles.balanceShadow}>
          <View style={styles.balanceCard}>
            <View style={styles.balanceHeaderRow}>
              <Text style={styles.balanceLabel}>BITGO MERCHANT</Text>
              <Pressable
                onPress={handleRefresh}
                style={({ pressed }) => [styles.refreshPill, pressed && styles.buttonPressed]}
              >
                <Text style={styles.refreshPillText}>{isLoading ? "SYNCING" : "REFRESH"}</Text>
              </Pressable>
            </View>
            <Text style={styles.balanceValue}>
              {formatUnits(merchantTokenBalance, TOKEN_DECIMALS)}{" "}
              {BITGO_MERCHANT_TOKEN.symbol}
            </Text>
            <Text style={styles.balanceSubtext}>Original wallet balance on Base Sepolia</Text>
            {error ? <Text style={styles.balanceError}>{error}</Text> : null}
          </View>
        </View>

        <View style={styles.summaryShadow}>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryLabel}>MERCHANT PRIVACY</Text>
            <Text style={styles.summaryTitle}>UNCLAIMED FUNDS</Text>
            <Text style={styles.summaryValue}>
              {formatUnits(BigInt(summary?.unclaimedAmount ?? "0"), TOKEN_DECIMALS)}{" "}
              {BITGO_MERCHANT_TOKEN.symbol}
            </Text>
            <Text style={styles.summaryText}>
              Total received: {formatUnits(BigInt(summary?.totalReceived ?? "0"), TOKEN_DECIMALS)}{" "}
              {BITGO_MERCHANT_TOKEN.symbol}
            </Text>
            <Text style={styles.summaryText}>
              Claimed: {formatUnits(BigInt(summary?.claimedAmount ?? "0"), TOKEN_DECIMALS)}{" "}
              {BITGO_MERCHANT_TOKEN.symbol}
            </Text>
            <Text style={styles.summaryText}>
              Unclaimed checkout addresses: {summary?.unclaimedCheckoutCount ?? 0}
            </Text>
            {summary?.walletAddress ? (
              <Text style={styles.summaryText}>
                BitGo wallet: {summary.walletAddress.slice(0, 10)}...{summary.walletAddress.slice(-6)}
              </Text>
            ) : null}
            {withdrawResult ? (
              <Text style={styles.successText}>
                Withdrawal submitted: {withdrawResult.txid ?? withdrawResult.pendingApproval?.id ?? "pending"}
              </Text>
            ) : null}

            <View style={styles.actionShadow}>
              <Pressable
                onPress={handleWithdraw}
                style={[styles.withdrawButton, (isWithdrawing || BigInt(summary?.unclaimedAmount ?? "0") <= BigInt(0)) && styles.disabledButton]}
                disabled={isWithdrawing || BigInt(summary?.unclaimedAmount ?? "0") <= BigInt(0)}
              >
                <Text style={styles.withdrawButtonText}>
                  {isWithdrawing ? "WITHDRAWING..." : "WITHDRAW TO MY WALLET"}
                </Text>
              </Pressable>
            </View>
          </View>
        </View>

        <View style={styles.buttonStack}>
          <View style={styles.buttonShadow}>
            <Pressable
              onPress={handleCreateCheckout}
              style={({ pressed }) => [
                styles.button,
                styles.requestButton,
                pressed && styles.buttonPressed,
              ]}
            >
              <View style={styles.iconContainer}>
                <Ionicons name="shield-checkmark" size={32} color={COLORS.textPrimary} />
              </View>
              <View style={styles.buttonTextContainer}>
                <Text style={styles.buttonTitle}>MAKE PAYMENT</Text>
                <Text style={styles.buttonSubtitle}>Create a fresh private BitGo checkout</Text>
              </View>
            </Pressable>
          </View>

          <View style={styles.buttonShadow}>
            <Pressable
              onPress={handlePayMerchant}
              style={({ pressed }) => [
                styles.button,
                styles.payButton,
                pressed && styles.buttonPressed,
              ]}
            >
              <View style={styles.iconContainer}>
                <Ionicons name="wallet" size={32} color={COLORS.textPrimary} />
              </View>
              <View style={styles.buttonTextContainer}>
                <Text style={styles.buttonTitle}>PAY MERCHANT</Text>
                <Text style={styles.buttonSubtitle}>Tap and pay a masked merchant checkout</Text>
              </View>
            </Pressable>
          </View>
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
  scrollView: {
    flex: 1,
  },
  content: {
    padding: 16,
    gap: 20,
    paddingBottom: 32,
  },
  balanceShadow: {
    backgroundColor: COLORS.border,
  },
  balanceCard: {
    backgroundColor: COLORS.surface,
    borderWidth: BORDER_THICK.width,
    borderColor: COLORS.border,
    padding: 16,
    gap: 8,
    transform: [{ translateX: -8 }, { translateY: -8 }],
  },
  balanceHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  balanceLabel: {
    fontSize: 12,
    fontWeight: "900",
    color: COLORS.textMuted,
    letterSpacing: 2,
  },
  refreshPill: {
    backgroundColor: COLORS.yellow400,
    borderWidth: BORDER_THICK.width,
    borderColor: COLORS.border,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  refreshPillText: {
    fontSize: 10,
    fontWeight: "900",
    color: COLORS.textPrimary,
    letterSpacing: 1,
  },
  balanceValue: {
    fontSize: 34,
    fontWeight: "900",
    color: COLORS.textPrimary,
  },
  balanceSubtext: {
    fontSize: 13,
    fontWeight: "700",
    color: COLORS.textPrimary,
    opacity: 0.75,
  },
  balanceError: {
    fontSize: 13,
    fontWeight: "800",
    color: COLORS.error,
  },
  summaryShadow: {
    backgroundColor: COLORS.border,
  },
  summaryCard: {
    backgroundColor: COLORS.surface,
    borderWidth: BORDER_THICK.width,
    borderColor: COLORS.border,
    padding: 16,
    gap: 8,
    transform: [{ translateX: -8 }, { translateY: -8 }],
  },
  summaryLabel: {
    fontSize: 12,
    fontWeight: "900",
    color: COLORS.textMuted,
    letterSpacing: 2,
  },
  summaryTitle: {
    fontSize: 24,
    fontWeight: "900",
    color: COLORS.textPrimary,
  },
  summaryValue: {
    fontSize: 28,
    fontWeight: "900",
    color: COLORS.textPrimary,
  },
  summaryText: {
    fontSize: 13,
    fontWeight: "700",
    color: COLORS.textPrimary,
    lineHeight: 20,
  },
  successText: {
    fontSize: 13,
    fontWeight: "900",
    color: COLORS.success,
    lineHeight: 20,
  },
  actionShadow: {
    marginTop: 8,
    backgroundColor: COLORS.border,
  },
  withdrawButton: {
    backgroundColor: COLORS.yellow400,
    borderWidth: BORDER_THICK.width,
    borderColor: COLORS.border,
    paddingVertical: 16,
    alignItems: "center",
    transform: [{ translateX: -8 }, { translateY: -8 }],
  },
  withdrawButtonText: {
    fontSize: 15,
    fontWeight: "900",
    color: COLORS.textPrimary,
    letterSpacing: 2,
  },
  disabledButton: {
    opacity: 0.6,
  },
  buttonStack: {
    gap: 16,
  },
  buttonShadow: {
    backgroundColor: COLORS.border,
  },
  button: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 20,
    paddingHorizontal: 20,
    gap: 16,
    borderWidth: BORDER_THICK.width,
    borderColor: COLORS.border,
    transform: [{ translateX: -8 }, { translateY: -8 }],
  },
  requestButton: {
    backgroundColor: COLORS.yellow400,
  },
  payButton: {
    backgroundColor: COLORS.cyan400,
  },
  buttonPressed: {
    transform: [{ translateX: 0 }, { translateY: 0 }],
  },
  iconContainer: {
    width: 56,
    height: 56,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: BORDER_THICK.width,
    borderColor: COLORS.border,
    backgroundColor: COLORS.surface,
  },
  buttonTextContainer: {
    flex: 1,
    gap: 4,
  },
  buttonTitle: {
    fontSize: 18,
    fontWeight: "900",
    color: COLORS.textPrimary,
    letterSpacing: 1,
  },
  buttonSubtitle: {
    fontSize: 12,
    fontWeight: "700",
    color: COLORS.textPrimary,
    opacity: 0.8,
  },
});
