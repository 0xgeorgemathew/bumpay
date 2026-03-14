import { useEffect, useMemo, useRef, useState } from "react";
import { View, Text, StyleSheet, Pressable, Linking } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import { COLORS, BORDER_THICK } from "../constants/theme";
import { formatPaymentAmount } from "../lib/payments/tracking";
import { playDisconnectBeepAsync, playPaymentSuccessSoundAsync } from "../lib/audio/feedback";
import { announcePaymentReceivedAsync } from "../lib/audio/announce";
import { getEnsClaimStatus } from "../lib/ens/service";
import { useOperationalWallet } from "../lib/wallet";
import { useTransactions } from "../lib/transaction-context";

function shortAddress(address?: string) {
  if (!address) {
    return "UNKNOWN";
  }

  return `${address.slice(0, 10)}...${address.slice(-8)}`;
}

function getDisplayName(label?: string | null, address?: string) {
  if (label && label.trim().length > 0) {
    return label;
  }

  return shortAddress(address);
}

// PartyBox component for clear FROM/TO display
function PartyBox({
  label,
  name,
  isYou,
  highlightColor,
  address,
}: {
  label: "FROM" | "TO";
  name: string;
  isYou: boolean;
  highlightColor?: string;
  address?: string;
}) {
  const bgColor = isYou ? highlightColor : COLORS.surface;
  return (
    <View style={styles.partyBoxShadow}>
      <View style={[styles.partyBox, { backgroundColor: bgColor }]}>
        <Text style={styles.partyLabel}>{label}</Text>
        <Text style={styles.partyName}>{isYou ? "YOU" : name}</Text>
        {isYou ? <Text style={styles.partyEnsName}>{name}</Text> : null}
        {address ? <Text style={styles.partyAddress}>{shortAddress(address)}</Text> : null}
      </View>
    </View>
  );
}

export default function PaymentSuccessScreen() {
  const router = useRouter();
  const { smartWalletAddress } = useOperationalWallet();
  const { addTransaction } = useTransactions();
  const addedToRecentActivityRef = useRef<string | null>(null);

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

  const isReceiver = params.role === "receiver";
  const backgroundColor = isReceiver ? COLORS.green400 : COLORS.primaryBlue;
  const [resolvedFromLabel, setResolvedFromLabel] = useState<string | null>(params.fromLabel ?? null);
  const [resolvedToLabel, setResolvedToLabel] = useState<string | null>(params.toLabel ?? null);

  // Determine party details for FROM → TO display
  const fromName = getDisplayName(resolvedFromLabel, params.from);
  const toName = getDisplayName(resolvedToLabel, params.to);

  // Color coding: when YOU are receiver → TO box is green, when YOU are payer → FROM box is yellow
  const highlightColor = isReceiver ? COLORS.green400 : COLORS.yellow400;

  // Play audio sequence on mount for BOTH phones, voice only for merchant
  useEffect(() => {
    // Step 1: Disconnect beep (both phones) - plays immediately, lower volume
    playDisconnectBeepAsync()
      .then(() => {
        // Step 2: Success beep (both phones) - LOUD confirmation
        return playPaymentSuccessSoundAsync();
      })
      .then(() => {
        // Step 3: Voice announcement (merchant only)
        if (isReceiver && params.amount && params.tokenSymbol) {
          return announcePaymentReceivedAsync(formattedAmount, params.tokenSymbol!);
        }
      })
      .catch(console.error);
  }, [formattedAmount, isReceiver, params.amount, params.tokenSymbol]);

  useEffect(() => {
    setResolvedFromLabel(params.fromLabel ?? null);
  }, [params.fromLabel]);

  useEffect(() => {
    setResolvedToLabel(params.toLabel ?? null);
  }, [params.toLabel]);

  useEffect(() => {
    let cancelled = false;

    const resolveLabels = async () => {
      const jobs: Array<Promise<void>> = [];

      if (!params.fromLabel && params.from) {
        jobs.push(
          getEnsClaimStatus(params.from as `0x${string}`)
            .then((status) => {
              if (!cancelled && status.fullName) {
                setResolvedFromLabel(status.fullName);
              }
            })
            .catch((error) => {
              console.warn("Failed to resolve sender ENS on success page:", error);
            }),
        );
      }

      if (!params.toLabel && params.to) {
        jobs.push(
          getEnsClaimStatus(params.to as `0x${string}`)
            .then((status) => {
              if (!cancelled && status.fullName) {
                setResolvedToLabel(status.fullName);
              }
            })
            .catch((error) => {
              console.warn("Failed to resolve receiver ENS on success page:", error);
            }),
        );
      }

      await Promise.all(jobs);
    };

    resolveLabels().catch(console.error);

    return () => {
      cancelled = true;
    };
  }, [params.from, params.fromLabel, params.to, params.toLabel]);

  // Add to transaction history
  useEffect(() => {
    const activityKey = `${smartWalletAddress ?? "unknown"}:${params.role ?? "unknown"}:${params.txHash ?? "unknown"}`;

    if (
      !smartWalletAddress ||
      !params.role ||
      !params.from ||
      !params.to ||
      !params.amount ||
      !params.tokenSymbol ||
      !params.chainName ||
      !params.txHash ||
      addedToRecentActivityRef.current === activityKey
    ) {
      return;
    }

    addedToRecentActivityRef.current = activityKey;

    const txRole = params.role === "receiver" ? "receiver" : "payer";
    const txFrom = params.from as `0x${string}`;
    const txTo = params.to as `0x${string}`;
    const txAmount = BigInt(params.amount);
    const txTokenSymbol = params.tokenSymbol;
    const txChainName = params.chainName;
    const txTxHash = params.txHash as `0x${string}`;
    const txFromLabel = resolvedFromLabel;
    const txToLabel = resolvedToLabel;

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
  }, [
    addTransaction,
    params.amount,
    params.chainName,
    params.from,
    resolvedFromLabel,
    params.role,
    params.to,
    resolvedToLabel,
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
    <View style={[styles.container, { backgroundColor }]}>
      <View style={styles.mainContent}>
        <View style={styles.cardShadow}>
          <View style={styles.card}>
            <Text style={styles.checkmark}>✓</Text>
            <Text style={styles.title}>
              {isReceiver ? "PAYMENT RECEIVED" : "PAYMENT SENT"}
            </Text>

            <View style={styles.amountBoxShadow}>
              <View style={styles.amountBox}>
                <Text style={styles.amountText}>
                  {formattedAmount} {params.tokenSymbol ?? "USDC"}
                </Text>
              </View>
            </View>

            {/* FROM → TO Visual Layout */}
            <View style={styles.flowContainer}>
              {/* FROM Box */}
              <PartyBox
                label="FROM"
                name={fromName}
                isYou={!isReceiver}
                highlightColor={highlightColor}
                address={isReceiver ? params.from : undefined}
              />

              {/* Direction Arrow */}
              <View style={styles.arrowContainer}>
                <Text style={styles.arrow}>↓</Text>
              </View>

              {/* TO Box */}
              <PartyBox
                label="TO"
                name={toName}
                isYou={isReceiver}
                highlightColor={highlightColor}
                address={!isReceiver ? params.to : undefined}
              />
            </View>

            <Pressable onPress={handleOpenExplorer}>
              <Text style={styles.txHash}>
                {shortAddress(params.txHash)}
              </Text>
            </Pressable>
          </View>
        </View>
      </View>

      <View style={styles.footerStack}>
        <View style={styles.buttonShadow}>
          <Pressable style={styles.explorerButton} onPress={handleOpenExplorer}>
            <Text style={styles.buttonText}>VIEW ON EXPLORER</Text>
          </Pressable>
        </View>
        <View style={styles.buttonShadow}>
          <Pressable style={styles.doneButton} onPress={handleDone}>
            <Text style={styles.buttonText}>DONE</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 60,
    paddingBottom: 24,
  },
  mainContent: {
    flex: 1,
    justifyContent: "center",
  },
  cardShadow: {
    backgroundColor: COLORS.border,
  },
  card: {
    backgroundColor: COLORS.surface,
    borderWidth: BORDER_THICK.width,
    borderColor: COLORS.border,
    paddingVertical: 24,
    paddingHorizontal: 20,
    alignItems: "center",
    gap: 12,
    transform: [{ translateX: -8 }, { translateY: -8 }],
  },
  checkmark: {
    fontSize: 48,
    fontWeight: "900",
    color: COLORS.success,
  },
  title: {
    fontSize: 20,
    fontWeight: "900",
    fontStyle: "italic",
    color: COLORS.textPrimary,
    letterSpacing: 2,
  },
  amountBoxShadow: {
    backgroundColor: COLORS.border,
  },
  amountBox: {
    backgroundColor: COLORS.yellow400,
    borderWidth: BORDER_THICK.width,
    borderColor: COLORS.border,
    paddingVertical: 10,
    paddingHorizontal: 24,
    transform: [{ translateX: -4 }, { translateY: -4 }],
  },
  amountText: {
    fontSize: 22,
    fontWeight: "900",
    color: COLORS.textPrimary,
  },
  flowContainer: {
    width: "100%",
    alignItems: "center",
    gap: 2,
  },
  partyBoxShadow: {
    backgroundColor: COLORS.border,
    width: "100%",
  },
  partyBox: {
    borderWidth: BORDER_THICK.width,
    borderColor: COLORS.border,
    paddingVertical: 8,
    paddingHorizontal: 12,
    alignItems: "center",
    transform: [{ translateX: -3 }, { translateY: -3 }],
  },
  partyLabel: {
    fontSize: 10,
    fontWeight: "700",
    color: COLORS.textMuted,
    letterSpacing: 2,
    textTransform: "uppercase",
  },
  partyName: {
    fontSize: 20,
    fontWeight: "900",
    color: COLORS.textPrimary,
    marginTop: 2,
    textAlign: "center",
  },
  partyEnsName: {
    fontSize: 11,
    fontWeight: "800",
    color: COLORS.textMuted,
    marginTop: 2,
    textAlign: "center",
  },
  partyAddress: {
    fontSize: 10,
    fontWeight: "600",
    color: COLORS.textMuted,
    fontFamily: "monospace",
    marginTop: 2,
  },
  arrowContainer: {
    paddingVertical: 2,
  },
  arrow: {
    fontSize: 20,
    fontWeight: "900",
    color: COLORS.textPrimary,
  },
  txHash: {
    fontSize: 12,
    fontWeight: "700",
    color: COLORS.primaryBlue,
    textDecorationLine: "underline",
    fontFamily: "monospace",
  },
  footerStack: {
    gap: 8,
  },
  buttonShadow: {
    backgroundColor: COLORS.border,
  },
  explorerButton: {
    backgroundColor: COLORS.yellow400,
    borderWidth: BORDER_THICK.width,
    borderColor: COLORS.border,
    paddingVertical: 14,
    alignItems: "center",
    transform: [{ translateX: -6 }, { translateY: -6 }],
  },
  doneButton: {
    backgroundColor: COLORS.surface,
    borderWidth: BORDER_THICK.width,
    borderColor: COLORS.border,
    paddingVertical: 14,
    alignItems: "center",
    transform: [{ translateX: -6 }, { translateY: -6 }],
  },
  buttonText: {
    fontSize: 16,
    fontWeight: "900",
    color: COLORS.textPrimary,
    letterSpacing: 1,
  },
});
