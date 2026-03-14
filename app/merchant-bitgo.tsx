import { useCallback, useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from "react-native";
import { useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import { usePrivy } from "@privy-io/expo";
import { formatUnits, parseUnits } from "viem";
import { COLORS, BORDER_THICK } from "../constants/theme";
import { useOperationalWallet } from "../lib/wallet";
import { CardEmulation } from "../lib/nfc/card-emulation";
import { playNfcCompleteSound } from "../lib/audio/feedback";
import {
  createMerchantBitGoCheckout,
  getMerchantBitGoCheckout,
  type MerchantBitGoCheckout,
  type MerchantBitGoCheckoutStatus,
} from "../lib/bitgo";
import { buildMerchantBitGoPaymentRequestMessage } from "../lib/payments/merchant-bitgo-session";
import { BITGO_MERCHANT_TOKEN, CHAIN_ID, TOKEN_DECIMALS } from "../lib/blockchain/contracts";

type ScreenState =
  | "enter_amount"
  | "preparing_address"
  | "ready_to_receive"
  | "payment_submitted"
  | "deposit_detected"
  | "success"
  | "error";

const SHADOW_OFFSET = { width: 8, height: 8 };
const CHECKOUT_POLL_INTERVAL_MS = 4000;

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

function getStatusLabel(state: ScreenState) {
  switch (state) {
    case "enter_amount":
      return "ENTER AMOUNT";
    case "preparing_address":
      return "PREPARING ADDRESS";
    case "ready_to_receive":
      return "READY TO RECEIVE";
    case "payment_submitted":
      return "PAYMENT SUBMITTED";
    case "deposit_detected":
      return "DEPOSIT DETECTED";
    case "success":
      return "PAYMENT CONFIRMED";
    case "error":
      return "ERROR";
  }
}

function mapCheckoutStatus(status: MerchantBitGoCheckoutStatus): ScreenState {
  switch (status) {
    case "initializing_address":
      return "preparing_address";
    case "ready":
      return "ready_to_receive";
    case "payment_broadcasted":
      return "payment_submitted";
    case "deposit_detected":
    case "sweeping":
      return "deposit_detected";
    case "settled":
      return "success";
    case "expired":
    case "failed":
      return "error";
  }
}

async function resetMerchantBroadcast() {
  await CardEmulation.setReady(false).catch(() => undefined);
  await CardEmulation.setMerchantMode(false).catch(() => undefined);
  await CardEmulation.clearPaymentRequest().catch(() => undefined);
  await CardEmulation.stopListening().catch(() => undefined);
}

export default function MerchantBitGoScreen() {
  const router = useRouter();
  const { user, isReady: privyReady } = usePrivy();
  const { smartWalletAddress, isReady: walletReady } = useOperationalWallet();

  const [amountInput, setAmountInput] = useState("");
  const [screenState, setScreenState] = useState<ScreenState>("enter_amount");
  const [checkout, setCheckout] = useState<MerchantBitGoCheckout | null>(null);
  const [hasPublishedRequest, setHasPublishedRequest] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (privyReady && !user) {
      router.replace("/login");
    }
  }, [privyReady, router, user]);

  useEffect(() => {
    return () => {
      resetMerchantBroadcast().catch(() => undefined);
    };
  }, []);

  useEffect(() => {
    if (!checkout || hasPublishedRequest || screenState !== "ready_to_receive") {
      return;
    }

    const publish = async () => {
      const message = buildMerchantBitGoPaymentRequestMessage({
        checkoutId: checkout.checkoutId,
        requestId: checkout.requestId,
        receiveAddress: checkout.receiveAddress,
        amount: BigInt(checkout.amount),
        tokenSymbol: checkout.tokenSymbol,
        tokenAddress: checkout.tokenAddress,
        chainId: checkout.chainId,
        expiresAt: Math.floor(new Date(checkout.expiresAt).getTime() / 1000),
        merchantName: checkout.merchantName,
        rail: "bitgo",
      });

      await CardEmulation.setMerchantMode(true);
      await CardEmulation.setPaymentRequest(message);
      await CardEmulation.setReady(true);
      await CardEmulation.startListening();
      setHasPublishedRequest(true);
      await playNfcCompleteSound();
    };

    publish().catch((error) => {
      setScreenState("error");
      setErrorMessage(error instanceof Error ? error.message : "Failed to publish checkout");
    });
  }, [checkout, hasPublishedRequest, screenState]);

  useEffect(() => {
    if (!checkout || ["success", "error", "enter_amount"].includes(screenState)) {
      return;
    }

    const interval = setInterval(() => {
      getMerchantBitGoCheckout(checkout.checkoutId)
        .then((latest) => {
          setCheckout(latest);
          setScreenState(mapCheckoutStatus(latest.status));
          if (latest.errorMessage) {
            setErrorMessage(latest.errorMessage);
          }
        })
        .catch((error) => {
          setScreenState("error");
          setErrorMessage(
            error instanceof Error ? error.message : "Failed to refresh BitGo checkout",
          );
        });
    }, CHECKOUT_POLL_INTERVAL_MS);

    return () => clearInterval(interval);
  }, [checkout, screenState]);

  const handleStartSession = useCallback(async () => {
    if (!walletReady || !smartWalletAddress) {
      setScreenState("error");
      setErrorMessage("Wallet not ready");
      return;
    }

    const amount = parsePaymentAmount(amountInput);
    if (!amount) {
      setScreenState("error");
      setErrorMessage("Enter a valid amount");
      return;
    }

    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    setScreenState("preparing_address");
    setErrorMessage(null);
    setHasPublishedRequest(false);

    try {
      const created = await createMerchantBitGoCheckout({
        merchantAddress: smartWalletAddress,
        amount: amount.toString(),
        tokenSymbol: BITGO_MERCHANT_TOKEN.symbol,
        tokenAddress: BITGO_MERCHANT_TOKEN.address,
        chainId: CHAIN_ID,
      });

      setCheckout(created);
      setScreenState(mapCheckoutStatus(created.status));
    } catch (error) {
      setScreenState("error");
      setErrorMessage(error instanceof Error ? error.message : "Failed to create checkout");
    }
  }, [amountInput, smartWalletAddress, walletReady]);

  const handleCancel = useCallback(async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    await resetMerchantBroadcast();
    router.back();
  }, [router]);

  const handleReset = useCallback(async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    await resetMerchantBroadcast();
    setAmountInput("");
    setCheckout(null);
    setHasPublishedRequest(false);
    setErrorMessage(null);
    setScreenState("enter_amount");
  }, []);

  const displayAmount = useMemo(() => {
    if (checkout) {
      return formatPaymentAmount(BigInt(checkout.amount));
    }

    return amountInput || "0.00";
  }, [amountInput, checkout]);

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: COLORS.yellow400 }]}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <View style={styles.mainContent}>
        <View style={styles.amountBoxShadow}>
          <View style={styles.amountBox}>
            <Text style={styles.amountLabel}>NEW CHECKOUT ({BITGO_MERCHANT_TOKEN.symbol})</Text>
            <Text style={styles.amountText}>{displayAmount}</Text>
            <Text style={styles.tokenHint}>Fresh BitGo address per checkout</Text>
          </View>
        </View>

        <View style={styles.statusCardShadow}>
          <View style={styles.statusCard}>
            <Text style={styles.statusLabel}>{getStatusLabel(screenState)}</Text>
            {screenState === "enter_amount" ? (
              <TextInput
                style={styles.amountInput}
                value={amountInput}
                onChangeText={setAmountInput}
                placeholder="0.00"
                placeholderTextColor={COLORS.textMuted}
                keyboardType="decimal-pad"
                autoFocus
              />
            ) : (
              <View style={styles.statusBody}>
                {screenState === "preparing_address" ? (
                  <>
                    <ActivityIndicator size="small" color={COLORS.textPrimary} />
                    <Text style={styles.statusText}>Creating a fresh BitGo receive address.</Text>
                  </>
                ) : null}
                {screenState === "ready_to_receive" ? (
                  <>
                    <Text style={styles.statusText}>Customer can tap now.</Text>
                    <Text style={styles.helperText}>
                      Checkout {checkout?.checkoutId.slice(0, 8).toUpperCase()}
                    </Text>
                    <Text style={styles.helperText}>
                      Address {checkout?.receiveAddress.slice(0, 10)}...
                    </Text>
                  </>
                ) : null}
                {screenState === "payment_submitted" ? (
                  <Text style={styles.statusText}>Customer submitted the token transfer.</Text>
                ) : null}
                {screenState === "deposit_detected" ? (
                  <Text style={styles.statusText}>Deposit seen. Waiting for final settlement.</Text>
                ) : null}
                {screenState === "success" ? (
                  <>
                    <Text style={styles.statusText}>Merchant payment settled to the private rail.</Text>
                    <Text style={styles.helperText}>
                      Funds were received at a one-time BitGo address.
                    </Text>
                  </>
                ) : null}
                {screenState === "error" ? (
                  <Text style={styles.errorText}>{errorMessage ?? "Merchant BitGo flow failed."}</Text>
                ) : null}
              </View>
            )}
          </View>
        </View>
      </View>

      <View style={styles.footer}>
        {screenState === "enter_amount" ? (
          <View style={styles.buttonShadow}>
            <Pressable onPress={handleStartSession} style={styles.primaryButton}>
              <Text style={styles.primaryButtonText}>CREATE CHECKOUT</Text>
            </Pressable>
          </View>
        ) : null}

        {screenState !== "enter_amount" && screenState !== "success" ? (
          <View style={styles.buttonShadow}>
            <Pressable onPress={handleReset} style={styles.secondaryButton}>
              <Text style={styles.secondaryButtonText}>RESET</Text>
            </Pressable>
          </View>
        ) : null}

        <View style={styles.buttonShadow}>
          <Pressable
            onPress={screenState === "success" ? handleReset : handleCancel}
            style={styles.secondaryButton}
          >
            <Text style={styles.secondaryButtonText}>
              {screenState === "success" ? "NEW CHECKOUT" : "BACK"}
            </Text>
          </Pressable>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 40,
    paddingBottom: 20,
  },
  mainContent: {
    flex: 1,
    justifyContent: "center",
    gap: 20,
  },
  amountBoxShadow: {
    backgroundColor: COLORS.border,
  },
  amountBox: {
    backgroundColor: COLORS.surface,
    borderWidth: BORDER_THICK.width,
    borderColor: COLORS.border,
    padding: 16,
    transform: [{ translateX: -SHADOW_OFFSET.width }, { translateY: -SHADOW_OFFSET.height }],
  },
  amountLabel: {
    fontSize: 12,
    fontWeight: "900",
    letterSpacing: 2,
    color: COLORS.textMuted,
  },
  amountText: {
    marginTop: 8,
    fontSize: 32,
    fontWeight: "900",
    color: COLORS.textPrimary,
  },
  tokenHint: {
    marginTop: 6,
    fontSize: 12,
    fontWeight: "700",
    color: COLORS.textPrimary,
    opacity: 0.7,
  },
  statusCardShadow: {
    backgroundColor: COLORS.border,
  },
  statusCard: {
    backgroundColor: COLORS.surface,
    borderWidth: BORDER_THICK.width,
    borderColor: COLORS.border,
    padding: 20,
    minHeight: 220,
    transform: [{ translateX: -SHADOW_OFFSET.width }, { translateY: -SHADOW_OFFSET.height }],
  },
  statusLabel: {
    fontSize: 20,
    fontWeight: "900",
    color: COLORS.textPrimary,
    letterSpacing: 2,
    marginBottom: 16,
  },
  amountInput: {
    borderWidth: BORDER_THICK.width,
    borderColor: COLORS.border,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 28,
    fontWeight: "900",
    color: COLORS.textPrimary,
    backgroundColor: COLORS.backgroundLight,
  },
  statusBody: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  statusText: {
    fontSize: 18,
    fontWeight: "900",
    color: COLORS.textPrimary,
    textAlign: "center",
  },
  helperText: {
    fontSize: 12,
    fontWeight: "700",
    color: COLORS.textPrimary,
    opacity: 0.7,
    textAlign: "center",
  },
  errorText: {
    fontSize: 14,
    fontWeight: "800",
    color: COLORS.error,
    textAlign: "center",
  },
  footer: {
    gap: 12,
  },
  buttonShadow: {
    backgroundColor: COLORS.border,
  },
  primaryButton: {
    backgroundColor: COLORS.primaryBlue,
    borderWidth: BORDER_THICK.width,
    borderColor: COLORS.border,
    paddingVertical: 18,
    alignItems: "center",
    transform: [{ translateX: -SHADOW_OFFSET.width }, { translateY: -SHADOW_OFFSET.height }],
  },
  primaryButtonText: {
    fontSize: 16,
    fontWeight: "900",
    color: COLORS.textInverted,
    letterSpacing: 2,
  },
  secondaryButton: {
    backgroundColor: COLORS.surface,
    borderWidth: BORDER_THICK.width,
    borderColor: COLORS.border,
    paddingVertical: 18,
    alignItems: "center",
    transform: [{ translateX: -SHADOW_OFFSET.width }, { translateY: -SHADOW_OFFSET.height }],
  },
  secondaryButtonText: {
    fontSize: 16,
    fontWeight: "900",
    color: COLORS.textPrimary,
    letterSpacing: 2,
  },
});
