import { useEffect, useMemo, useRef, useState } from "react";
import { View, Text, StyleSheet, Pressable, Linking } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import { COLORS, BORDER_THICK } from "../constants/theme";
import { formatPaymentAmount } from "../lib/payments/tracking";
import { playPaymentSuccessSound } from "../lib/audio/feedback";
import { useOperationalWallet } from "../lib/wallet";
import { syncLedgerEntry } from "../lib/fileverse";
import { useTransactions } from "../lib/transaction-context";

function shortAddress(address?: string) {
  if (!address) {
    return "UNKNOWN";
  }

  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

export default function PaymentSuccessScreen() {
  const router = useRouter();
  const { smartWalletAddress } = useOperationalWallet();
  const { addTransaction } = useTransactions();
  const syncedKeyRef = useRef<string | null>(null);
  const [ledgerState, setLedgerState] = useState<{
    status: "idle" | "syncing" | "synced" | "error";
    message: string;
  }>({
    status: "idle",
    message: "Saving this receipt to your private Fileverse ledger.",
  });
  const params = useLocalSearchParams<{
    role?: string;
    from?: string;
    to?: string;
    amount?: string;
    tokenSymbol?: string;
    chainName?: string;
    txHash?: string;
    blockNumber?: string;
    explorerUrl?: string;
    fromLabel?: string;
    toLabel?: string;
  }>();

  const formattedAmount = useMemo(() => {
    const amount = params.amount ? BigInt(params.amount) : BigInt(0);
    return formatPaymentAmount(amount).toLocaleString("en-US", {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    });
  }, [params.amount]);

  useEffect(() => {
    playPaymentSuccessSound().catch(console.error);
  }, []);

  useEffect(() => {
    const syncKey = `${smartWalletAddress ?? "unknown"}:${params.role ?? "unknown"}:${params.txHash ?? "unknown"}`;

    if (
      !smartWalletAddress ||
      !params.role ||
      !params.from ||
      !params.to ||
      !params.amount ||
      !params.tokenSymbol ||
      !params.chainName ||
      !params.txHash ||
      syncedKeyRef.current === syncKey
    ) {
      return;
    }

    syncedKeyRef.current = syncKey;
    setLedgerState({
      status: "syncing",
      message: "Saving this receipt to your private Fileverse ledger.",
    });

    // Store params with definite values for use in callbacks
    const txRole = params.role === "receiver" ? "receiver" : "payer";
    const txFrom = params.from as `0x${string}`;
    const txTo = params.to as `0x${string}`;
    const txAmount = BigInt(params.amount);
    const txTokenSymbol = params.tokenSymbol;
    const txChainName = params.chainName;
    const txTxHash = params.txHash as `0x${string}`;
    const txFromLabel = params.fromLabel;
    const txToLabel = params.toLabel;

    syncLedgerEntry({
      ownerAddress: smartWalletAddress,
      role: txRole,
      amount: txAmount,
      tokenSymbol: txTokenSymbol,
      chainName: txChainName,
      txHash: txTxHash,
      from: txFrom,
      to: txTo,
      fromLabel: txFromLabel ?? null,
      toLabel: txToLabel ?? null,
    })
      .then(() => {
        setLedgerState({
          status: "synced",
          message: "Saved to your private Fileverse ledger.",
        });

        // Also add to local transaction history
        addTransaction({
          role: txRole,
          from: txFrom,
          to: txTo,
          amount: txAmount,
          tokenSymbol: txTokenSymbol,
          chainName: txChainName,
          txHash: txTxHash,
          fromLabel: txFromLabel,
          toLabel: txToLabel,
        }).catch((error) => {
          console.warn("Failed to add transaction to local history:", error);
        });
      })
      .catch((error) => {
        console.warn("Failed to sync Fileverse ledger:", error);
        setLedgerState({
          status: "error",
          message:
            error instanceof Error
              ? error.message
              : "Payment confirmed, but ledger sync failed.",
        });
      });
  }, [
    params.amount,
    params.chainName,
    params.from,
    params.fromLabel,
    params.role,
    params.to,
    params.toLabel,
    params.tokenSymbol,
    params.txHash,
    smartWalletAddress,
  ]);

  const handleDone = async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    router.replace("/(tabs)");
  };

  const handleOpenExplorer = async () => {
    if (!params.explorerUrl) {
      return;
    }
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    await Linking.openURL(params.explorerUrl);
  };

  return (
    <View style={styles.container}>
      <View style={styles.mainContent}>
        <View style={styles.contentStack}>
          <View style={styles.heroShadow}>
            <View style={styles.hero}>
              <Text style={styles.heroIcon}>✓</Text>
              <Text style={styles.heroTitle}>PAYMENT CONFIRMED</Text>
              <Text style={styles.heroSubtitle}>
                {params.role === "receiver" ? "RECEIVED" : "SENT"} {formattedAmount}{" "}
                {params.tokenSymbol ?? "USDC"}
              </Text>
            </View>
          </View>

          <View style={styles.detailShadow}>
            <View style={styles.detailCard}>
              <Text style={styles.detailLabel}>PAYER</Text>
              <Text style={styles.detailValue}>
                {params.fromLabel ?? shortAddress(params.from)}
              </Text>
              <Text style={styles.detailLabel}>RECEIVER</Text>
              <Text style={styles.detailValue}>
                {params.toLabel ?? shortAddress(params.to)}
              </Text>
              <Text style={styles.detailLabel}>TX HASH</Text>
              <Text style={styles.detailValue}>{shortAddress(params.txHash)}</Text>
              <Text style={styles.detailLabel}>BLOCK</Text>
              <Text style={styles.detailValue}>{params.blockNumber ?? "UNKNOWN"}</Text>
              <Text style={styles.detailLabel}>CHAIN</Text>
              <Text style={styles.detailValue}>{params.chainName ?? "Base Sepolia"}</Text>
            </View>
          </View>

          <View style={styles.ledgerShadow}>
            <View
              style={[
                styles.ledgerCard,
                ledgerState.status === "error" && styles.ledgerCardWarning,
              ]}
            >
              <Text style={styles.ledgerLabel}>PRIVATE LEDGER</Text>
              <Text style={styles.ledgerText}>{ledgerState.message}</Text>
            </View>
          </View>
        </View>
      </View>

      <View style={styles.footerStack}>
        <View style={styles.buttonShadow}>
          <Pressable onPress={handleOpenExplorer} style={styles.secondaryButton}>
            <Text style={styles.secondaryButtonText}>VIEW ON EXPLORER</Text>
          </Pressable>
        </View>

        <View style={styles.buttonShadow}>
          <Pressable onPress={handleDone} style={styles.primaryButton}>
            <Text style={styles.primaryButtonText}>DONE</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.green400,
    paddingHorizontal: 16,
    paddingTop: 40,
    paddingBottom: 20,
  },
  mainContent: {
    flex: 1,
    justifyContent: "center",
  },
  contentStack: {
    gap: 16,
  },
  heroShadow: {
    backgroundColor: COLORS.border,
    marginBottom: 16,
  },
  hero: {
    backgroundColor: COLORS.surface,
    borderWidth: BORDER_THICK.width,
    borderColor: COLORS.border,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 20,
    gap: 6,
    transform: [{ translateX: -8 }, { translateY: -8 }],
  },
  heroIcon: {
    fontSize: 48,
    fontWeight: "900",
    color: COLORS.success,
  },
  heroTitle: {
    fontSize: 24,
    fontWeight: "900",
    color: COLORS.textPrimary,
    textAlign: "center",
    fontStyle: "italic",
  },
  heroSubtitle: {
    fontSize: 16,
    fontWeight: "900",
    color: COLORS.textPrimary,
    textAlign: "center",
  },
  detailShadow: {
    backgroundColor: COLORS.border,
    marginBottom: 16,
  },
  detailCard: {
    backgroundColor: COLORS.surface,
    borderWidth: BORDER_THICK.width,
    borderColor: COLORS.border,
    paddingHorizontal: 18,
    paddingVertical: 14,
    transform: [{ translateX: -8 }, { translateY: -8 }],
  },
  detailLabel: {
    fontSize: 11,
    fontWeight: "900",
    color: COLORS.textPrimary,
    letterSpacing: 1,
    marginTop: 8,
  },
  detailValue: {
    fontSize: 16,
    fontWeight: "900",
    color: COLORS.textPrimary,
  },
  ledgerShadow: {
    backgroundColor: COLORS.border,
    marginBottom: 16,
  },
  ledgerCard: {
    backgroundColor: COLORS.cyan400,
    borderWidth: BORDER_THICK.width,
    borderColor: COLORS.border,
    paddingHorizontal: 18,
    paddingVertical: 14,
    transform: [{ translateX: -8 }, { translateY: -8 }],
    gap: 6,
  },
  ledgerCardWarning: {
    backgroundColor: COLORS.yellow400,
  },
  ledgerLabel: {
    fontSize: 11,
    fontWeight: "900",
    color: COLORS.textPrimary,
    letterSpacing: 1,
  },
  ledgerText: {
    fontSize: 14,
    fontWeight: "800",
    color: COLORS.textPrimary,
    lineHeight: 20,
  },
  buttonShadow: {
    backgroundColor: COLORS.border,
    marginBottom: 12,
  },
  footerStack: {
    width: "100%",
  },
  secondaryButton: {
    backgroundColor: COLORS.yellow400,
    borderWidth: BORDER_THICK.width,
    borderColor: COLORS.border,
    paddingVertical: 15,
    alignItems: "center",
    transform: [{ translateX: -8 }, { translateY: -8 }],
  },
  primaryButton: {
    backgroundColor: COLORS.primaryBlue,
    borderWidth: BORDER_THICK.width,
    borderColor: COLORS.border,
    paddingVertical: 15,
    alignItems: "center",
    transform: [{ translateX: -8 }, { translateY: -8 }],
  },
  secondaryButtonText: {
    fontSize: 16,
    fontWeight: "900",
    color: COLORS.textPrimary,
    letterSpacing: 1,
  },
  primaryButtonText: {
    fontSize: 16,
    fontWeight: "900",
    color: COLORS.textInverted,
    letterSpacing: 1,
  },
});
