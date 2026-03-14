import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ActivityIndicator,
  Platform,
  Animated,
  Easing,
} from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import * as Haptics from "expo-haptics";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { usePrivy } from "@privy-io/expo";
import { parseUnits, formatUnits } from "viem";
import { COLORS, BORDER_THICK } from "../constants/theme";
import { useOperationalWallet } from "../lib/wallet";
import { playNfcDoneSound } from "../lib/audio/feedback";
import { CardEmulation, CardEmulationEvents } from "../lib/nfc/card-emulation";
import { getEnsClaimStatus } from "../lib/ens/service";
import {
  CHAIN_NAME,
  TOKEN_DECIMALS,
  TOKEN_SYMBOL,
  getTokenSymbolByAddress,
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
import { buildSuccessRouteParams } from "../lib/payments/tracking";
import { useTransactions } from "../lib/transaction-context";

type MerchantScreenState =
  | "enter_amount"
  | "ready_to_receive"
  | "claiming_payment"
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

function shortAddress(address?: string | null): string {
  if (!address) {
    return "UNKNOWN";
  }

  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function getStatusLabel(state: MerchantScreenState, error?: MerchantError): string {
  switch (state) {
    case "enter_amount":
      return "ENTER AMOUNT";
    case "ready_to_receive":
      return "READY TO RECEIVE";
    case "claiming_payment":
      return "CLAIMING PAYMENT";
    case "error":
      return `ERROR: ${error?.toUpperCase().replace(/_/g, " ") ?? "UNKNOWN"}`;
  }
}

const SHADOW_OFFSET = { width: 8, height: 8 };

const KEYPAD_ROWS = [
  ["1", "2", "3"],
  ["4", "5", "6"],
  ["7", "8", "9"],
  [".", "0", "backspace"],
];

// NfcIcon - NFC icon component
function NfcIcon({ size = 48, color = "#fff" }: { size?: number; color?: string }) {
  return <MaterialCommunityIcons name="nfc" size={size} color={color} />;
}

// AnimatedWaveBars - 5 bars animating in wave pattern
function AnimatedWaveBars({ isAnimating = true }: { isAnimating?: boolean }) {
  const barHeights = [32, 48, 64, 48, 32];
  const anims = useRef(barHeights.map(() => new Animated.Value(1))).current;

  useEffect(() => {
    if (!isAnimating) {
      anims.forEach((anim) => anim.setValue(1));
      return;
    }

    const animations = anims.map((anim, index) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(index * 150),
          Animated.timing(anim, {
            toValue: 1.5,
            duration: 600,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
          Animated.timing(anim, {
            toValue: 0.5,
            duration: 600,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
          Animated.timing(anim, {
            toValue: 1,
            duration: 600,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
        ]),
      ),
    );

    animations.forEach((animation) => animation.start());
    return () => animations.forEach((animation) => animation.stop());
  }, [anims, isAnimating]);

  return (
    <View style={styles.waveBars}>
      {barHeights.map((height, index) => (
        <Animated.View
          key={index}
          style={[styles.waveBar, { height, transform: [{ scaleY: anims[index] }] }]}
        />
      ))}
    </View>
  );
}

// DotsPattern - Decorative dot overlay
function DotsPattern() {
  const dotSize = 4;
  const gap = 16;
  const dots = [];

  for (let row = 0; row < 20; row += 1) {
    for (let column = 0; column < 20; column += 1) {
      dots.push(
        <View
          key={`${row}-${column}`}
          style={{
            position: "absolute",
            left: column * gap + gap / 2 - dotSize / 2,
            top: row * gap + gap / 2 - dotSize / 2,
            width: dotSize,
            height: dotSize,
            borderRadius: dotSize / 2,
            backgroundColor: COLORS.border,
          }}
        />,
      );
    }
  }

  return <View style={styles.dotsOverlay}>{dots}</View>;
}

export default function MerchantScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ amount?: string; skipKeypad?: string }>();
  const { user, isReady: privyReady } = usePrivy();
  const { addTransaction } = useTransactions();
  const {
    smartWalletAddress,
    isReady: walletReady,
    sendContractTransaction,
  } = useOperationalWallet();

  const skipKeypad = params.skipKeypad === "true" && parsePaymentAmount(params.amount ?? "") !== null;
  const isPosCheckoutFlow = skipKeypad;
  const [screenState, setScreenState] = useState<MerchantScreenState>(
    skipKeypad ? "ready_to_receive" : "enter_amount"
  );
  const [amountInput, setAmountInput] = useState(params.amount ?? "");
  const [pressedKey, setPressedKey] = useState<string | null>(null);
  const [errorType, setErrorType] = useState<MerchantError | undefined>();
  const [session, setSession] = useState<MerchantSession | null>(null);
  const [merchantEnsName, setMerchantEnsName] = useState<string | null>(null);
  const [customerEnsName, setCustomerEnsName] = useState<string | null>(null);
  const [customerAddress, setCustomerAddress] = useState<string | null>(null);
  const isStartingSessionRef = useRef(false);
  const isClaimingPaymentRef = useRef(false);

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

  useEffect(() => {
    if (!smartWalletAddress) {
      setMerchantEnsName(null);
      return;
    }

    getEnsClaimStatus(smartWalletAddress)
      .then((status) => {
        setMerchantEnsName(status.fullName);
      })
      .catch((error) => {
        console.warn("Failed to load merchant ENS:", error);
        setMerchantEnsName(null);
      });
  }, [smartWalletAddress]);

  const handleKeyPress = async (key: string) => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);

    if (key === "backspace") {
      setAmountInput((prev) => prev.slice(0, -1));
      return;
    }

    if (key === ".") {
      if (amountInput.includes(".")) {
        return;
      }
      if (amountInput === "") {
        setAmountInput("0.");
        return;
      }
      setAmountInput((prev) => prev + ".");
      return;
    }

    if (amountInput.includes(".")) {
      const decimals = amountInput.split(".")[1] || "";
      if (decimals.length >= 2) {
        return;
      }
    }

    if (amountInput === "0" && key !== ".") {
      setAmountInput(key);
      return;
    }

    if (amountInput.length >= 10) {
      return;
    }

    setAmountInput((prev) => prev + key);
  };

  const handleClaimPayment = useCallback(
    async (
      activeSession: MerchantSession,
      parsedAuthorization: ParsedAuthorization,
      resolvedCustomerEnsName: string | null
    ) => {
      if (isClaimingPaymentRef.current) {
        return;
      }

      isClaimingPaymentRef.current = true;
      setScreenState("claiming_payment");

      try {
        const tx = buildClaimPaymentTransaction(activeSession, parsedAuthorization);
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

        await addTransaction({
          role: "receiver",
          from: parsedAuthorization.customerAddress,
          to: activeSession.merchantAddress,
          amount: activeSession.amount,
          tokenSymbol: getTokenSymbolByAddress(activeSession.tokenAddress),
          chainName: CHAIN_NAME,
          txHash,
          fromLabel: resolvedCustomerEnsName,
          toLabel: merchantEnsName,
        }).catch((error) => {
          console.warn("Failed to add merchant payment to recent activity:", error);
        });

        // NFC cleanup - audio plays on success page
        await CardEmulation.setReady(false);
        await CardEmulation.setMerchantMode(false);
        await CardEmulation.clearPaymentRequest();
        await CardEmulation.clearPaymentAuthorization();

        // Navigate to unified success page
        router.replace({
          pathname: "/payment-success",
          params: buildSuccessRouteParams(
            {
              sessionId: activeSession.sessionId,
              requestId: activeSession.requestId,
              from: parsedAuthorization.customerAddress,
              to: activeSession.merchantAddress,
              amount: activeSession.amount,
              tokenAddress: activeSession.tokenAddress,
              chainId: activeSession.chainId,
              createdAt: activeSession.createdAt,
              txHash,
              blockNumber: receipt.blockNumber,
            },
            "receiver",
            {
              fromLabel: resolvedCustomerEnsName,
              toLabel: merchantEnsName,
            }
          ),
        });
      } catch (err) {
        console.error("Failed to claim payment:", err);
        setErrorType("claim_failed");
        setScreenState("error");
      } finally {
        isClaimingPaymentRef.current = false;
      }
    },
    [addTransaction, merchantEnsName, sendContractTransaction],
  );

  // Listen for authorization from customer and claim automatically.
  useEffect(() => {
    const subscription = CardEmulationEvents.onStateChanged(async (state) => {
      if (!state.hasPaymentAuthorization || !session || isClaimingPaymentRef.current) {
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

        if (isSessionExpired(session)) {
          setErrorType("session_expired");
          setScreenState("error");
          await CardEmulation.clearPaymentAuthorization();
          return;
        }

        if (!matchesMerchantSession(session, parsed)) {
          setErrorType("authorization_invalid");
          setScreenState("error");
          await CardEmulation.clearPaymentAuthorization();
          return;
        }

        setCustomerAddress(parsed.customerAddress);

        // Resolve ENS synchronously before claiming payment
        let resolvedCustomerEnsName: string | null = null;
        try {
          const ensStatus = await getEnsClaimStatus(parsed.customerAddress);
          resolvedCustomerEnsName = ensStatus.fullName;
          setCustomerEnsName(ensStatus.fullName);
        } catch (error) {
          console.warn("Failed to load customer ENS:", error);
          setCustomerEnsName(null);
        }

        // "Safe to remove phones" - 2 beeps × 2 times
        await playNfcDoneSound();
        await CardEmulation.clearPaymentAuthorization();
        await handleClaimPayment(session, parsed, resolvedCustomerEnsName);
      } catch (err) {
        console.error("Failed to process authorization:", err);
        setErrorType("authorization_invalid");
        setScreenState("error");
      }
    });

    return () => {
      subscription?.remove();
    };
  }, [handleClaimPayment, session]);

  const handleStartSession = useCallback(async () => {
    if (isStartingSessionRef.current || (screenState !== "enter_amount" && screenState !== "ready_to_receive")) {
      return;
    }

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

    isStartingSessionRef.current = true;
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);

    const newSession = createMerchantSession(
      smartWalletAddress,
      amount,
      undefined,
      undefined,
      merchantEnsName ?? undefined,
    );

    try {
      // Set up merchant mode
      await CardEmulation.setMerchantMode(true);
      await CardEmulation.clearPaymentAuthorization();

      // Publish the payment request
      const message = buildMerchantPaymentRequestMessage(newSession);
      await CardEmulation.setPaymentRequest(message);
      await CardEmulation.setReady(true);
      await CardEmulation.startListening();

      setErrorType(undefined);
      setCustomerEnsName(null);
      setCustomerAddress(null);
      setSession(newSession);
      setScreenState("ready_to_receive");
    } catch (err) {
      console.error("Failed to start merchant session:", err);
      setErrorType("publish_failed");
      setScreenState("error");
    } finally {
      isStartingSessionRef.current = false;
    }
  }, [amountInput, merchantEnsName, screenState, smartWalletAddress, walletReady]);

  useEffect(() => {
    if (
      (screenState !== "enter_amount" && screenState !== "ready_to_receive") ||
      !walletReady ||
      !smartWalletAddress ||
      !parsePaymentAmount(amountInput)
    ) {
      return;
    }

    const shouldSkipKeypad = params.skipKeypad === "true";

    // Skip keypad immediately if amount provided from POS (already in ready_to_receive)
    if (shouldSkipKeypad && screenState === "ready_to_receive") {
      handleStartSession().catch(console.error);
      return;
    }

    // Auto-start after delay for normal flow
    if (screenState === "enter_amount") {
      const timeoutId = setTimeout(() => {
        handleStartSession().catch(console.error);
      }, 1000);

      return () => {
        clearTimeout(timeoutId);
      };
    }
  }, [amountInput, handleStartSession, params.skipKeypad, screenState, smartWalletAddress, walletReady]);

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

    if (isPosCheckoutFlow) {
      router.back();
      return;
    }

    setScreenState("enter_amount");
    setAmountInput("");
    setErrorType(undefined);
    setSession(null);
    setCustomerEnsName(null);
    setCustomerAddress(null);
  }, [isPosCheckoutFlow, router]);

  const displayAmount = useMemo(() => {
    if (session) {
      return formatPaymentAmount(session.amount);
    }
    return amountInput || "0.00";
  }, [amountInput, session]);

  const backgroundColor = COLORS.green400;

  return (
    <View style={[styles.container, { backgroundColor }]}>
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
              <View style={styles.keypad}>
                {KEYPAD_ROWS.map((row, rowIndex) => (
                  <View key={rowIndex} style={styles.keypadRow}>
                    {row.map((key) => (
                      <View key={key} style={styles.keyButtonShadow}>
                        <Pressable
                          onPress={() => handleKeyPress(key)}
                          onPressIn={() => setPressedKey(key)}
                          onPressOut={() => setPressedKey(null)}
                          style={[
                            styles.keyButton,
                            key === "backspace" && styles.backspaceButton,
                            pressedKey === key && styles.keyPressed,
                          ]}
                        >
                          {key === "backspace" ? (
                            <Text style={styles.backspaceIcon}>⌫</Text>
                          ) : (
                            <Text style={styles.keyText}>{key}</Text>
                          )}
                        </Pressable>
                      </View>
                    ))}
                  </View>
                ))}
              </View>
            ) : (
              <View style={styles.statusContent}>
                {screenState === "ready_to_receive" && (
                  <>
                    <DotsPattern />
                    <View style={styles.nfcCardContent}>
                      <View style={styles.nfcCircle}>
                        <NfcIcon size={48} color={COLORS.textInverted} />
                      </View>
                      <AnimatedWaveBars isAnimating={true} />
                      <Text style={styles.statusText}>WAITING FOR CUSTOMER TAP</Text>
                    </View>
                  </>
                )}
                {screenState === "claiming_payment" && (
                  <>
                    <DotsPattern />
                    <View style={styles.nfcCardContent}>
                      <View style={[styles.nfcCircle, styles.warningCircle]}>
                        <ActivityIndicator size="large" color={COLORS.textInverted} />
                      </View>
                      <Text style={styles.statusText}>CLAIMING PAYMENT...</Text>
                    </View>
                  </>
                )}
                {screenState === "error" && (
                  <>
                    <DotsPattern />
                    <View style={styles.nfcCardContent}>
                      <View style={[styles.nfcCircle, styles.errorCircle]}>
                        <Text style={styles.nfcIconText}>✕</Text>
                      </View>
                      <Text style={styles.errorText}>{getStatusLabel(screenState, errorType)}</Text>
                    </View>
                  </>
                )}
              </View>
            )}
          </View>
        </View>

        {/* Merchant Info */}
        {smartWalletAddress && (
          <View style={styles.infoBoxShadow}>
            <View style={styles.infoBox}>
              <Text style={styles.infoLabel}>MERCHANT</Text>
              <Text style={styles.infoText}>{merchantEnsName ?? shortAddress(smartWalletAddress)}</Text>
              <Text style={styles.infoSubtext}>{shortAddress(smartWalletAddress)}</Text>
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
          <View style={styles.footerButtonShadow}>
            <Pressable onPress={handleCancel} style={styles.footerButton}>
              <Text style={styles.footerButtonText}>CANCEL</Text>
            </Pressable>
          </View>
        )}

        {screenState === "ready_to_receive" && (
          <View style={styles.footerButtonShadow}>
            <Pressable onPress={handleReset} style={styles.warningButton}>
              <Text style={styles.footerButtonText}>CANCEL PAYMENT</Text>
            </Pressable>
          </View>
        )}

        {screenState === "error" && (
          <View style={styles.footerButtonShadow}>
            <Pressable onPress={handleReset} style={styles.footerButton}>
              <Text style={styles.footerButtonText}>
                {isPosCheckoutFlow ? "BACK TO CHECKOUT" : "TRY AGAIN"}
              </Text>
            </Pressable>
          </View>
        )}
      </View>
    </View>
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
    minHeight: 260,
    overflow: "hidden",
    transform: [{ translateX: -SHADOW_OFFSET.width }, { translateY: -SHADOW_OFFSET.height }],
  },
  keypad: {
    width: "100%",
  },
  keypadRow: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 12,
  },
  keyButtonShadow: {
    flex: 1,
    backgroundColor: COLORS.border,
  },
  keyButton: {
    aspectRatio: 1.5,
    backgroundColor: COLORS.surface,
    borderWidth: BORDER_THICK.width,
    borderColor: COLORS.border,
    alignItems: "center",
    justifyContent: "center",
    transform: [{ translateX: -4 }, { translateY: -4 }],
  },
  backspaceButton: {
    backgroundColor: COLORS.pink400,
  },
  keyText: {
    fontSize: 32,
    fontWeight: "900",
    color: COLORS.textPrimary,
  },
  backspaceIcon: {
    fontSize: 32,
    fontWeight: "900",
    color: COLORS.textPrimary,
  },
  keyPressed: {
    transform: [{ translateX: 0 }, { translateY: 0 }],
  },
  statusContent: {
    flex: 1,
  },
  dotsOverlay: {
    ...StyleSheet.absoluteFillObject,
    opacity: 0.2,
  },
  nfcCardContent: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 16,
  },
  nfcCircle: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: COLORS.primaryBlue,
    borderWidth: BORDER_THICK.width,
    borderColor: COLORS.border,
    alignItems: "center",
    justifyContent: "center",
  },
  warningCircle: {
    backgroundColor: COLORS.warning,
  },
  errorCircle: {
    backgroundColor: COLORS.error,
  },
  nfcIconText: {
    fontSize: 36,
    fontWeight: "900",
    color: COLORS.textInverted,
  },
  waveBars: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  waveBar: {
    width: 14,
    backgroundColor: COLORS.border,
  },
  statusText: {
    fontSize: 18,
    fontWeight: "900",
    color: COLORS.textPrimary,
    textAlign: "center",
    letterSpacing: 1,
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
  infoSubtext: {
    fontSize: 12,
    fontWeight: "700",
    color: COLORS.textMuted,
    marginTop: 4,
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
  warningButton: {
    backgroundColor: COLORS.warning,
    borderWidth: BORDER_THICK.width,
    borderColor: COLORS.border,
    paddingVertical: 14,
    alignItems: "center",
    transform: [{ translateX: -SHADOW_OFFSET.width }, { translateY: -SHADOW_OFFSET.height }],
  },
});
