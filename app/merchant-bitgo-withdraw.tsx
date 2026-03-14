import { useCallback, useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import { usePrivy } from "@privy-io/expo";
import { formatUnits, parseUnits } from "viem";
import { COLORS, BORDER_THICK, SHADOW } from "../constants/theme";
import { useOperationalWallet } from "../lib/wallet";
import { BITGO_MERCHANT_TOKEN, TOKEN_DECIMALS, isValidAddress } from "../lib/blockchain/contracts";
import { withdrawMerchantBitGoFunds, type MerchantBitGoWithdrawalResult } from "../lib/bitgo";

type WithdrawState = "idle" | "submitting" | "success" | "error";

function parseAmount(value: string): bigint | null {
  const cleaned = value.replace(/[^0-9.]/g, "");
  if (!cleaned || cleaned === ".") {
    return null;
  }

  try {
    const parsed = parseUnits(cleaned, TOKEN_DECIMALS);
    return parsed > BigInt(0) ? parsed : null;
  } catch {
    return null;
  }
}

export default function MerchantBitGoWithdrawScreen() {
  const router = useRouter();
  const { user, isReady: privyReady } = usePrivy();
  const { smartWalletAddress, isReady: walletReady } = useOperationalWallet();
  const [destinationAddress, setDestinationAddress] = useState("");
  const [amountInput, setAmountInput] = useState("");
  const [screenState, setScreenState] = useState<WithdrawState>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [result, setResult] = useState<MerchantBitGoWithdrawalResult | null>(null);

  useEffect(() => {
    if (privyReady && !user) {
      router.replace("/login");
    }
  }, [privyReady, router, user]);

  const handleWithdraw = useCallback(async () => {
    if (!walletReady || !smartWalletAddress) {
      setScreenState("error");
      setErrorMessage("Wallet not ready");
      return;
    }

    const amount = parseAmount(amountInput);
    if (!amount) {
      setScreenState("error");
      setErrorMessage("Enter a valid amount");
      return;
    }

    if (!isValidAddress(destinationAddress)) {
      setScreenState("error");
      setErrorMessage("Enter a valid destination address");
      return;
    }

    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    setScreenState("submitting");
    setErrorMessage(null);
    setResult(null);

    try {
      const response = await withdrawMerchantBitGoFunds({
        merchantAddress: smartWalletAddress,
        destinationAddress,
        amount: amount.toString(),
      });

      setResult(response);
      setScreenState("success");
    } catch (error) {
      setScreenState("error");
      setErrorMessage(error instanceof Error ? error.message : "Failed to submit withdrawal");
    }
  }, [amountInput, destinationAddress, smartWalletAddress, walletReady]);

  const handleBack = useCallback(async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    router.back();
  }, [router]);

  const statusText = useMemo(() => {
    switch (screenState) {
      case "idle":
        return "WITHDRAW FUNDS";
      case "submitting":
        return "SUBMITTING";
      case "success":
        return "WITHDRAWAL SUBMITTED";
      case "error":
        return "ERROR";
    }
  }, [screenState]);

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: COLORS.cyan400 }]}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <View style={styles.mainContent}>
        <View style={styles.cardShadow}>
          <View style={styles.card}>
            <Text style={styles.label}>BITGO WITHDRAW ({BITGO_MERCHANT_TOKEN.symbol})</Text>
            <TextInput
              value={destinationAddress}
              onChangeText={setDestinationAddress}
              placeholder="0x destination address"
              placeholderTextColor={COLORS.textMuted}
              autoCapitalize="none"
              autoCorrect={false}
              style={styles.input}
            />
            <TextInput
              value={amountInput}
              onChangeText={setAmountInput}
              placeholder={`Amount in ${BITGO_MERCHANT_TOKEN.symbol}`}
              placeholderTextColor={COLORS.textMuted}
              keyboardType="decimal-pad"
              style={styles.input}
            />
          </View>
        </View>

        <View style={styles.cardShadow}>
          <View style={styles.card}>
            <Text style={styles.statusLabel}>{statusText}</Text>
            {screenState === "idle" && (
              <Text style={styles.helperText}>
                Withdraw supported BitGo merchant token funds to another Base Sepolia address.
              </Text>
            )}
            {screenState === "submitting" && (
              <Text style={styles.helperText}>BitGo SDK is building and submitting the withdrawal.</Text>
            )}
            {screenState === "success" && result && (
              <View style={styles.resultBlock}>
                <Text style={styles.detailLabel}>TXID</Text>
                <Text style={styles.detailValue}>{result.txid ?? "Pending approval"}</Text>
                <Text style={styles.detailLabel}>STATUS</Text>
                <Text style={styles.detailValue}>
                  {result.pendingApproval?.state ?? result.transfer?.state ?? result.status ?? "submitted"}
                </Text>
              </View>
            )}
            {screenState === "error" && errorMessage ? (
              <Text style={styles.errorText}>{errorMessage}</Text>
            ) : null}
          </View>
        </View>

        <View style={styles.buttonRow}>
          <View style={styles.buttonShadow}>
            <Pressable onPress={handleWithdraw} style={styles.primaryButton}>
              <Text style={styles.primaryButtonText}>WITHDRAW</Text>
            </Pressable>
          </View>
          <View style={styles.buttonShadow}>
            <Pressable onPress={handleBack} style={styles.secondaryButton}>
              <Text style={styles.secondaryButtonText}>BACK</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  mainContent: {
    flex: 1,
    padding: 16,
    gap: 20,
    justifyContent: "center",
  },
  cardShadow: {
    backgroundColor: COLORS.border,
  },
  card: {
    backgroundColor: COLORS.surface,
    borderWidth: BORDER_THICK.width,
    borderColor: COLORS.border,
    padding: 20,
    gap: 16,
    transform: [{ translateX: -SHADOW.md.offset.width }, { translateY: -SHADOW.md.offset.height }],
  },
  label: {
    fontSize: 16,
    fontWeight: "900",
    color: COLORS.textPrimary,
    letterSpacing: 1,
  },
  input: {
    borderWidth: BORDER_THICK.width,
    borderColor: COLORS.border,
    paddingHorizontal: 14,
    paddingVertical: 14,
    fontSize: 16,
    fontWeight: "700",
    color: COLORS.textPrimary,
    backgroundColor: COLORS.backgroundLight,
  },
  statusLabel: {
    fontSize: 28,
    fontWeight: "900",
    color: COLORS.textPrimary,
    letterSpacing: 2,
  },
  helperText: {
    fontSize: 16,
    fontWeight: "700",
    color: COLORS.textPrimary,
    lineHeight: 24,
  },
  errorText: {
    fontSize: 16,
    fontWeight: "900",
    color: COLORS.error,
    lineHeight: 22,
  },
  resultBlock: {
    gap: 8,
  },
  detailLabel: {
    fontSize: 12,
    fontWeight: "900",
    color: COLORS.textMuted,
    letterSpacing: 2,
  },
  detailValue: {
    fontSize: 14,
    fontWeight: "700",
    color: COLORS.textPrimary,
  },
  buttonRow: {
    gap: 16,
  },
  buttonShadow: {
    backgroundColor: COLORS.border,
  },
  primaryButton: {
    borderWidth: BORDER_THICK.width,
    borderColor: COLORS.border,
    backgroundColor: COLORS.yellow400,
    paddingVertical: 18,
    alignItems: "center",
    transform: [{ translateX: -SHADOW.md.offset.width }, { translateY: -SHADOW.md.offset.height }],
  },
  secondaryButton: {
    borderWidth: BORDER_THICK.width,
    borderColor: COLORS.border,
    backgroundColor: COLORS.surface,
    paddingVertical: 18,
    alignItems: "center",
    transform: [{ translateX: -SHADOW.md.offset.width }, { translateY: -SHADOW.md.offset.height }],
  },
  primaryButtonText: {
    fontSize: 18,
    fontWeight: "900",
    color: COLORS.textPrimary,
    letterSpacing: 2,
  },
  secondaryButtonText: {
    fontSize: 18,
    fontWeight: "900",
    color: COLORS.textPrimary,
    letterSpacing: 2,
  },
});
