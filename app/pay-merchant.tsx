import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ActivityIndicator,
  Animated,
  Easing,
} from "react-native";
import { useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import { usePrivy } from "@privy-io/expo";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { formatUnits, type Address } from "viem";
import { COLORS, BORDER_THICK } from "../constants/theme";
import { getEnsClaimStatus } from "../lib/ens/service";
import { useOperationalWallet } from "../lib/wallet";
import { playNfcCompleteSound } from "../lib/audio/feedback";
import { NfcReader, NfcReaderEvents, type MerchantPaymentRequest } from "../lib/nfc/reader";
import {
  CHAIN_ID,
  TOKEN_ADDRESS,
  TOKEN_DECIMALS,
  USDT_ADDRESS,
  VERIFIER_ADDRESS,
  getTokenSymbolByAddress,
  isSupportedPaymentToken,
} from "../lib/blockchain/contracts";
import {
  createPaymentAuthorizationTypedData,
  type PaymentAuthorization,
} from "../lib/blockchain/eip712-signing";
import { getPaymentTrackingPollingClient } from "../lib/payments/payment-tracking-client";
import {
  buildSuccessRouteParams,
  watchIncomingPayment,
  type ConfirmedPaymentDetails,
  type TrackedPaymentIntent,
} from "../lib/payments/tracking";
import { buildMerchantAuthorizationMessage } from "../lib/payments/merchant-session";

type PayMerchantState =
  | "idle"
  | "scanning"
  | "request_received"
  | "checking_allowance"
  | "approving"
  | "signing"
  | "sending"
  | "watching_chain"
  | "error";

type PayMerchantError =
  | "wallet_not_ready"
  | "wrong_chain"
  | "wrong_verifier"
  | "unsupported_token"
  | "expired_request"
  | "insufficient_balance"
  | "approval_failed"
  | "signing_failed"
  | "send_failed"
  | "payment_failed"
  | "chain_connection_lost"
  | "reader_failed";

function getStatusLabel(state: PayMerchantState, error?: PayMerchantError): string {
  switch (state) {
    case "idle":
      return "WAITING";
    case "scanning":
      return "READY TO TAP";
    case "request_received":
      return "REQUEST RECEIVED";
    case "checking_allowance":
      return "CHECKING ALLOWANCE";
    case "approving":
      return "APPROVING TOKEN";
    case "signing":
      return "SIGNING";
    case "sending":
      return "SENDING AUTHORIZATION";
    case "watching_chain":
      return "CONFIRMING PAYMENT";
    case "error":
      return `ERROR: ${error?.toUpperCase().replace(/_/g, " ") ?? "UNKNOWN"}`;
  }
}

function buildMerchantTrackedIntent(
  request: MerchantPaymentRequest,
  customerAddress: Address,
): TrackedPaymentIntent {
  return {
    sessionId: request.sessionId,
    requestId: request.requestId,
    from: customerAddress,
    to: request.merchantAddress,
    amount: request.amount,
    tokenAddress: request.tokenAddress,
    chainId: request.chainId,
    createdAt: Date.now(),
  };
}

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

function shortAddress(address?: string | null): string {
  if (!address) {
    return "UNKNOWN";
  }

  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

const SHADOW_OFFSET = { width: 8, height: 8 };

export default function PayMerchantScreen() {
  const router = useRouter();
  const { user, isReady: privyReady } = usePrivy();
  const {
    smartWalletAddress,
    status: walletStatus,
    isReady: walletReady,
    signTypedData,
    checkAllowance,
    ensureAllowance,
    refreshBalances,
    error: walletError,
  } = useOperationalWallet();

  const [screenState, setScreenState] = useState<PayMerchantState>("idle");
  const [errorType, setErrorType] = useState<PayMerchantError | undefined>();
  const [merchantRequest, setMerchantRequest] = useState<MerchantPaymentRequest | null>(null);
  const [readerCycle, setReaderCycle] = useState(0);
  const [payerEnsName, setPayerEnsName] = useState<string | null>(null);
  const [resolvedMerchantEnsName, setResolvedMerchantEnsName] = useState<string | null>(null);

  const isProcessingRef = useRef(false);
  const payerEnsNameRef = useRef<string | null>(null);
  const resolvedMerchantEnsNameRef = useRef<string | null>(null);
  const stopWatcherRef = useRef<(() => void) | null>(null);

  // Redirect to login if not authenticated
  useEffect(() => {
    if (privyReady && !user) {
      router.replace("/login");
    }
  }, [privyReady, router, user]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopWatcherRef.current?.();
      stopWatcherRef.current = null;
      NfcReader.stopReader().catch(() => undefined);
      NfcReader.clearScanSession().catch(() => undefined);
    };
  }, []);

  useEffect(() => {
    if (!smartWalletAddress) {
      setPayerEnsName(null);
      return;
    }

    getEnsClaimStatus(smartWalletAddress)
      .then((status) => {
        setPayerEnsName(status.fullName);
      })
      .catch((error) => {
        console.warn("Failed to load payer ENS:", error);
        setPayerEnsName(null);
      });
  }, [smartWalletAddress]);

  useEffect(() => {
    payerEnsNameRef.current = payerEnsName;
  }, [payerEnsName]);

  useEffect(() => {
    resolvedMerchantEnsNameRef.current = resolvedMerchantEnsName;
  }, [resolvedMerchantEnsName]);

  const canScan = walletReady && !!smartWalletAddress;

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
        params: buildSuccessRouteParams(details, "payer", {
          fromLabel: payerEnsNameRef.current,
          toLabel: resolvedMerchantEnsNameRef.current,
        }),
      });
    },
    [refreshBalances, router],
  );

  const handleWatchFailure = useCallback(
    async (status: "failed" | "connection_lost", message: string) => {
      setScreenState("error");
      setErrorType(status === "connection_lost" ? "chain_connection_lost" : "payment_failed");
      console.error("Merchant payment watch failed:", message);
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    },
    [],
  );

  const authorizePayment = useCallback(async (request: MerchantPaymentRequest) => {
    if (!smartWalletAddress || !walletReady) {
      return;
    }

    try {
      const balances = await refreshBalances();
      const availableBalance =
        request.tokenAddress.toLowerCase() === TOKEN_ADDRESS.toLowerCase()
          ? balances?.usdcBalance
          : request.tokenAddress.toLowerCase() === USDT_ADDRESS.toLowerCase()
            ? balances?.usdtBalance
            : null;

      if (availableBalance == null || availableBalance < request.amount) {
        setScreenState("error");
        setErrorType("insufficient_balance");
        await NfcReader.stopReader();
        return;
      }

      // Check allowance
      setScreenState("checking_allowance");

      // The verifier contract needs approval to transfer tokens
      const allowance = await checkAllowance(
        request.tokenAddress,
        smartWalletAddress,
        VERIFIER_ADDRESS,
      );

      if (allowance < request.amount) {
        setScreenState("approving");
        const approveTx = await ensureAllowance(
          request.tokenAddress,
          VERIFIER_ADDRESS,
          request.amount,
        );
        if (approveTx === null && allowance < request.amount) {
          setScreenState("error");
          setErrorType("approval_failed");
          await NfcReader.stopReader();
          return;
        }

        if (approveTx) {
          const receipt = await getPaymentTrackingPollingClient().waitForTransactionReceipt({
            hash: approveTx,
          });
          if (receipt.status !== "success") {
            setScreenState("error");
            setErrorType("approval_failed");
            await NfcReader.stopReader();
            return;
          }
        }
      }

      // Sign the authorization
      setScreenState("signing");

      const authorization: PaymentAuthorization = {
        token: request.tokenAddress,
        merchant: request.merchantAddress,
        customer: smartWalletAddress,
        amount: request.amount,
        nonce: request.nonce,
        deadline: BigInt(request.deadline),
      };

      const sig = await signTypedData(createPaymentAuthorizationTypedData(authorization));

      // Send authorization to merchant via NFC
      setScreenState("sending");

      const authMessage = buildMerchantAuthorizationMessage(
        request.sessionId,
        request.requestId,
        smartWalletAddress,
        sig,
      );

      await NfcReader.sendMerchantAuthorization(authMessage);
      await NfcReader.stopReader();
      await NfcReader.clearScanSession();
      await playNfcCompleteSound();

      const trackedIntent = buildMerchantTrackedIntent(request, smartWalletAddress);
      setScreenState("watching_chain");

      stopTracking();
      stopWatcherRef.current = await watchIncomingPayment(trackedIntent, {
        onConfirmed: (details) => {
          handleConfirmed(details).catch(console.error);
        },
        onFailed: (status, reason) => {
          handleWatchFailure(status, reason).catch(console.error);
        },
      });
    } catch (err) {
      console.error("Payment authorization failed:", err);
      const errorMessage = err instanceof Error ? err.message : "Unknown error";

      if (errorMessage.includes("sign")) {
        setErrorType("signing_failed");
      } else {
        setErrorType("send_failed");
      }
      setScreenState("error");
      await NfcReader.stopReader().catch(() => undefined);
    }
  }, [
    refreshBalances,
    smartWalletAddress,
    walletReady,
    checkAllowance,
    ensureAllowance,
    signTypedData,
    handleConfirmed,
    handleWatchFailure,
    stopTracking,
  ]);

  const handleMerchantRequest = useCallback(
    async (request: MerchantPaymentRequest) => {
      if (isProcessingRef.current) {
        return;
      }

      isProcessingRef.current = true;

      try {
        if (request.chainId !== CHAIN_ID) {
          setScreenState("error");
          setErrorType("wrong_chain");
          await NfcReader.stopReader();
          return;
        }

        if (request.verifyingContract.toLowerCase() !== VERIFIER_ADDRESS.toLowerCase()) {
          setScreenState("error");
          setErrorType("wrong_verifier");
          await NfcReader.stopReader();
          return;
        }

        if (!isSupportedPaymentToken(request.tokenAddress)) {
          setScreenState("error");
          setErrorType("unsupported_token");
          await NfcReader.stopReader();
          return;
        }

        const now = Math.floor(Date.now() / 1000);
        if (request.deadline <= now) {
          setScreenState("error");
          setErrorType("expired_request");
          await NfcReader.stopReader();
          return;
        }

        setMerchantRequest(request);
        setResolvedMerchantEnsName(request.merchantName ?? null);
        setScreenState("request_received");
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        if (!request.merchantName) {
          getEnsClaimStatus(request.merchantAddress)
            .then((status) => {
              setResolvedMerchantEnsName(status.fullName);
            })
            .catch((error) => {
              console.warn("Failed to load merchant ENS:", error);
              setResolvedMerchantEnsName(null);
            });
        }
        await authorizePayment(request);
      } finally {
        isProcessingRef.current = false;
      }
    },
    [authorizePayment],
  );

  // Set up NFC reader
  useEffect(() => {
    if (!canScan) {
      setScreenState(walletStatus === "error" ? "error" : "idle");
      setErrorType(walletStatus === "error" ? "wallet_not_ready" : undefined);
      return;
    }

    setScreenState("scanning");
    setErrorType(undefined);
    setMerchantRequest(null);
    setResolvedMerchantEnsName(null);

    NfcReader.clearScanSession()
      .then(() => NfcReader.setScanSession(""))
      .then(() => NfcReader.startReader())
      .catch((readerError) => {
        console.error("Reader setup failed:", readerError);
        setScreenState("error");
        setErrorType("reader_failed");
      });

    const subscription = NfcReaderEvents.onMerchantPaymentRequest((request) => {
      handleMerchantRequest(request).catch(console.error);
    });

    const errorSubscription = NfcReaderEvents.onError((message) => {
      console.error("Reader error:", message);
      setScreenState("error");
      setErrorType("reader_failed");
    });

    return () => {
      subscription?.remove();
      errorSubscription?.remove();
      NfcReader.stopReader().catch(() => undefined);
    };
  }, [canScan, handleMerchantRequest, readerCycle, walletStatus]);

  const handleCancel = useCallback(async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    await NfcReader.stopReader();
    router.back();
  }, [router]);

  const handleReset = useCallback(async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    await NfcReader.stopReader();
    await NfcReader.clearScanSession();
    stopTracking();
    setScreenState("idle");
    setErrorType(undefined);
    setMerchantRequest(null);
    setResolvedMerchantEnsName(null);
    setReaderCycle((current) => current + 1);
  }, [stopTracking]);

  const displayAmount = useMemo(() => {
    if (merchantRequest) {
      return formatUnits(merchantRequest.amount, TOKEN_DECIMALS);
    }
    return "—";
  }, [merchantRequest]);

  const tokenSymbol = useMemo(() => {
    return getTokenSymbolByAddress(merchantRequest?.tokenAddress, "TOKEN");
  }, [merchantRequest]);

  const merchantDisplay = useMemo(() => {
    if (!merchantRequest) return null;
    const name = resolvedMerchantEnsName ?? merchantRequest.merchantName;
    const address = merchantRequest.merchantAddress;
    return name || `${address.slice(0, 6)}...${address.slice(-4)}`;
  }, [merchantRequest, resolvedMerchantEnsName]);

  const backgroundColor = COLORS.primaryBlue;

  return (
    <View style={[styles.container, { backgroundColor }]}>
      <View style={styles.mainContent}>
        {/* Amount Display */}
        <View style={styles.amountBoxShadow}>
          <View style={styles.amountBox}>
            <Text style={styles.amountLabel}>PAYMENT AMOUNT ({tokenSymbol})</Text>
            <Text style={styles.amountText}>{displayAmount}</Text>
            {merchantRequest && (
              <Text style={styles.tokenHint}>
                {formatUnits(merchantRequest.amount, TOKEN_DECIMALS)} {tokenSymbol}
              </Text>
            )}
          </View>
        </View>

        {/* Main Status Card */}
        <View style={styles.statusCardShadow}>
          <View style={styles.statusCard}>
            {screenState === "scanning" && (
              <>
                <DotsPattern />
                <View style={styles.nfcCardContent}>
                  <View style={styles.nfcCircle}>
                    <NfcIcon size={48} color={COLORS.textInverted} />
                  </View>
                  <AnimatedWaveBars isAnimating={true} />
                  <Text style={styles.statusText}>TAP TO MERCHANT DEVICE</Text>
                </View>
              </>
            )}

            {screenState === "request_received" && merchantRequest && (
              <>
                <DotsPattern />
                <View style={styles.nfcCardContent}>
                  <View style={[styles.nfcCircle, styles.warningCircle]}>
                    <ActivityIndicator size="large" color={COLORS.textInverted} />
                  </View>
                  <Text style={styles.merchantLabel}>MERCHANT</Text>
                  <Text style={styles.merchantText}>{merchantDisplay}</Text>
                  <Text style={styles.largeAmount}>
                    {formatUnits(merchantRequest.amount, TOKEN_DECIMALS)} {tokenSymbol}
                  </Text>
                </View>
              </>
            )}

            {(screenState === "checking_allowance" || screenState === "approving") && (
              <>
                <DotsPattern />
                <View style={styles.nfcCardContent}>
                  <View style={[styles.nfcCircle, styles.warningCircle]}>
                    <ActivityIndicator size="large" color={COLORS.textInverted} />
                  </View>
                  <Text style={styles.statusText}>
                    {screenState === "approving" ? "APPROVING TOKEN..." : "CHECKING ALLOWANCE..."}
                  </Text>
                </View>
              </>
            )}

            {screenState === "signing" && (
              <>
                <DotsPattern />
                <View style={styles.nfcCardContent}>
                  <View style={[styles.nfcCircle, styles.warningCircle]}>
                    <ActivityIndicator size="large" color={COLORS.textInverted} />
                  </View>
                  <Text style={styles.statusText}>SIGNING AUTHORIZATION...</Text>
                </View>
              </>
            )}

            {screenState === "sending" && (
              <>
                <DotsPattern />
                <View style={styles.nfcCardContent}>
                  <View style={[styles.nfcCircle, styles.warningCircle]}>
                    <ActivityIndicator size="large" color={COLORS.textInverted} />
                  </View>
                  <Text style={styles.statusText}>SENDING AUTHORIZATION...</Text>
                </View>
              </>
            )}

            {screenState === "watching_chain" && (
              <>
                <DotsPattern />
                <View style={styles.nfcCardContent}>
                  <View style={[styles.nfcCircle, styles.warningCircle]}>
                    <ActivityIndicator size="large" color={COLORS.textInverted} />
                  </View>
                  <Text style={styles.statusText}>CONFIRMING PAYMENT...</Text>
                  <Text style={styles.routeText}>
                    {payerEnsName ?? "You"} → {merchantDisplay ?? "merchant"}
                  </Text>
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

            {(screenState === "idle" || !walletReady) && (
              <>
                <DotsPattern />
                <View style={styles.nfcCardContent}>
                  <View style={[styles.nfcCircle, walletStatus === "error" ? styles.errorCircle : null]}>
                    {walletStatus === "error" ? (
                      <Text style={styles.nfcIconText}>✕</Text>
                    ) : (
                      <ActivityIndicator size="large" color={COLORS.textInverted} />
                    )}
                  </View>
                  <Text style={styles.statusText}>
                    {!walletReady
                      ? walletStatus === "error"
                        ? "WALLET SETUP FAILED"
                        : "WAITING FOR WALLET"
                      : "INITIALIZING..."}
                  </Text>
                  {walletError && <Text style={styles.errorText}>{walletError}</Text>}
                </View>
              </>
            )}
          </View>
        </View>

        {/* Customer Info */}
        {smartWalletAddress && (
          <View style={styles.infoBoxShadow}>
            <View style={styles.infoBox}>
              <Text style={styles.infoLabel}>PAYING USER</Text>
              <Text style={styles.infoText}>{payerEnsName ?? shortAddress(smartWalletAddress)}</Text>
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

        {/* Action Buttons based on state */}
        {(screenState === "scanning" || screenState === "idle") && (
          <View style={styles.footerButtonShadow}>
            <Pressable onPress={handleCancel} style={styles.footerButton}>
              <Text style={styles.footerButtonText}>CANCEL</Text>
            </Pressable>
          </View>
        )}

        {screenState === "watching_chain" && (
          <View style={styles.footerButtonShadow}>
            <View style={styles.footerButton}>
              <Text style={styles.footerButtonText}>WAITING FOR CONFIRMATION</Text>
            </View>
          </View>
        )}

        {screenState === "error" && (
          <View style={styles.footerButtonShadow}>
            <Pressable onPress={handleReset} style={styles.footerButton}>
              <Text style={styles.footerButtonText}>TRY AGAIN</Text>
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
  routeText: {
    fontSize: 14,
    fontWeight: "900",
    color: COLORS.textPrimary,
    textAlign: "center",
    paddingHorizontal: 24,
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
  merchantLabel: {
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 2,
    color: COLORS.textMuted,
  },
  merchantText: {
    fontSize: 16,
    fontWeight: "700",
    color: COLORS.textPrimary,
    marginBottom: 8,
  },
  largeAmount: {
    fontSize: 32,
    fontWeight: "900",
    color: COLORS.textPrimary,
  },
  errorText: {
    fontSize: 16,
    fontWeight: "900",
    color: COLORS.error,
    textAlign: "center",
  },
  statusText: {
    fontSize: 18,
    fontWeight: "900",
    color: COLORS.textPrimary,
    textAlign: "center",
    letterSpacing: 1,
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
  },
  infoSubtext: {
    fontSize: 12,
    fontWeight: "700",
    color: COLORS.textMuted,
    marginTop: 4,
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
});
