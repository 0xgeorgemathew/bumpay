import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ActivityIndicator,
} from "react-native";
import { useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import { usePrivy } from "@privy-io/expo";
import { formatUnits, type Address } from "viem";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { COLORS, BORDER_THICK } from "../constants/theme";
import { useOperationalWallet } from "../lib/wallet";
import { playNfcCompleteSound } from "../lib/audio/feedback";
import {
  NfcReader,
  NfcReaderEvents,
  type MerchantBitGoPaymentRequest,
} from "../lib/nfc/reader";
import {
  BITGO_MERCHANT_TOKEN,
  CHAIN_ID,
  TOKEN_DECIMALS,
  getBitGoMerchantTokenSymbolByAddress,
  isSupportedBitGoMerchantToken,
} from "../lib/blockchain/contracts";
import {
  buildSuccessRouteParams,
  watchSubmittedPayment,
  type TrackedPaymentIntent,
} from "../lib/payments/tracking";
import { reportMerchantBitGoCustomerTransaction } from "../lib/bitgo";

type PayMerchantBitGoState =
  | "idle"
  | "scanning"
  | "request_received"
  | "sending"
  | "watching_chain"
  | "success"
  | "error";

type PayMerchantBitGoError =
  | "wallet_not_ready"
  | "wrong_chain"
  | "unsupported_token"
  | "expired_request"
  | "insufficient_balance"
  | "send_failed"
  | "reader_failed";

function getStatusLabel(state: PayMerchantBitGoState, error?: PayMerchantBitGoError) {
  switch (state) {
    case "idle":
      return "WAITING";
    case "scanning":
      return "READY TO TAP";
    case "request_received":
      return "REQUEST RECEIVED";
    case "sending":
      return "SENDING PAYMENT";
    case "watching_chain":
      return "WATCHING CHAIN";
    case "success":
      return "PAYMENT SENT";
    case "error":
      return `ERROR: ${error?.toUpperCase().replace(/_/g, " ") ?? "UNKNOWN"}`;
  }
}

function NfcIcon({ size = 48, color = "#fff" }: { size?: number; color?: string }) {
  return <MaterialCommunityIcons name="nfc" size={size} color={color} />;
}

function buildBitGoPaymentIntent(
  request: MerchantBitGoPaymentRequest,
  payerAddress: Address,
): TrackedPaymentIntent {
  return {
    sessionId: request.sessionId,
    requestId: request.requestId,
    from: payerAddress,
    to: request.receiveAddress,
    amount: request.amount,
    tokenAddress: request.tokenAddress,
    chainId: request.chainId,
    createdAt: Date.now(),
  };
}

const SHADOW_OFFSET = { width: 8, height: 8 };

async function resetBitGoReaderSession() {
  await NfcReader.stopReader().catch(() => undefined);
  await NfcReader.clearScanSession().catch(() => undefined);
}

function getAvailableBalance(
  readTokenBalance: ReturnType<typeof useOperationalWallet>["readTokenBalance"],
  tokenAddress: Address,
) {
  return readTokenBalance(tokenAddress);
}

export default function PayMerchantBitGoScreen() {
  const router = useRouter();
  const { user, isReady: privyReady } = usePrivy();
  const {
    smartWalletAddress,
    status: walletStatus,
    isReady: walletReady,
    readTokenBalance,
    sendTokenTransfer,
  } = useOperationalWallet();

  const [screenState, setScreenState] = useState<PayMerchantBitGoState>("idle");
  const [errorType, setErrorType] = useState<PayMerchantBitGoError | undefined>();
  const [merchantRequest, setMerchantRequest] = useState<MerchantBitGoPaymentRequest | null>(null);
  const [readerCycle, setReaderCycle] = useState(0);
  const isProcessingRef = useRef(false);
  const stopWatcherRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    if (privyReady && !user) {
      router.replace("/login");
    }
  }, [privyReady, router, user]);

  useEffect(() => {
    return () => {
      stopWatcherRef.current?.();
      resetBitGoReaderSession().catch(() => undefined);
    };
  }, []);

  const canScan = walletReady && !!smartWalletAddress;

  useEffect(() => {
    if (!canScan) {
      setScreenState(walletStatus === "error" ? "error" : "idle");
      setErrorType(walletStatus === "error" ? "wallet_not_ready" : undefined);
      return;
    }

    setScreenState("scanning");
    setErrorType(undefined);
    setMerchantRequest(null);

    NfcReader.clearScanSession()
      .then(() => NfcReader.setScanSession(""))
      .then(() => NfcReader.startReader())
      .catch((readerError) => {
        console.warn("Reader setup failed:", readerError);
        setScreenState("error");
        setErrorType("reader_failed");
      });

    const subscription = NfcReaderEvents.onMerchantBitGoPaymentRequest((request) => {
      handleMerchantRequest(request).catch((error) => {
        console.warn("Failed to handle BitGo merchant request:", error);
      });
    });

    const errorSubscription = NfcReaderEvents.onError((message) => {
      console.warn("Reader error:", message);
      setScreenState("error");
      setErrorType("reader_failed");
    });

    return () => {
      subscription?.remove();
      errorSubscription?.remove();
      NfcReader.stopReader().catch(() => undefined);
    };
  }, [canScan, readerCycle, walletStatus]);

  const handleMerchantRequest = useCallback(async (request: MerchantBitGoPaymentRequest) => {
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

      if (!isSupportedBitGoMerchantToken(request.tokenAddress)) {
        setScreenState("error");
        setErrorType("unsupported_token");
        await NfcReader.stopReader();
        return;
      }

      if (request.expiresAt <= Math.floor(Date.now() / 1000)) {
        setScreenState("error");
        setErrorType("expired_request");
        await NfcReader.stopReader();
        return;
      }

      setMerchantRequest(request);
      setScreenState("request_received");
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } finally {
      isProcessingRef.current = false;
    }
  }, []);

  const handleConfirmPayment = useCallback(async () => {
    if (!merchantRequest || !smartWalletAddress || !walletReady) {
      return;
    }

    isProcessingRef.current = true;
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);

    try {
      const availableBalance = await getAvailableBalance(
        readTokenBalance,
        merchantRequest.tokenAddress,
      );

      if (availableBalance == null || availableBalance < merchantRequest.amount) {
        setScreenState("error");
        setErrorType("insufficient_balance");
        await NfcReader.stopReader();
        return;
      }

      setScreenState("sending");
      const txHash = await sendTokenTransfer(
        merchantRequest.tokenAddress,
        merchantRequest.receiveAddress,
        merchantRequest.amount,
      );

      if (!txHash) {
        throw new Error("Payment transaction was not submitted");
      }

      await reportMerchantBitGoCustomerTransaction({
        checkoutId: merchantRequest.checkoutId,
        txHash,
        customerAddress: smartWalletAddress,
      });

      await playNfcCompleteSound();
      setScreenState("watching_chain");

      const intent = buildBitGoPaymentIntent(merchantRequest, smartWalletAddress);
      stopWatcherRef.current = watchSubmittedPayment(intent, txHash, {
        onConfirmed: (details) => {
          setScreenState("success");
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
          router.replace({
            pathname: "/payment-success",
            params: buildSuccessRouteParams(details, "payer", {
              toLabel: merchantRequest.merchantName ?? "BITGO MERCHANT",
            }),
          });
        },
        onFailed: (status, message) => {
          console.warn("BitGo merchant payment watch failed:", status, message);
          setScreenState("error");
          setErrorType("send_failed");
        },
      });
    } catch (err) {
      console.warn("Merchant BitGo payment failed:", err);
      setScreenState("error");
      setErrorType("send_failed");
    } finally {
      isProcessingRef.current = false;
    }
  }, [merchantRequest, readTokenBalance, router, sendTokenTransfer, smartWalletAddress, walletReady]);

  const handleDeclinePayment = useCallback(async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    stopWatcherRef.current?.();
    stopWatcherRef.current = null;
    await resetBitGoReaderSession();
    setErrorType(undefined);
    setMerchantRequest(null);
    setScreenState("idle");
    setReaderCycle((current) => current + 1);
  }, []);

  const handleCancel = useCallback(async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    await resetBitGoReaderSession();
    router.back();
  }, [router]);

  const displayAmount = useMemo(() => {
    if (!merchantRequest) {
      return "0.00";
    }

    return formatUnits(merchantRequest.amount, TOKEN_DECIMALS);
  }, [merchantRequest]);

  const tokenSymbol = useMemo(() => {
    return getBitGoMerchantTokenSymbolByAddress(
      merchantRequest?.tokenAddress,
      BITGO_MERCHANT_TOKEN.symbol,
    );
  }, [merchantRequest?.tokenAddress]);

  const merchantDisplay = useMemo(() => {
    if (!merchantRequest) {
      return null;
    }

    return merchantRequest.merchantName ?? `${merchantRequest.receiveAddress.slice(0, 6)}...${merchantRequest.receiveAddress.slice(-4)}`;
  }, [merchantRequest]);

  return (
    <View style={styles.container}>
      <View style={styles.mainContent}>
        <View style={styles.amountBoxShadow}>
          <View style={styles.amountBox}>
            <Text style={styles.amountLabel}>BITGO MERCHANT</Text>
            <Text style={styles.amountText}>
              {displayAmount} {tokenSymbol}
            </Text>
          </View>
        </View>

        <View style={styles.statusCardShadow}>
          <View style={styles.statusCard}>
            <Text style={styles.statusLabel}>{getStatusLabel(screenState, errorType)}</Text>

            {(screenState === "idle" || screenState === "scanning") && (
              <View style={styles.visualContainer}>
                <View style={styles.nfcBadge}>
                  <NfcIcon size={50} color={COLORS.textPrimary} />
                </View>
                <Text style={styles.statusText}>Tap the merchant device to receive a private checkout.</Text>
              </View>
            )}

            {screenState === "request_received" && merchantRequest && (
              <View style={styles.requestCard}>
                <Text style={styles.detailLabel}>MERCHANT</Text>
                <Text style={styles.detailValue}>{merchantDisplay}</Text>
                <Text style={styles.detailLabel}>AMOUNT</Text>
                <Text style={styles.detailValue}>
                  {formatUnits(merchantRequest.amount, TOKEN_DECIMALS)} {tokenSymbol}
                </Text>
                <Text style={styles.detailLabel}>DESTINATION</Text>
                <Text style={styles.helperText}>
                  {merchantRequest.receiveAddress.slice(0, 10)}...{merchantRequest.receiveAddress.slice(-6)}
                </Text>
              </View>
            )}

            {(screenState === "sending" || screenState === "watching_chain") && (
              <View style={styles.visualContainer}>
                <ActivityIndicator size="small" color={COLORS.textPrimary} />
                <Text style={styles.statusText}>
                  {screenState === "sending"
                    ? "Sending payment to the one-time BitGo address."
                    : "Waiting for onchain confirmation."}
                </Text>
              </View>
            )}

            {screenState === "error" && (
              <Text style={styles.errorText}>
                {errorType === "wallet_not_ready"
                  ? "Wallet not ready."
                  : errorType === "wrong_chain"
                    ? "Merchant checkout is on an unsupported chain."
                    : errorType === "unsupported_token"
                      ? "Merchant checkout uses an unsupported token."
                      : errorType === "expired_request"
                        ? "This merchant checkout has expired."
                        : errorType === "insufficient_balance"
                          ? `Not enough ${BITGO_MERCHANT_TOKEN.symbol}.`
                          : errorType === "reader_failed"
                            ? "NFC reader failed."
                            : "Merchant BitGo payment failed."}
              </Text>
            )}
          </View>
        </View>
      </View>

      <View style={styles.footer}>
        {screenState === "request_received" ? (
          <>
            <View style={styles.buttonShadow}>
              <Pressable onPress={handleConfirmPayment} style={styles.primaryButton}>
                <Text style={styles.primaryButtonText}>PAY NOW</Text>
              </Pressable>
            </View>
            <View style={styles.buttonShadow}>
              <Pressable onPress={handleDeclinePayment} style={styles.secondaryButton}>
                <Text style={styles.secondaryButtonText}>DECLINE</Text>
              </Pressable>
            </View>
          </>
        ) : null}

        {screenState !== "request_received" ? (
          <View style={styles.buttonShadow}>
            <Pressable
              onPress={screenState === "error" ? handleDeclinePayment : handleCancel}
              style={styles.secondaryButton}
            >
              <Text style={styles.secondaryButtonText}>
                {screenState === "error" ? "TRY AGAIN" : "BACK"}
              </Text>
            </Pressable>
          </View>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.cyan400,
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
    color: COLORS.textMuted,
    letterSpacing: 2,
  },
  amountText: {
    marginTop: 8,
    fontSize: 32,
    fontWeight: "900",
    color: COLORS.textPrimary,
  },
  statusCardShadow: {
    backgroundColor: COLORS.border,
  },
  statusCard: {
    minHeight: 280,
    backgroundColor: COLORS.surface,
    borderWidth: BORDER_THICK.width,
    borderColor: COLORS.border,
    padding: 20,
    transform: [{ translateX: -SHADOW_OFFSET.width }, { translateY: -SHADOW_OFFSET.height }],
  },
  statusLabel: {
    fontSize: 20,
    fontWeight: "900",
    color: COLORS.textPrimary,
    letterSpacing: 2,
    marginBottom: 16,
  },
  visualContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 16,
  },
  nfcBadge: {
    width: 92,
    height: 92,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 46,
    borderWidth: BORDER_THICK.width,
    borderColor: COLORS.border,
    backgroundColor: COLORS.yellow400,
  },
  statusText: {
    fontSize: 16,
    fontWeight: "900",
    color: COLORS.textPrimary,
    textAlign: "center",
    lineHeight: 22,
  },
  requestCard: {
    gap: 8,
  },
  detailLabel: {
    fontSize: 11,
    fontWeight: "900",
    color: COLORS.textMuted,
    letterSpacing: 1,
  },
  detailValue: {
    fontSize: 18,
    fontWeight: "900",
    color: COLORS.textPrimary,
  },
  helperText: {
    fontSize: 13,
    fontWeight: "700",
    color: COLORS.textPrimary,
    opacity: 0.7,
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
