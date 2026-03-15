import { useCallback, useEffect, useRef, useState } from "react";
import { View, Text, StyleSheet, Pressable, ScrollView } from "react-native";
import { useRouter } from "expo-router";
import { usePrivy } from "@privy-io/expo";
import * as Haptics from "expo-haptics";
import * as Clipboard from "expo-clipboard";
import { Ionicons } from "@expo/vector-icons";
import { formatUnits } from "viem";
import { HomeHeader } from "../../components/HomeHeader";
import { COLORS, BORDER_THICK } from "../../constants/theme";
import { BITGO_MERCHANT_TOKEN, TOKEN_DECIMALS } from "../../lib/blockchain/contracts";
import {
  getMerchantBitGoWithdrawalStatus,
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
  const [merchantWalletBalance, setMerchantWalletBalance] = useState<bigint>(BigInt(0));
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [isWithdrawing, setIsWithdrawing] = useState(false);
  const [withdrawResult, setWithdrawResult] = useState<MerchantBitGoWithdrawalResult | null>(null);
  const [copiedWallet, setCopiedWallet] = useState(false);
  const [copiedBaseAddress, setCopiedBaseAddress] = useState(false);
  const pollTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pollingTxRequestIdRef = useRef<string | null>(null);

  const withdrawableAmount = BigInt(summary?.checkoutReceiptsAvailable ?? "0");
  const bitgoBalance = BigInt(summary?.confirmedBalance ?? "0");
  const hasPendingWithdrawal =
    withdrawResult?.appStatus === "submitted" ||
    withdrawResult?.appStatus === "awaiting_signature" ||
    withdrawResult?.appStatus === "broadcasted";

  useEffect(() => {
    if (isReady && !user) {
      router.replace("/login");
    }
  }, [isReady, router, user]);

  const loadSummary = useCallback(async () => {
    if (!walletReady || !smartWalletAddress) {
      setSummary(null);
      setLoadError(null);
      return;
    }

    setIsLoading(true);
    setLoadError(null);

    try {
      const [nextSummary, nextMerchantWalletBalance, nextWithdrawalStatus] = await Promise.all([
        getMerchantBitGoSummary(smartWalletAddress),
        readTokenBalance(BITGO_MERCHANT_TOKEN.address),
        getMerchantBitGoWithdrawalStatus({ merchantAddress: smartWalletAddress }),
      ]);
      setSummary(nextSummary);
      setMerchantWalletBalance(nextMerchantWalletBalance);
      setWithdrawResult(nextWithdrawalStatus);
      setActionError(nextWithdrawalStatus?.appStatus === "failed" ? "Withdrawal failed in BitGo dashboard" : null);
    } catch (nextError) {
      setSummary(null);
      setMerchantWalletBalance(BigInt(0));
      setWithdrawResult(null);
      setLoadError(nextError instanceof Error ? nextError.message : "Failed to load merchant privacy summary");
    } finally {
      setIsLoading(false);
    }
  }, [readTokenBalance, smartWalletAddress, walletReady]);

  useEffect(() => {
    loadSummary().catch(() => undefined);
  }, [loadSummary]);

  useEffect(() => {
    const txRequestId = withdrawResult?.txRequestId;
    const appStatus = withdrawResult?.appStatus;

    if (!smartWalletAddress || !txRequestId) {
      if (pollTimeoutRef.current) {
        clearTimeout(pollTimeoutRef.current);
        pollTimeoutRef.current = null;
      }
      pollingTxRequestIdRef.current = null;
      return;
    }

    if (appStatus === "confirmed" || appStatus === "failed") {
      if (pollTimeoutRef.current) {
        clearTimeout(pollTimeoutRef.current);
        pollTimeoutRef.current = null;
      }
      pollingTxRequestIdRef.current = null;
      return;
    }

    if (pollingTxRequestIdRef.current === txRequestId) {
      return;
    }

    pollingTxRequestIdRef.current = txRequestId;
    let attempts = 0;
    const maxAttempts = 15;
    let cancelled = false;

    const runPoll = async () => {
      try {
        const status = await getMerchantBitGoWithdrawalStatus({
          merchantAddress: smartWalletAddress,
          txRequestId,
        });

        if (cancelled || !status) {
          return;
        }

        setWithdrawResult(status);

        if (status.appStatus === "failed") {
          setActionError("Withdrawal failed in BitGo dashboard");
          pollingTxRequestIdRef.current = null;
          return;
        }

        await loadSummary();

        if (status.appStatus === "confirmed") {
          pollingTxRequestIdRef.current = null;
          return;
        }
      } catch {
        if (cancelled) {
          return;
        }
      }

      attempts += 1;
      if (!cancelled && attempts < maxAttempts) {
        pollTimeoutRef.current = setTimeout(() => {
          runPoll().catch(() => undefined);
        }, 4000);
      } else {
        pollingTxRequestIdRef.current = null;
      }
    };

    pollTimeoutRef.current = setTimeout(() => {
      runPoll().catch(() => undefined);
    }, 4000);

    return () => {
      cancelled = true;
      if (pollTimeoutRef.current) {
        clearTimeout(pollTimeoutRef.current);
        pollTimeoutRef.current = null;
      }
    };
  }, [loadSummary, smartWalletAddress, withdrawResult?.appStatus, withdrawResult?.txRequestId]);

  const handleRefresh = useCallback(async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    await loadSummary();
  }, [loadSummary]);

  const handleWithdraw = useCallback(async () => {
    if (!smartWalletAddress || withdrawableAmount <= BigInt(0)) {
      return;
    }

    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    setIsWithdrawing(true);
    setActionError(null);
    setWithdrawResult(null);

    try {
      const result = await withdrawMerchantBitGoFunds({
        merchantAddress: smartWalletAddress,
        destinationAddress: smartWalletAddress,
        amount: withdrawableAmount.toString(),
      });

      setWithdrawResult(result);
      await loadSummary();
    } catch (nextError) {
      setActionError(nextError instanceof Error ? nextError.message : "Failed to withdraw merchant funds");
    } finally {
      setIsWithdrawing(false);
    }
  }, [loadSummary, smartWalletAddress, withdrawableAmount]);

  const handleCreateCheckout = useCallback(async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    router.push("/merchant-bitgo" as never);
  }, [router]);

  const handlePayMerchant = useCallback(async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    router.push("/pay-merchant-bitgo" as never);
  }, [router]);

  const handleCopyWallet = useCallback(async () => {
    if (!smartWalletAddress) {
      return;
    }

    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    await Clipboard.setStringAsync(smartWalletAddress);
    setCopiedWallet(true);
    setTimeout(() => setCopiedWallet(false), 1200);
  }, [smartWalletAddress]);

  const handleCopyBaseAddress = useCallback(async () => {
    if (!summary?.walletAddress) {
      return;
    }

    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    await Clipboard.setStringAsync(summary.walletAddress);
    setCopiedBaseAddress(true);
    setTimeout(() => setCopiedBaseAddress(false), 1200);
  }, [summary?.walletAddress]);

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
              <Text style={styles.balanceLabel}>BUMP WALLET</Text>
              <Pressable
                onPress={handleRefresh}
                style={({ pressed }) => [styles.refreshPill, pressed && styles.buttonPressed]}
              >
                <Text style={styles.refreshPillText}>{isLoading ? "SYNCING" : "REFRESH"}</Text>
              </Pressable>
            </View>
            <View style={styles.addressRow}>
              <Text style={styles.addressText}>
                {smartWalletAddress
                  ? `${smartWalletAddress.slice(0, 8)}...${smartWalletAddress.slice(-6)}`
                  : "Wallet unavailable"}
              </Text>
              <Pressable
                onPress={handleCopyWallet}
                style={({ pressed }) => [styles.copyButton, pressed && styles.buttonPressed]}
                disabled={!smartWalletAddress}
              >
                <Ionicons
                  name={copiedWallet ? "checkmark" : "copy-outline"}
                  size={16}
                  color={COLORS.textPrimary}
                />
                <Text style={styles.copyButtonText}>{copiedWallet ? "COPIED" : "COPY"}</Text>
              </Pressable>
            </View>
            <Text style={styles.balanceValue}>
              {formatUnits(merchantWalletBalance, TOKEN_DECIMALS)}{" "}
              {BITGO_MERCHANT_TOKEN.symbol}
            </Text>
            <Text style={styles.balanceSubtext}>USDC balance on Base Sepolia</Text>
            {loadError ? <Text style={styles.balanceError}>{loadError}</Text> : null}
          </View>
        </View>

        <View style={styles.summaryShadow}>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryLabel}>MERCHANT PRIVACY</Text>
            <Text style={styles.summaryTitle}>BITGO SUMMARY</Text>
            <Text style={styles.summaryValue}>
              {formatUnits(bitgoBalance, TOKEN_DECIMALS)}{" "}
              {BITGO_MERCHANT_TOKEN.symbol}
            </Text>
            <View style={styles.metricRow}>
              <Text style={styles.metricLabel}>BitGo Balance</Text>
              <Text style={styles.metricValue}>Confirmed by BitGo</Text>
            </View>
            <View style={styles.metricRow}>
              <Text style={styles.metricLabel}>Withdrawable Amount</Text>
              <Text style={styles.metricValue}>
                {formatUnits(withdrawableAmount, TOKEN_DECIMALS)}{" "}
                {BITGO_MERCHANT_TOKEN.symbol}
              </Text>
            </View>
            <View style={styles.baseAddressRow}>
              <View style={styles.baseAddressContent}>
                <Text style={styles.baseAddressLabel}>BitGo Base Address</Text>
                <Text style={styles.baseAddressValue}>
                  {summary?.walletAddress
                    ? `${summary.walletAddress.slice(0, 8)}...${summary.walletAddress.slice(-6)}`
                    : "Unavailable"}
                </Text>
                <Text style={styles.baseAddressHint}>Receive Address 0</Text>
              </View>
              <Pressable
                onPress={handleCopyBaseAddress}
                style={({ pressed }) => [styles.copyButton, pressed && styles.buttonPressed]}
                disabled={!summary?.walletAddress}
              >
                <Ionicons
                  name={copiedBaseAddress ? "checkmark" : "copy-outline"}
                  size={16}
                  color={COLORS.textPrimary}
                />
                <Text style={styles.copyButtonText}>{copiedBaseAddress ? "COPIED" : "COPY"}</Text>
              </Pressable>
            </View>
            {withdrawResult && withdrawResult.appStatus !== "failed" ? (
              <Text style={styles.successText}>Withdrawal submitted</Text>
            ) : null}
            {actionError ? <Text style={styles.summaryError}>{actionError}</Text> : null}

            <View style={styles.actionShadow}>
              <Pressable
                onPress={handleWithdraw}
                style={[
                  styles.withdrawButton,
                  (isWithdrawing || hasPendingWithdrawal || withdrawableAmount <= BigInt(0)) &&
                    styles.disabledButton,
                ]}
                disabled={isWithdrawing || hasPendingWithdrawal || withdrawableAmount <= BigInt(0)}
              >
                <Text style={styles.withdrawButtonText}>
                  {isWithdrawing
                    ? "WITHDRAWING..."
                    : hasPendingWithdrawal
                      ? "WITHDRAWAL SUBMITTED"
                      : "WITHDRAW TO MY WALLET"}
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
  addressRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  addressText: {
    flex: 1,
    fontSize: 14,
    fontWeight: "800",
    color: COLORS.textPrimary,
  },
  copyButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderWidth: BORDER_THICK.width,
    borderColor: COLORS.border,
    backgroundColor: COLORS.surface,
  },
  copyButtonText: {
    fontSize: 10,
    fontWeight: "900",
    color: COLORS.textPrimary,
    letterSpacing: 1,
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
    fontWeight: "800",
    color: COLORS.textPrimary,
    opacity: 0.75,
  },
  metricRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 16,
    paddingVertical: 4,
  },
  metricLabel: {
    flex: 1,
    fontSize: 13,
    fontWeight: "800",
    color: COLORS.textPrimary,
  },
  metricValue: {
    fontSize: 13,
    fontWeight: "900",
    color: COLORS.textPrimary,
  },
  baseAddressRow: {
    marginTop: 6,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    padding: 12,
    borderWidth: BORDER_THICK.width,
    borderColor: COLORS.border,
    backgroundColor: COLORS.backgroundLight,
  },
  baseAddressContent: {
    flex: 1,
    gap: 2,
  },
  baseAddressLabel: {
    fontSize: 12,
    fontWeight: "900",
    color: COLORS.textMuted,
    letterSpacing: 1,
  },
  baseAddressValue: {
    fontSize: 14,
    fontWeight: "900",
    color: COLORS.textPrimary,
  },
  baseAddressHint: {
    fontSize: 11,
    fontWeight: "700",
    color: COLORS.textPrimary,
    opacity: 0.7,
  },
  successText: {
    fontSize: 13,
    fontWeight: "900",
    color: COLORS.success,
    lineHeight: 20,
  },
  summaryError: {
    fontSize: 13,
    fontWeight: "900",
    color: COLORS.error,
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
