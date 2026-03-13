import { useEffect, useMemo } from "react";
import { View, Text, StyleSheet, Pressable, Linking } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import { COLORS, BORDER_THICK } from "../constants/theme";
import { formatPaymentAmount } from "../lib/payments/tracking";
import { playPaymentSuccessSound } from "../lib/audio/feedback";

function shortAddress(address?: string) {
  if (!address) {
    return "UNKNOWN";
  }

  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

export default function PaymentSuccessScreen() {
  const router = useRouter();
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
              <Text style={styles.detailValue}>{shortAddress(params.from)}</Text>
              <Text style={styles.detailLabel}>RECEIVER</Text>
              <Text style={styles.detailValue}>{shortAddress(params.to)}</Text>
              <Text style={styles.detailLabel}>TX HASH</Text>
              <Text style={styles.detailValue}>{shortAddress(params.txHash)}</Text>
              <Text style={styles.detailLabel}>BLOCK</Text>
              <Text style={styles.detailValue}>{params.blockNumber ?? "UNKNOWN"}</Text>
              <Text style={styles.detailLabel}>CHAIN</Text>
              <Text style={styles.detailValue}>{params.chainName ?? "Base Sepolia"}</Text>
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
