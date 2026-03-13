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
import { usePrivy } from "@privy-io/expo";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { parseUnits, type Address } from "viem";
import { COLORS, BORDER_THICK } from "../constants/theme";
import { useOperationalWallet } from "../lib/wallet";
import { playNfcCompleteSound } from "../lib/audio/feedback";
import { getEnsClaimStatus, readEnsProfileByLabel } from "../lib/ens/service";
import { CardEmulation, CardEmulationEvents } from "../lib/nfc/card-emulation";
import {
  PROTOCOL_VERSION,
  parseProtocolMessage,
  serializeProtocolMessage,
  type PaymentIntent,
  type PublishedPaymentRequest,
} from "../lib/nfc/protocol";
import {
  buildSuccessRouteParams,
  watchIncomingPayment,
  type ConfirmedPaymentDetails,
  type PaymentTrackingStatus,
  type TrackedPaymentIntent,
} from "../lib/payments/tracking";
import {
  CHAIN_ID,
  TOKEN_ADDRESS,
  TOKEN_DECIMALS,
  getTokenSymbolByAddress,
  isSupportedPaymentToken,
} from "../lib/blockchain/contracts";
import { generatePaymentRequestId } from "../lib/payments/request";

type ReceiveState =
  | "preparing"
  | "ready"
  | "watching_chain"
  | "verifying_ens"
  | "connection_lost"
  | "error";

type ReceiverStatus =
  | "waiting"
  | "waiting_for_wallet"
  | "ready_to_receive"
  | "pairing_payment"
  | "watching_chain"
  | "verify_ens_claim"
  | "claim_ens"
  | "wallet_setup_failed"
  | "publish_failed"
  | "payment_failed"
  | "chain_connection_lost";

function parsePaymentAmount(value: string): bigint | null {
  if (!value.trim()) {
    return null;
  }

  try {
    const parsed = parseUnits(value.trim(), TOKEN_DECIMALS);
    return parsed > BigInt(0) ? parsed : null;
  } catch {
    return null;
  }
}

function getReceiverStatusLabel(status: ReceiverStatus) {
  switch (status) {
    case "waiting":
      return "WAITING";
    case "waiting_for_wallet":
      return "WAITING FOR WALLET";
    case "ready_to_receive":
      return "READY TO RECEIVE";
    case "pairing_payment":
      return "PAIRING PAYMENT";
    case "watching_chain":
      return "WATCHING CHAIN";
    case "verify_ens_claim":
      return "VERIFY ENS CLAIM";
    case "claim_ens":
      return "CLAIM ENS FIRST";
    case "wallet_setup_failed":
      return "WALLET SETUP FAILED";
    case "publish_failed":
      return "PUBLISH FAILED";
    case "chain_connection_lost":
      return "CHAIN CONNECTION LOST";
    case "payment_failed":
      return "PAYMENT FAILED";
  }
}

function buildIncomingTrackedIntent(intent: PaymentIntent): TrackedPaymentIntent {
  return {
    sessionId: intent.sessionId,
    requestId: intent.requestId,
    from: intent.payerAddress,
    to: intent.receiverAddress,
    amount: BigInt(intent.amount),
    tokenAddress: intent.tokenAddress,
    chainId: intent.chainId,
    createdAt: intent.createdAt,
  };
}

function buildPublishedPaymentRequestMessage(
  paymentRequest: PublishedPaymentRequest,
) {
  // P2P format: only send ENS name + amount
  // Legacy format: send recipientAddress + preferences
  const isP2P = "ensName" in paymentRequest && paymentRequest.ensName;

  return serializeProtocolMessage({
    version: PROTOCOL_VERSION,
    kind: "PAYMENT_REQUEST",
    sessionId: paymentRequest.sessionId,
    requestId: paymentRequest.requestId,
    // P2P: ENS name is primary identifier
    ensName: paymentRequest.ensName,
    // Legacy: include address and preferences
    recipientAddress: !isP2P ? ("recipientAddress" in paymentRequest ? paymentRequest.recipientAddress : undefined) : undefined,
    amountHint: paymentRequest.amountHint,
    // Deprecated for P2P - resolved from ENS on payer side
    preferredChains: !isP2P ? ("preferredChains" in paymentRequest ? paymentRequest.preferredChains : undefined) : undefined,
    preferredTokens: !isP2P ? ("preferredTokens" in paymentRequest ? paymentRequest.preferredTokens : undefined) : undefined,
    profileVersion: paymentRequest.profileVersion,
    mode: "mode" in paymentRequest ? paymentRequest.mode : undefined,
  });
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

function uniqueNumbers(values: number[]) {
  return Array.from(new Set(values));
}

function uniqueTokens(values: Array<`0x${string}` | "NATIVE">) {
  return Array.from(new Set(values.filter((value): value is `0x${string}` => value !== "NATIVE")));
}

export default function ReceiveScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ amount?: string }>();
  const { user, isReady: privyReady } = usePrivy();
  const {
    smartWalletAddress,
    status: walletStatus,
    retryProvisioning,
  } = useOperationalWallet();
  const [receiveState, setReceiveState] = useState<ReceiveState>("preparing");
  const [statusLabel, setStatusLabel] = useState(getReceiverStatusLabel("waiting"));
  const [verifiedEnsName, setVerifiedEnsName] = useState<string | null>(null);
  const [ensCheckComplete, setEnsCheckComplete] = useState(false);
  const [payerEnsName, setPayerEnsName] = useState<string | null>(null);
  const [receivingTokenAddress, setReceivingTokenAddress] = useState<Address | null>(null);
  const [safeToRemove, setSafeToRemove] = useState(false);
  const requestedAmount = params.amount ?? "0";
  const requestIdRef = useRef(generatePaymentRequestId());
  const sessionIdRef = useRef(requestIdRef.current);
  const handlingIntentRef = useRef(false);
  const stopWatcherRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    let cancelled = false;

    const verifyEnsClaim = async () => {
      if (!smartWalletAddress || walletStatus !== "ready") {
        if (!cancelled) {
          setVerifiedEnsName(null);
          setEnsCheckComplete(false);
          setReceivingTokenAddress(null);
          setSafeToRemove(false);
        }
        return;
      }

      setEnsCheckComplete(false);
      setReceiveState("verifying_ens");
      setStatusLabel(getReceiverStatusLabel("verify_ens_claim"));

      try {
        const status = await getEnsClaimStatus(smartWalletAddress);
        const profile = status.label ? await readEnsProfileByLabel(status.label) : null;

        if (!cancelled) {
          if (status.fullName) {
            setVerifiedEnsName(status.fullName);
            setReceivingTokenAddress(
              profile?.defaultAsset?.token && profile.defaultAsset.token !== "NATIVE"
                ? profile.defaultAsset.token
                : TOKEN_ADDRESS,
            );
            setEnsCheckComplete(true);
            setReceiveState("preparing");
            setStatusLabel(getReceiverStatusLabel("waiting"));
            setSafeToRemove(false);
          } else {
            setVerifiedEnsName(null);
            setEnsCheckComplete(true);
            setReceivingTokenAddress(null);
            setReceiveState("error");
            setStatusLabel(getReceiverStatusLabel("claim_ens"));
          }
        }
      } catch (error) {
        if (!cancelled) {
          setVerifiedEnsName(null);
          setEnsCheckComplete(true);
          setReceivingTokenAddress(null);
          setReceiveState("error");
          setStatusLabel(getReceiverStatusLabel("verify_ens_claim"));
        }
      }
    };

    verifyEnsClaim().catch(() => undefined);

    return () => {
      cancelled = true;
    };
  }, [smartWalletAddress, walletStatus]);

  const requestPayload = useMemo<PublishedPaymentRequest | null>(() => {
    if (
      !smartWalletAddress ||
      walletStatus !== "ready" ||
      !verifiedEnsName ||
      !receivingTokenAddress
    ) {
      return null;
    }

    const amountHint = parsePaymentAmount(requestedAmount)
      ? {
          assetSymbol: getTokenSymbolByAddress(receivingTokenAddress),
          amount: requestedAmount,
          decimals: TOKEN_DECIMALS,
        }
      : undefined;

    return {
      sessionId: sessionIdRef.current,
      requestId: requestIdRef.current,
      ensName: verifiedEnsName,
      amountHint,
      profileVersion: "1",
    };
  }, [receivingTokenAddress, requestedAmount, smartWalletAddress, verifiedEnsName, walletStatus]);

  useEffect(() => {
    if (privyReady && !user) {
      router.replace("/login");
    }
  }, [privyReady, router, user]);

  const stopTracking = useCallback(() => {
    stopWatcherRef.current?.();
    stopWatcherRef.current = null;
  }, []);

  const stopPublishing = useCallback(async () => {
    await CardEmulation.setReady(false).catch(() => undefined);
    await CardEmulation.clearPaymentRequest().catch(() => undefined);
    await CardEmulation.clearPaymentIntent().catch(() => undefined);
  }, []);

  const handleConfirmed = useCallback(
    async (details: ConfirmedPaymentDetails) => {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.replace({
        pathname: "/payment-success",
        params: buildSuccessRouteParams(details, "receiver", {
          fromLabel: payerEnsName,
          toLabel: verifiedEnsName,
        }),
      });
    },
    [payerEnsName, router, verifiedEnsName],
  );

  const handleWatchFailure = useCallback(
    async (
      status: Extract<PaymentTrackingStatus, "failed" | "connection_lost">,
      message: string,
    ) => {
      setReceiveState(status === "connection_lost" ? "connection_lost" : "error");
      setStatusLabel(
        getReceiverStatusLabel(
          status === "connection_lost" ? "chain_connection_lost" : "payment_failed",
        ),
      );
      console.error("Receive watch failed:", message);
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    },
    [],
  );

  const startTrackingIntent = useCallback(
    async (intent: PaymentIntent) => {
      if (intent.requestId !== requestIdRef.current) {
        return;
      }

      const trackedIntent = buildIncomingTrackedIntent(intent);
      if (
        trackedIntent.chainId !== CHAIN_ID ||
        !smartWalletAddress ||
        !receivingTokenAddress ||
        trackedIntent.to.toLowerCase() !== smartWalletAddress.toLowerCase() ||
        !isSupportedPaymentToken(trackedIntent.tokenAddress) ||
        trackedIntent.tokenAddress.toLowerCase() !== receivingTokenAddress.toLowerCase()
      ) {
        throw new Error("Unsupported payment intent");
      }

      const payerStatus = await getEnsClaimStatus(trackedIntent.from);
      setPayerEnsName(payerStatus.fullName);
      setReceivingTokenAddress(trackedIntent.tokenAddress);
      playNfcCompleteSound().catch(console.error);

      stopTracking();
      setReceiveState("watching_chain");
      setStatusLabel(getReceiverStatusLabel("watching_chain"));
      await stopPublishing();
      setSafeToRemove(true);

      stopWatcherRef.current = await watchIncomingPayment(trackedIntent, {
        onConfirmed: (details) => {
          handleConfirmed(details).catch(console.error);
        },
        onFailed: (status, reason) => {
          handleWatchFailure(status, reason).catch(console.error);
        },
      });
    },
    [handleConfirmed, handleWatchFailure, receivingTokenAddress, smartWalletAddress, stopPublishing, stopTracking],
  );

  useEffect(() => {
    let cancelled = false;

    const publish = async () => {
      if (!requestPayload) {
        if (walletStatus !== "ready") {
          setReceiveState(walletStatus === "error" ? "error" : "preparing");
          setStatusLabel(
            getReceiverStatusLabel(
              walletStatus === "error" ? "wallet_setup_failed" : "waiting_for_wallet",
            ),
          );
          setSafeToRemove(false);
        } else if (!ensCheckComplete) {
          setReceiveState("verifying_ens");
          setStatusLabel(getReceiverStatusLabel("verify_ens_claim"));
          setSafeToRemove(false);
        } else if (smartWalletAddress && !verifiedEnsName) {
          setReceiveState("error");
          setStatusLabel(getReceiverStatusLabel("claim_ens"));
          setSafeToRemove(false);
        } else {
          setReceiveState("preparing");
          setStatusLabel(getReceiverStatusLabel("waiting"));
          setSafeToRemove(false);
        }
        return;
      }

      try {
        await CardEmulation.clearPaymentIntent();
        await CardEmulation.setPaymentRequest(buildPublishedPaymentRequestMessage(requestPayload));
        await CardEmulation.setReady(true);
        await CardEmulation.startListening();

        if (!cancelled) {
          setReceiveState("ready");
          setStatusLabel(getReceiverStatusLabel("ready_to_receive"));
          setSafeToRemove(false);
        }
      } catch (publishError) {
        console.error("Publish failed:", publishError);
        if (!cancelled) {
          setReceiveState("error");
          setStatusLabel(getReceiverStatusLabel("publish_failed"));
          setSafeToRemove(true);
        }
      }
    };

    publish();

    return () => {
      cancelled = true;
      stopTracking();
      CardEmulation.stopListening().catch(() => undefined);
      stopPublishing().catch(() => undefined);
    };
  }, [
    ensCheckComplete,
    requestPayload,
    smartWalletAddress,
    stopPublishing,
    stopTracking,
    verifiedEnsName,
    walletStatus,
  ]);

  useEffect(() => {
    const subscription = CardEmulationEvents.onStateChanged((state) => {
      if (state.errorMessage) {
        setReceiveState("error");
        setStatusLabel(getReceiverStatusLabel("publish_failed"));
        setSafeToRemove(true);
        return;
      }

      if (state.lastCommand === "GET_PAYMENT_REQUEST") {
        setStatusLabel(getReceiverStatusLabel("pairing_payment"));
      }

      if (state.hasPaymentIntent && !handlingIntentRef.current) {
        handlingIntentRef.current = true;

        CardEmulation.getPaymentIntent()
          .then((payload) => {
            if (!payload) {
              return;
            }

            const message = parseProtocolMessage(payload);
            if (!message || message.kind !== "PAYMENT_INTENT") {
              throw new Error("Invalid payment intent");
            }

            return startTrackingIntent({
              sessionId: message.sessionId,
              requestId: message.requestId,
              payerAddress: message.payerAddress,
              receiverAddress: message.receiverAddress,
              amount: message.amount,
              tokenAddress: message.tokenAddress,
              chainId: message.chainId,
              createdAt: message.createdAt,
              txHash: message.txHash,
            });
          })
          .then(() => CardEmulation.clearPaymentIntent())
          .catch((error) => {
            console.error("Failed to process payment intent:", error);
            setReceiveState("error");
            setStatusLabel(getReceiverStatusLabel("payment_failed"));
            setSafeToRemove(true);
          })
          .finally(() => {
            handlingIntentRef.current = false;
          });
      }
    });

    return () => {
      subscription?.remove();
    };
  }, [startTrackingIntent]);

  const handleCancel = async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    stopTracking();
    await stopPublishing();
    router.back();
  };

  const handleOpenEnsOnboarding = async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    stopTracking();
    await stopPublishing();
    router.push("/ens-onboarding" as never);
  };

  const handleRetryProvisioning = async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    retryProvisioning();
  };

  const routeLabel = useMemo(() => {
    if (!payerEnsName || !verifiedEnsName) {
      return null;
    }

    return `${payerEnsName} -> ${verifiedEnsName}`;
  }, [payerEnsName, verifiedEnsName]);

  return (
    <View style={styles.container}>
      <View style={styles.mainContent}>
        <View style={styles.contentStack}>
          <View style={styles.amountBoxShadow}>
            <View style={styles.amountBox}>
              <Text style={styles.amountLabel}>SETTLEMENT TOKEN</Text>
              <Text style={styles.tokenText}>
                {getTokenSymbolByAddress(receivingTokenAddress, "LOADING")}
              </Text>
              <Text style={styles.tokenHint}>RECEIVING IN THIS TOKEN</Text>
            </View>
          </View>

          <View style={styles.nfcCardShadow}>
            <View style={styles.nfcCard}>
              <DotsPattern />
              <View style={styles.nfcCardContent}>
                <View
                  style={[
                    styles.nfcCircle,
                    receiveState === "error" || receiveState === "connection_lost"
                      ? styles.errorCircle
                      : receiveState === "watching_chain"
                        ? styles.warningCircle
                        : null,
                  ]}
                >
                  {receiveState === "preparing" || receiveState === "watching_chain" ? (
                    <ActivityIndicator size="large" color={COLORS.textInverted} />
                  ) : receiveState === "error" || receiveState === "connection_lost" ? (
                    <Text style={styles.nfcIconText}>✕</Text>
                  ) : (
                    <NfcIcon size={48} color={COLORS.textInverted} />
                  )}
                </View>
                <AnimatedWaveBars isAnimating={receiveState === "ready"} />
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
            <Pressable onPress={handleRetryProvisioning} style={styles.warningButton}>
              <Text style={styles.footerButtonText}>RETRY WALLET SETUP</Text>
            </Pressable>
          </View>
        ) : null}

        {walletStatus === "ready" && !verifiedEnsName ? (
          <View style={styles.footerButtonShadow}>
            <Pressable onPress={handleOpenEnsOnboarding} style={styles.warningButton}>
              <Text style={styles.footerButtonText}>OPEN ENS ONBOARDING</Text>
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
  amountLabel: {
    fontSize: 12,
    fontWeight: "900",
    letterSpacing: 2,
    color: COLORS.textMuted,
    marginBottom: 6,
    textAlign: "center",
  },
  tokenText: {
    fontSize: 24,
    fontWeight: "900",
    color: COLORS.textPrimary,
    textAlign: "center",
  },
  tokenHint: {
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1,
    color: COLORS.textMuted,
    marginTop: 6,
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
  warningButton: {
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
