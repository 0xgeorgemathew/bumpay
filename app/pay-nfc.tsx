import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Animated,
  Easing,
  ActivityIndicator,
} from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import * as Haptics from "expo-haptics";
import { parseUnits } from "viem";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { usePrivy } from "@privy-io/expo";
import { COLORS, BORDER_THICK } from "../constants/theme";
import { useOperationalWallet } from "../lib/wallet";
import { playNfcCompleteSound } from "../lib/audio/feedback";
import { getEnsClaimStatus } from "../lib/ens/service";
import { NfcReader, NfcReaderEvents } from "../lib/nfc/reader";
import {
  PROTOCOL_VERSION,
  serializeProtocolMessage,
  type PaymentIntent,
  type PublishedPaymentRequest,
} from "../lib/nfc/protocol";
import { recipientResolver } from "../lib/recipient-profile";
import { DEFAULT_PAYMENT_POLICY } from "../lib/payments/policy";
import { planPayment } from "../lib/payments/planner";
import {
  buildSuccessRouteParams,
  watchSubmittedPayment,
  type ConfirmedPaymentDetails,
  type PaymentTrackingStatus,
  type TrackedPaymentIntent,
} from "../lib/payments/tracking";
import {
  CHAIN_ID,
  TOKEN_ADDRESS,
  TOKEN_DECIMALS,
  TOKEN_SYMBOL,
} from "../lib/blockchain/contracts";

type PayState =
  | "idle"
  | "scanning"
  | "broadcasting"
  | "watching_chain"
  | "agent"
  | "error"
  | "connection_lost";

type PayerStatus =
  | "waiting"
  | "waiting_for_wallet"
  | "wallet_setup_failed"
  | "ready_to_tap"
  | "pairing"
  | "agent_required"
  | "sending"
  | "watching_chain"
  | "payment_failed"
  | "reader_failed"
  | "chain_connection_lost";

function parsePaymentAmount(value?: string): bigint | null {
  if (!value || !value.trim()) {
    return null;
  }

  try {
    const parsed = parseUnits(value.trim(), TOKEN_DECIMALS);
    return parsed > BigInt(0) ? parsed : null;
  } catch {
    return null;
  }
}

function getPayerStatusLabel(status: PayerStatus, recipientEnsName?: string) {
  const recipientLabel = recipientEnsName ?? "RECIPIENT";

  switch (status) {
    case "waiting":
      return "WAITING";
    case "waiting_for_wallet":
      return "WAITING FOR WALLET";
    case "wallet_setup_failed":
      return "WALLET SETUP FAILED";
    case "ready_to_tap":
      return "READY TO TAP";
    case "pairing":
      return `PAIRING ${recipientLabel}`.toUpperCase();
    case "agent_required":
      return "AGENT REQUIRED";
    case "sending":
      return `SENDING TO ${recipientLabel}`.toUpperCase();
    case "watching_chain":
      return "WATCHING CHAIN";
    case "reader_failed":
      return "READER FAILED";
    case "chain_connection_lost":
      return "CHAIN CONNECTION LOST";
    case "payment_failed":
      return "PAYMENT FAILED";
  }
}

function buildPayerIntent(
  requestPayload: PublishedPaymentRequest,
  payerAddress: `0x${string}`,
  receiverAddress: `0x${string}`,
  amount: bigint,
): TrackedPaymentIntent {
  return {
    sessionId: requestPayload.sessionId,
    requestId: requestPayload.requestId,
    from: payerAddress,
    to: receiverAddress,
    amount,
    tokenAddress: TOKEN_ADDRESS,
    chainId: CHAIN_ID,
    createdAt: Date.now(),
  };
}

function buildNfcPaymentIntent(intent: TrackedPaymentIntent): PaymentIntent {
  return {
    sessionId: intent.sessionId,
    requestId: intent.requestId,
    payerAddress: intent.from,
    receiverAddress: intent.to,
    amount: intent.amount.toString(),
    tokenAddress: intent.tokenAddress,
    chainId: intent.chainId,
    createdAt: intent.createdAt,
  };
}

function buildPayerSuccessParams(details: ConfirmedPaymentDetails) {
  return buildSuccessRouteParams(details, "payer");
}

function NfcIcon({ size = 48, color = "#fff" }: { size?: number; color?: string }) {
  return <MaterialCommunityIcons name="nfc" size={size} color={color} />;
}

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

export default function PayNfcScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ amount?: string }>();
  const { user, isReady: privyReady } = usePrivy();
  const {
    smartWalletAddress,
    status: walletStatus,
    retryProvisioning,
    sendTokens,
    refreshBalances,
    error: walletError,
  } = useOperationalWallet();
  const [payState, setPayState] = useState<PayState>("idle");
  const [statusLabel, setStatusLabel] = useState(getPayerStatusLabel("waiting"));
  const [payerEnsName, setPayerEnsName] = useState<string | null>(null);
  const [recipientEnsName, setRecipientEnsName] = useState<string | null>(null);
  const [safeToRemove, setSafeToRemove] = useState(false);
  const isProcessingRef = useRef(false);
  const stopWatcherRef = useRef<(() => void) | null>(null);

  const payerAmount = useMemo(() => parsePaymentAmount(params.amount), [params.amount]);
  const displayedAmount = params.amount || "0";
  const canScan = walletStatus === "ready" && !!smartWalletAddress;

  useEffect(() => {
    if (privyReady && !user) {
      router.replace("/login");
    }
  }, [privyReady, router, user]);

  useEffect(() => {
    let cancelled = false;

    const loadPayerEnsName = async () => {
      if (!smartWalletAddress) {
        if (!cancelled) {
          setPayerEnsName(null);
        }
        return;
      }

      const status = await getEnsClaimStatus(smartWalletAddress);
      if (!cancelled) {
        setPayerEnsName(status.fullName);
      }
    };

    loadPayerEnsName().catch((error) => {
      console.error("Failed to resolve payer ENS name:", error);
      if (!cancelled) {
        setPayerEnsName(null);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [smartWalletAddress]);

  const stopReader = useCallback(async () => {
    await NfcReader.stopReader().catch(() => undefined);
    await NfcReader.clearScanSession().catch(() => undefined);
  }, []);

  const stopTracking = useCallback(() => {
    stopWatcherRef.current?.();
    stopWatcherRef.current = null;
  }, []);

  const handleConfirmed = useCallback(
    async (details: ConfirmedPaymentDetails) => {
      await refreshBalances().catch(() => undefined);
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.replace({
        pathname: "/payment-success",
        params: buildPayerSuccessParams(details),
      });
    },
    [refreshBalances, router],
  );

  const handleWatchFailure = useCallback(
    async (
      status: Extract<PaymentTrackingStatus, "failed" | "connection_lost">,
      message: string,
    ) => {
      setPayState(status === "connection_lost" ? "connection_lost" : "error");
      setStatusLabel(
        getPayerStatusLabel(
          status === "connection_lost" ? "chain_connection_lost" : "payment_failed",
        ),
      );
      console.error("Payment watch failed:", message);
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    },
    [],
  );

  const handlePaymentRequest = useCallback(
    async (requestPayload: PublishedPaymentRequest) => {
      if (isProcessingRef.current || !smartWalletAddress || walletStatus !== "ready") {
        return;
      }

      isProcessingRef.current = true;
      stopTracking();

      try {
        const resolvedProfile = await recipientResolver.resolveFromNfc(requestPayload);
        setRecipientEnsName(resolvedProfile.ensName ?? requestPayload.ensName ?? null);
        setSafeToRemove(false);
        const balances = await refreshBalances();
        if (!balances) {
          throw new Error("Unable to read smart wallet balances");
        }

        const requestedAmount =
          payerAmount ?? parsePaymentAmount(requestPayload.amountHint?.amount);
        if (!requestedAmount) {
          throw new Error("No valid amount");
        }

        const result = planPayment({
          profile: resolvedProfile,
          requestedAmount,
          funding: {
            chainId: CHAIN_ID,
            tokenBalance: balances.usdcBalance,
            nativeBalance: balances.nativeBalance,
          },
          policy: DEFAULT_PAYMENT_POLICY,
        });

        if (!result.directPlan) {
          await stopReader();
          setPayState("agent");
          setStatusLabel(getPayerStatusLabel("agent_required"));
          await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
          return;
        }

        const intent = buildPayerIntent(
          requestPayload,
          smartWalletAddress,
          result.directPlan.recipient,
          result.directPlan.targetAmount,
        );

        setPayState("broadcasting");
        setStatusLabel(
          getPayerStatusLabel("pairing", resolvedProfile.ensName ?? requestPayload.ensName),
        );

        await NfcReader.sendPaymentIntent(
          serializeProtocolMessage({
            version: PROTOCOL_VERSION,
            kind: "PAYMENT_INTENT",
            ...buildNfcPaymentIntent(intent),
          }),
        );
        playNfcCompleteSound().catch(console.error);

        await stopReader();
        setSafeToRemove(true);

        setStatusLabel(
          getPayerStatusLabel("sending", resolvedProfile.ensName ?? requestPayload.ensName),
        );
        const hash = await sendTokens(intent.to, intent.amount);
        if (!hash) {
          throw new Error(walletError || "Smart wallet transaction failed");
        }

        setPayState("watching_chain");
        setStatusLabel(getPayerStatusLabel("watching_chain"));
        stopWatcherRef.current = watchSubmittedPayment(intent, hash, {
          onConfirmed: (details) => {
            handleConfirmed(details).catch(console.error);
          },
          onFailed: (status, message) => {
            handleWatchFailure(status, message).catch(console.error);
          },
        });
      } catch (requestError) {
        await stopReader();
        setSafeToRemove(true);
        setPayState("error");
        setStatusLabel(getPayerStatusLabel("payment_failed"));
        setRecipientEnsName(null);
        console.error("Payment request failed:", requestError);
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      } finally {
        isProcessingRef.current = false;
      }
    },
    [
      handleConfirmed,
      handleWatchFailure,
      payerAmount,
      refreshBalances,
      sendTokens,
      smartWalletAddress,
      stopReader,
      stopTracking,
      walletStatus,
      walletError,
    ],
  );

  useEffect(() => {
    if (!canScan) {
      setPayState(walletStatus === "error" ? "error" : "idle");
      setStatusLabel(
        getPayerStatusLabel(
          walletStatus === "error" ? "wallet_setup_failed" : "waiting_for_wallet",
        ),
      );
      setSafeToRemove(false);
      return;
    }

    setPayState("scanning");
    setStatusLabel(getPayerStatusLabel("ready_to_tap"));
    setSafeToRemove(false);

    NfcReader.setScanSession("")
      .then(() => NfcReader.startReader())
      .catch((readerError) => {
        console.error("Reader setup failed:", readerError);
        setPayState("error");
        setStatusLabel(getPayerStatusLabel("reader_failed"));
        setSafeToRemove(true);
      });

    const subscriptions = [
      NfcReaderEvents.onPaymentRequest((requestPayload) => {
        handlePaymentRequest(requestPayload).catch(console.error);
      }),
      NfcReaderEvents.onError((message) => {
        stopReader().catch(() => undefined);
        setPayState("error");
        setStatusLabel(getPayerStatusLabel("reader_failed"));
        setSafeToRemove(true);
        console.error("Reader error:", message);
      }),
    ];

    return () => {
      subscriptions.forEach((subscription) => subscription?.remove());
      stopTracking();
      stopReader().catch(() => undefined);
    };
  }, [canScan, handlePaymentRequest, stopReader, stopTracking, walletStatus]);

  const handleCancel = async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    stopTracking();
    await stopReader();
    router.back();
  };

  const handleRetryProvisioning = async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    retryProvisioning();
  };

  const routeLabel = useMemo(() => {
    if (!payerEnsName || !recipientEnsName) {
      return null;
    }

    return `${payerEnsName} -> ${recipientEnsName}`;
  }, [payerEnsName, recipientEnsName]);

  return (
    <View style={styles.container}>
      <View style={styles.mainContent}>
        <View style={styles.contentStack}>
          <View style={styles.amountBoxShadow}>
            <View style={styles.amountBox}>
              <Text style={styles.amountText}>
                {displayedAmount} {TOKEN_SYMBOL}
              </Text>
            </View>
          </View>

          <View style={styles.nfcCardShadow}>
            <View style={styles.nfcCard}>
              <DotsPattern />
              <View style={styles.nfcCardContent}>
                <View
                  style={[
                    styles.nfcCircle,
                    payState === "error" || payState === "connection_lost"
                      ? styles.errorCircle
                      : payState === "broadcasting" || payState === "watching_chain"
                        ? styles.warningCircle
                        : null,
                  ]}
                >
                  {payState === "broadcasting" || payState === "watching_chain" ? (
                    <ActivityIndicator size="large" color={COLORS.textInverted} />
                  ) : payState === "error" || payState === "connection_lost" ? (
                    <Text style={styles.nfcIconText}>✕</Text>
                  ) : (
                    <NfcIcon size={48} color={COLORS.textInverted} />
                  )}
                </View>
                <AnimatedWaveBars isAnimating={payState === "scanning"} />
                {routeLabel ? <Text style={styles.routeText}>{routeLabel}</Text> : null}
              </View>
            </View>
          </View>
        </View>
      </View>

      <View style={styles.footerStack}>
        <View style={styles.statusButtonShadow}>
          <View style={styles.statusButton}>
            <View style={styles.statusContent}>
              <Text style={styles.statusText}>{statusLabel}</Text>
            </View>
          </View>
        </View>

        {safeToRemove ? (
          <View style={styles.safeButtonShadow}>
            <View style={styles.safeButton}>
              <Text style={styles.safeButtonText}>SAFE TO REMOVE</Text>
            </View>
          </View>
        ) : null}

        {walletStatus === "error" ? (
          <View style={styles.footerButtonShadow}>
            <Pressable onPress={handleRetryProvisioning} style={styles.retryButton}>
              <Text style={styles.footerButtonText}>RETRY WALLET SETUP</Text>
            </Pressable>
          </View>
        ) : null}

        <View style={styles.footerButtonShadow}>
          <Pressable onPress={handleCancel} style={styles.footerButton}>
            <Text style={styles.footerButtonText}>CANCEL</Text>
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
    paddingBottom: 16,
  },
  mainContent: {
    flex: 1,
    justifyContent: "center",
  },
  contentStack: {
    gap: 16,
  },
  amountBoxShadow: {
    backgroundColor: COLORS.border,
    width: "100%",
    marginBottom: 16,
  },
  amountBox: {
    backgroundColor: COLORS.surface,
    borderWidth: BORDER_THICK.width,
    borderColor: COLORS.border,
    paddingVertical: 18,
    paddingHorizontal: 32,
    width: "100%",
    alignItems: "center",
    transform: [{ translateX: -8 }, { translateY: -8 }],
  },
  amountText: {
    fontSize: 40,
    fontWeight: "900",
    fontStyle: "italic",
    color: COLORS.textPrimary,
    textAlign: "center",
  },
  nfcCardShadow: {
    backgroundColor: COLORS.border,
    marginBottom: 16,
  },
  nfcCard: {
    height: 260,
    backgroundColor: COLORS.surface,
    borderWidth: BORDER_THICK.width,
    borderColor: COLORS.border,
    overflow: "hidden",
    transform: [{ translateX: -8 }, { translateY: -8 }],
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
  routeText: {
    fontSize: 14,
    fontWeight: "900",
    color: COLORS.textPrimary,
    textAlign: "center",
    paddingHorizontal: 24,
  },
  waveBar: {
    width: 14,
    backgroundColor: COLORS.border,
  },
  statusButtonShadow: {
    backgroundColor: COLORS.border,
    marginBottom: 12,
  },
  statusButton: {
    backgroundColor: COLORS.yellow400,
    borderWidth: BORDER_THICK.width,
    borderColor: COLORS.border,
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 60,
    transform: [{ translateX: -8 }, { translateY: -8 }],
  },
  statusText: {
    fontSize: 16,
    fontWeight: "900",
    color: COLORS.textPrimary,
    letterSpacing: 1,
    textAlign: "center",
  },
  statusContent: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  safeButtonShadow: {
    backgroundColor: COLORS.border,
    marginBottom: 12,
  },
  safeButton: {
    backgroundColor: COLORS.primaryBlue,
    borderWidth: BORDER_THICK.width,
    borderColor: COLORS.border,
    paddingVertical: 12,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 54,
    transform: [{ translateX: -8 }, { translateY: -8 }],
  },
  safeButtonText: {
    fontSize: 14,
    fontWeight: "900",
    color: COLORS.textInverted,
    letterSpacing: 1.2,
    textAlign: "center",
  },
  footerStack: {
    width: "100%",
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
    transform: [{ translateX: -8 }, { translateY: -8 }],
  },
  retryButton: {
    backgroundColor: COLORS.warning,
    borderWidth: BORDER_THICK.width,
    borderColor: COLORS.border,
    paddingVertical: 14,
    alignItems: "center",
    transform: [{ translateX: -8 }, { translateY: -8 }],
  },
  footerButtonText: {
    fontSize: 16,
    fontWeight: "900",
    color: COLORS.textPrimary,
    letterSpacing: 1,
  },
});
