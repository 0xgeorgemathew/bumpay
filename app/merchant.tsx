import { useCallback, useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  TextInput,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import { usePrivy } from "@privy-io/expo";
import { parseUnits, formatUnits, type Hex } from "viem";
import { COLORS, BORDER_THICK, SHADOW } from "../constants/theme";
import { useOperationalWallet } from "../lib/wallet";
import { playNfcCompleteSound } from "../lib/audio/feedback";
import { CardEmulation, CardEmulationEvents } from "../lib/nfc/card-emulation";
import {
  TOKEN_DECIMALS,
  TOKEN_SYMBOL,
} from "../lib/blockchain/contracts";
import {
  buildClaimPaymentTransaction,
  buildMerchantPaymentRequestMessage,
  createMerchantSession,
  isSessionExpired,
  matchesMerchantSession,
  parsePaymentAuthorization,
  type MerchantSession,
  type ParsedAuthorization,
} from "../lib/payments/merchant-session";
import { getPaymentTrackingPollingClient } from "../lib/payments/payment-tracking-client";

type MerchantScreenState =
  | "enter_amount"
  | "ready_to_receive"
  | "authorization_received"
  | "claiming_payment"
  | "success"
  | "error";

type MerchantError =
  | "invalid_amount"
  | "wallet_not_ready"
  | "publish_failed"
  | "nfc_error"
  | "authorization_invalid"
  | "claim_failed"
  | "session_expired";

function parsePaymentAmount(value: string): bigint | null {
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

function formatPaymentAmount(amount: bigint): string {
  return formatUnits(amount, TOKEN_DECIMALS);
}

function getStatusLabel(state: MerchantScreenState, error?: MerchantError): string {
  switch (state) {
    case "enter_amount":
      return "ENTER AMOUNT";
    case "ready_to_receive":
      return "READY TO RECEIVE";
    case "authorization_received":
      return "AUTHORIZATION RECEIVED";
    case "claiming_payment":
      return "CLAIMING PAYMENT";
    case "success":
      return "PAYMENT SUCCESSFUL";
    case "error":
      return `ERROR: ${error?.toUpperCase().replace(/_/g, " ") ?? "UNKNOWN"}`;
  }
}

const SHADOW_OFFSET = { width: 8, height: 8 };

export default function MerchantScreen() {
  const router = useRouter();
  const { user, isReady: privyReady } = usePrivy();
  const {
    smartWalletAddress,
    status: walletStatus,
    isReady: walletReady,
    sendContractTransaction,
  } = useOperationalWallet();

  const [screenState, setScreenState] = useState<MerchantScreenState>("enter_amount");
  const [amountInput, setAmountInput] = useState("");
  const [errorType, setErrorType] = useState<MerchantError | undefined>();
  const [session, setSession] = useState<MerchantSession | null>(null);
  const [authorization, setAuthorization] = useState<ParsedAuthorization | null>(null);
  const [claimTxHash, setClaimTxHash] = useState<Hex | null>(null);

  // Redirect to login if not authenticated
  useEffect(() => {
    if (privyReady && !user) {
      router.replace("/login");
    }
  }, [privyReady, router, user]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      CardEmulation.setReady(false).catch(() => undefined);
      CardEmulation.setMerchantMode(false).catch(() => undefined);
      CardEmulation.clearPaymentRequest().catch(() => undefined);
      CardEmulation.clearPaymentAuthorization().catch(() => undefined);
      CardEmulation.stopListening().catch(() => undefined);
    };
  }, []);

  // Listen for authorization from customer
  useEffect(() => {
    const subscription = CardEmulationEvents.onStateChanged(async (state) => {
      if (!state.hasPaymentAuthorization || !session) {
        return;
      }

      try {
        const payload = await CardEmulation.getPaymentAuthorization();
        if (!payload) {
          return;
        }

        const parsed = parsePaymentAuthorization(payload);
        if (!parsed) {
          setErrorType("authorization_invalid");
          setScreenState("error");
          return;
        }

        if (isSessionExpired(session) || !matchesMerchantSession(session, parsed)) {
          setErrorType("authorization_invalid");
          setScreenState("error");
          await CardEmulation.clearPaymentAuthorization();
          return;
        }

        setAuthorization(parsed);
        setScreenState("authorization_received");
        await playNfcCompleteSound();

        // Clear the authorization so we don't process it again
        await CardEmulation.clearPaymentAuthorization();
      } catch (err) {
        console.error("Failed to process authorization:", err);
        setErrorType("authorization_invalid");
        setScreenState("error");
      }
    });

    return () => {
      subscription?.remove();
    };
  }, [session]);

  const handleStartSession = useCallback(async () => {
    if (!walletReady || !smartWalletAddress) {
      setErrorType("wallet_not_ready");
      setScreenState("error");
      return;
    }

    const amount = parsePaymentAmount(amountInput);
    if (!amount) {
      setErrorType("invalid_amount");
      setScreenState("error");
      return;
    }

    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);

    const newSession = createMerchantSession(smartWalletAddress, amount);

    try {
      // Set up merchant mode
      await CardEmulation.setMerchantMode(true);
      await CardEmulation.clearPaymentAuthorization();

      // Publish the payment request
      const message = buildMerchantPaymentRequestMessage(newSession);
      await CardEmulation.setPaymentRequest(message);
      await CardEmulation.setReady(true);
      await CardEmulation.startListening();

      setSession(newSession);
      setScreenState("ready_to_receive");
    } catch (err) {
      console.error("Failed to start merchant session:", err);
      setErrorType("publish_failed");
      setScreenState("error");
    }
  }, [amountInput, smartWalletAddress, walletReady]);

  const handleClaimPayment = useCallback(async () => {
    if (!session || !authorization) {
      setErrorType("authorization_invalid");
      setScreenState("error");
      return;
    }

    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setScreenState("claiming_payment");

    try {
      const tx = buildClaimPaymentTransaction(session, authorization);
      const txHash = await sendContractTransaction(tx.to, tx.data);
      if (!txHash) {
        throw new Error("Transaction failed");
      }

      const receipt = await getPaymentTrackingPollingClient().waitForTransactionReceipt({
        hash: txHash,
      });
      if (receipt.status !== "success") {
        throw new Error("Claim transaction reverted");
      }

      setClaimTxHash(txHash);
      setScreenState("success");
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      await playNfcCompleteSound();

      // Clean up
      await CardEmulation.setReady(false);
      await CardEmulation.setMerchantMode(false);
      await CardEmulation.clearPaymentRequest();
      await CardEmulation.clearPaymentAuthorization();
    } catch (err) {
      console.error("Failed to claim payment:", err);
      setErrorType("claim_failed");
      setScreenState("error");
    }
  }, [authorization, sendContractTransaction, session]);

  const handleCancel = useCallback(async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    await CardEmulation.setReady(false);
    await CardEmulation.setMerchantMode(false);
    await CardEmulation.clearPaymentRequest();
    await CardEmulation.clearPaymentAuthorization();
    router.back();
  }, [router]);

  const handleReset = useCallback(async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    await CardEmulation.setReady(false);
    await CardEmulation.setMerchantMode(false);
    await CardEmulation.clearPaymentRequest();
    await CardEmulation.clearPaymentAuthorization();
    setScreenState("enter_amount");
    setAmountInput("");
    setErrorType(undefined);
    setSession(null);
    setAuthorization(null);
    setClaimTxHash(null);
  }, []);

  const displayAmount = useMemo(() => {
    if (session) {
      return formatPaymentAmount(session.amount);
    }
    return amountInput || "0.00";
  }, [amountInput, session]);

  const backgroundColor = COLORS.green400;

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor }]}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <View style={styles.mainContent}>
        {/* Amount Display */}
        <View style={styles.amountBoxShadow}>
          <View style={styles.amountBox}>
            <Text style={styles.amountLabel}>AMOUNT ({TOKEN_SYMBOL})</Text>
            <Text style={styles.amountText}>{displayAmount}</Text>
            {session && (
              <Text style={styles.tokenHint}>
                {formatPaymentAmount(session.amount)} {TOKEN_SYMBOL}
              </Text>
            )}
          </View>
        </View>

        {/* Main State Card */}
        <View style={styles.statusCardShadow}>
          <View style={styles.statusCard}>
            {screenState === "enter_amount" ? (
              <View style={styles.inputContainer}>
                <TextInput
                  style={styles.amountInput}
                  value={amountInput}
                  onChangeText={setAmountInput}
                  placeholder="0.00"
                  placeholderTextColor={COLORS.textMuted}
                  keyboardType="decimal-pad"
                  autoFocus
                />
              </View>
            ) : (
              <View style={styles.statusContent}>
                {screenState === "ready_to_receive" && (
                  <Text style={styles.statusText}>WAITING FOR CUSTOMER TAP</Text>
                )}
                {screenState === "authorization_received" && (
                  <Text style={styles.statusText}>AUTHORIZATION RECEIVED</Text>
                )}
                {screenState === "claiming_payment" && (
                  <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color={COLORS.textPrimary} />
                    <Text style={styles.statusText}>CLAIMING PAYMENT...</Text>
                  </View>
                )}
                {screenState === "success" && (
                  <View style={styles.successContainer}>
                    <Text style={styles.successIcon}>✓</Text>
                    <Text style={styles.statusText}>PAYMENT RECEIVED</Text>
                    {claimTxHash && (
                      <Text style={styles.txHashText}>{claimTxHash.slice(0, 10)}...{claimTxHash.slice(-8)}</Text>
                    )}
                  </View>
                )}
                {screenState === "error" && (
                  <View style={styles.errorContainer}>
                    <Text style={styles.errorIcon}>✕</Text>
                    <Text style={styles.errorText}>{getStatusLabel(screenState, errorType)}</Text>
                  </View>
                )}
              </View>
            )}
          </View>
        </View>

        {/* Merchant Info */}
        {smartWalletAddress && (
          <View style={styles.infoBoxShadow}>
            <View style={styles.infoBox}>
              <Text style={styles.infoLabel}>MERCHANT WALLET</Text>
              <Text style={styles.infoText}>
                {smartWalletAddress.slice(0, 6)}...{smartWalletAddress.slice(-4)}
              </Text>
            </View>
          </View>
        )}
      </View>

      {/* Footer Buttons */}
      <View style={styles.footerStack}>
        {/* Status Button */}
        <View style={styles.statusButtonShadow}>
          <View style={styles.statusButton}>
            <Text style={styles.statusTextSmall}>
              {getStatusLabel(screenState, errorType)}
            </Text>
          </View>
        </View>

        {/* Action Buttons */}
        {screenState === "enter_amount" && (
          <>
            <View style={styles.footerButtonShadow}>
              <Pressable
                onPress={handleStartSession}
                style={styles.primaryButton}
                disabled={!walletReady || !parsePaymentAmount(amountInput)}
              >
                <Text style={styles.primaryButtonText}>START PAYMENT</Text>
              </Pressable>
            </View>
            <View style={styles.footerButtonShadow}>
              <Pressable onPress={handleCancel} style={styles.footerButton}>
                <Text style={styles.footerButtonText}>CANCEL</Text>
              </Pressable>
            </View>
          </>
        )}

        {screenState === "ready_to_receive" && (
          <View style={styles.footerButtonShadow}>
            <Pressable onPress={handleReset} style={styles.warningButton}>
              <Text style={styles.footerButtonText}>CANCEL PAYMENT</Text>
            </Pressable>
          </View>
        )}

        {screenState === "authorization_received" && (
          <>
            <View style={styles.footerButtonShadow}>
              <Pressable onPress={handleClaimPayment} style={styles.primaryButton}>
                <Text style={styles.primaryButtonText}>CLAIM PAYMENT</Text>
              </Pressable>
            </View>
            <View style={styles.footerButtonShadow}>
              <Pressable onPress={handleReset} style={styles.footerButton}>
                <Text style={styles.footerButtonText}>CANCEL</Text>
              </Pressable>
            </View>
          </>
        )}

        {(screenState === "success" || screenState === "error") && (
          <View style={styles.footerButtonShadow}>
            <Pressable onPress={handleReset} style={styles.footerButton}>
              <Text style={styles.footerButtonText}>NEW PAYMENT</Text>
            </Pressable>
          </View>
        )}
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 40,
    paddingBottom: 16,
  },
  mainContent: {
    flex: 1,
    justifyContent: "center",
    gap: 16,
  },
  amountBoxShadow: {
    backgroundColor: COLORS.border,
    width: "100%",
  },
  amountBox: {
    backgroundColor: COLORS.surface,
    borderWidth: BORDER_THICK.width,
    borderColor: COLORS.border,
    paddingVertical: 24,
    paddingHorizontal: 32,
    width: "100%",
    alignItems: "center",
    transform: [{ translateX: -SHADOW_OFFSET.width }, { translateY: -SHADOW_OFFSET.height }],
  },
  amountLabel: {
    fontSize: 12,
    fontWeight: "900",
    letterSpacing: 2,
    color: COLORS.textMuted,
    marginBottom: 8,
    textAlign: "center",
  },
  amountText: {
    fontSize: 48,
    fontWeight: "900",
    color: COLORS.textPrimary,
    textAlign: "center",
  },
  tokenHint: {
    fontSize: 12,
    fontWeight: "800",
    color: COLORS.textMuted,
    marginTop: 8,
  },
  statusCardShadow: {
    backgroundColor: COLORS.border,
    width: "100%",
  },
  statusCard: {
    backgroundColor: COLORS.surface,
    borderWidth: BORDER_THICK.width,
    borderColor: COLORS.border,
    paddingVertical: 32,
    paddingHorizontal: 24,
    minHeight: 180,
    alignItems: "center",
    justifyContent: "center",
    transform: [{ translateX: -SHADOW_OFFSET.width }, { translateY: -SHADOW_OFFSET.height }],
  },
  inputContainer: {
    width: "100%",
  },
  amountInput: {
    fontSize: 36,
    fontWeight: "900",
    color: COLORS.textPrimary,
    textAlign: "center",
    padding: 0,
  },
  statusContent: {
    alignItems: "center",
    gap: 16,
  },
  statusText: {
    fontSize: 18,
    fontWeight: "900",
    color: COLORS.textPrimary,
    textAlign: "center",
    letterSpacing: 1,
  },
  loadingContainer: {
    alignItems: "center",
    gap: 16,
  },
  successContainer: {
    alignItems: "center",
    gap: 12,
  },
  successIcon: {
    fontSize: 48,
    fontWeight: "900",
    color: COLORS.success,
  },
  txHashText: {
    fontSize: 12,
    fontWeight: "700",
    color: COLORS.textMuted,
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
  },
  errorContainer: {
    alignItems: "center",
    gap: 12,
  },
  errorIcon: {
    fontSize: 48,
    fontWeight: "900",
    color: COLORS.error,
  },
  errorText: {
    fontSize: 16,
    fontWeight: "900",
    color: COLORS.error,
    textAlign: "center",
  },
  infoBoxShadow: {
    backgroundColor: COLORS.border,
    width: "100%",
  },
  infoBox: {
    backgroundColor: COLORS.surface,
    borderWidth: BORDER_THICK.width,
    borderColor: COLORS.border,
    paddingVertical: 12,
    paddingHorizontal: 16,
    width: "100%",
    transform: [{ translateX: -SHADOW_OFFSET.width }, { translateY: -SHADOW_OFFSET.height }],
  },
  infoLabel: {
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 2,
    color: COLORS.textMuted,
    marginBottom: 4,
  },
  infoText: {
    fontSize: 14,
    fontWeight: "700",
    color: COLORS.textPrimary,
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
  },
  footerStack: {
    width: "100%",
    gap: 12,
  },
  statusButtonShadow: {
    backgroundColor: COLORS.border,
  },
  statusButton: {
    backgroundColor: COLORS.yellow400,
    borderWidth: BORDER_THICK.width,
    borderColor: COLORS.border,
    paddingVertical: 14,
    alignItems: "center",
    transform: [{ translateX: -SHADOW_OFFSET.width }, { translateY: -SHADOW_OFFSET.height }],
  },
  statusTextSmall: {
    fontSize: 14,
    fontWeight: "900",
    color: COLORS.textPrimary,
    letterSpacing: 1,
  },
  footerButtonShadow: {
    backgroundColor: COLORS.border,
  },
  footerButton: {
    backgroundColor: COLORS.surface,
    borderWidth: BORDER_THICK.width,
    borderColor: COLORS.border,
    paddingVertical: 14,
    alignItems: "center",
    transform: [{ translateX: -SHADOW_OFFSET.width }, { translateY: -SHADOW_OFFSET.height }],
  },
  footerButtonText: {
    fontSize: 16,
    fontWeight: "900",
    color: COLORS.textPrimary,
    letterSpacing: 1,
  },
  primaryButton: {
    backgroundColor: COLORS.primaryBlue,
    borderWidth: BORDER_THICK.width,
    borderColor: COLORS.border,
    paddingVertical: 14,
    alignItems: "center",
    transform: [{ translateX: -SHADOW_OFFSET.width }, { translateY: -SHADOW_OFFSET.height }],
  },
  primaryButtonText: {
    fontSize: 16,
    fontWeight: "900",
    color: COLORS.textInverted,
    letterSpacing: 1,
  },
  warningButton: {
    backgroundColor: COLORS.warning,
    borderWidth: BORDER_THICK.width,
    borderColor: COLORS.border,
    paddingVertical: 14,
    alignItems: "center",
    transform: [{ translateX: -SHADOW_OFFSET.width }, { translateY: -SHADOW_OFFSET.height }],
  },
});
