import { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import * as Haptics from "expo-haptics";
import type { Address } from "viem";
import { useOperationalWallet } from "../lib/wallet";
import { getPaymentTrackingPollingClient } from "../lib/payments/payment-tracking-client";
import { TOKENS, VERIFIER_ADDRESS } from "../lib/blockchain/contracts";
import { BORDER_THICK, BORDER_THIN, COLORS, SHADOW } from "../constants/theme";
import { ApprovalConfirmModal } from "./ApprovalConfirmModal";
import { NeoSlider, type NeoSliderValue } from "./NeoSlider";

const MAX_ALLOWANCE = (1n << 256n) - 1n;
const MAX_FINITE_ALLOWANCE_USD = 1000;

type AllowanceMap = Record<string, bigint>;
type SliderDraftMap = Record<string, NeoSliderValue>;

function isUnlimitedAllowance(value: bigint) {
  return value === MAX_ALLOWANCE;
}

function getDecimalsFactor(decimals: number) {
  return 10n ** BigInt(decimals);
}

function getFiniteAllowanceCap(decimals: number) {
  return BigInt(MAX_FINITE_ALLOWANCE_USD) * getDecimalsFactor(decimals);
}

function createFiniteSliderValue(amount: number): NeoSliderValue {
  return {
    mode: "finite",
    amount: Math.min(MAX_FINITE_ALLOWANCE_USD, Math.max(0, Math.round(amount))),
  };
}

function allowanceToSliderValue(allowance: bigint, decimals: number): NeoSliderValue {
  if (isUnlimitedAllowance(allowance)) {
    return { mode: "unlimited" };
  }

  const decimalsFactor = getDecimalsFactor(decimals);
  const finiteCap = getFiniteAllowanceCap(decimals);

  if (allowance >= finiteCap) {
    return createFiniteSliderValue(MAX_FINITE_ALLOWANCE_USD);
  }

  return createFiniteSliderValue(Number(allowance) / Number(decimalsFactor));
}

function sliderValueToAllowance(value: NeoSliderValue, decimals: number): bigint {
  if (value.mode === "unlimited") {
    return MAX_ALLOWANCE;
  }

  return BigInt(value.amount) * getDecimalsFactor(decimals);
}

function sliderValuesMatch(left: NeoSliderValue, right: NeoSliderValue) {
  if (left.mode !== right.mode) {
    return false;
  }

  if (left.mode === "unlimited" && right.mode === "unlimited") {
    return true;
  }

  if (left.mode !== "finite" || right.mode !== "finite") {
    return false;
  }

  return left.amount === right.amount;
}

function formatSliderChip(value: NeoSliderValue) {
  if (value.mode === "unlimited") {
    return "UNLIMITED";
  }

  return `${value.amount.toLocaleString("en-US")} USD`;
}

function formatModalAmountLabel(value: NeoSliderValue) {
  if (value.mode === "unlimited") {
    return "∞";
  }

  return value.amount.toLocaleString("en-US");
}

function formatCurrentAllowance(allowance: bigint, decimals: number) {
  if (isUnlimitedAllowance(allowance)) {
    return "UNLIMITED";
  }

  const decimalsFactor = getDecimalsFactor(decimals);
  const finiteCap = getFiniteAllowanceCap(decimals);

  if (allowance > finiteCap) {
    return "> 1K USD";
  }

  const whole = allowance / decimalsFactor;
  const centsFactor = decimals >= 2 ? decimalsFactor / 100n : 0n;
  const cents = centsFactor > 0n ? (allowance % decimalsFactor) / centsFactor : 0n;

  if (cents === 0n) {
    return `${whole.toString()} USD`;
  }

  return `${whole.toString()}.${cents.toString().padStart(2, "0")} USD`;
}

export function TokenApprovalsCard() {
  const { smartWalletAddress, isReady, checkAllowance, setAllowance } = useOperationalWallet();

  const tokens = useMemo(() => Object.values(TOKENS), []);
  const [allowances, setAllowances] = useState<AllowanceMap>({});
  const [sliderValues, setSliderValues] = useState<SliderDraftMap>({});
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [pendingToken, setPendingToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [pendingApproval, setPendingApproval] = useState<{
    tokenAddress: Address;
    tokenSymbol: string;
    tokenDecimals: number;
    sliderValue: NeoSliderValue;
  } | null>(null);

  const refreshAllowances = useCallback(async () => {
    if (!smartWalletAddress || !isReady) {
      setAllowances({});
      setSliderValues({});
      return;
    }

    setIsRefreshing(true);
    setError(null);

    try {
      const nextAllowances = await Promise.all(
        tokens.map(async (token) => {
          const allowance = await checkAllowance(
            token.address,
            smartWalletAddress,
            VERIFIER_ADDRESS,
          );

          return [token.address.toLowerCase(), allowance, token.decimals] as const;
        }),
      );

      const allowanceMap = Object.fromEntries(
        nextAllowances.map(([address, allowance]) => [address, allowance]),
      );
      const draftMap = Object.fromEntries(
        nextAllowances.map(([address, allowance, decimals]) => [
          address,
          allowanceToSliderValue(allowance, decimals),
        ]),
      );

      setAllowances(allowanceMap);
      setSliderValues(draftMap);
    } catch (allowanceError) {
      setError(
        allowanceError instanceof Error
          ? allowanceError.message
          : "Failed to read token allowances",
      );
    } finally {
      setIsRefreshing(false);
    }
  }, [checkAllowance, isReady, smartWalletAddress, tokens]);

  useEffect(() => {
    refreshAllowances().catch(console.error);
  }, [refreshAllowances]);

  const handleSliderChange = useCallback((tokenAddress: string, value: NeoSliderValue) => {
    setSliderValues((current) => ({
      ...current,
      [tokenAddress.toLowerCase()]: value,
    }));
  }, []);

  const handleConfirmApproval = useCallback(async () => {
    if (!pendingApproval || !smartWalletAddress || !isReady) {
      return;
    }

    const key = pendingApproval.tokenAddress.toLowerCase();
    setPendingToken(key);
    setError(null);
    setModalVisible(false);

    try {
      const txHash = await setAllowance(
        pendingApproval.tokenAddress,
        VERIFIER_ADDRESS,
        sliderValueToAllowance(pendingApproval.sliderValue, pendingApproval.tokenDecimals),
      );

      if (!txHash) {
        throw new Error("Allowance transaction was not submitted");
      }

      const receipt = await getPaymentTrackingPollingClient().waitForTransactionReceipt({
        hash: txHash,
      });

      if (receipt.status !== "success") {
        throw new Error("Allowance transaction reverted");
      }

      await refreshAllowances();
    } catch (setAllowanceError) {
      setError(
        setAllowanceError instanceof Error
          ? setAllowanceError.message
          : "Failed to update allowance",
      );
    } finally {
      setPendingToken(null);
      setPendingApproval(null);
    }
  }, [isReady, pendingApproval, refreshAllowances, setAllowance, smartWalletAddress]);

  const handleCancelModal = useCallback(() => {
    setModalVisible(false);

    if (pendingApproval) {
      const key = pendingApproval.tokenAddress.toLowerCase();
      const currentAllowance = allowances[key] ?? 0n;

      setSliderValues((current) => ({
        ...current,
        [key]: allowanceToSliderValue(currentAllowance, pendingApproval.tokenDecimals),
      }));
    }

    setPendingApproval(null);
  }, [allowances, pendingApproval]);

  const handleApplyPress = useCallback(
    (token: (typeof tokens)[number], sliderValue: NeoSliderValue) => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => undefined);
      setPendingApproval({
        tokenAddress: token.address,
        tokenSymbol: token.symbol,
        tokenDecimals: token.decimals,
        sliderValue,
      });
      setModalVisible(true);
    },
    [],
  );

  return (
    <View style={styles.cardShadow}>
      <View style={styles.card}>
        <View style={styles.header}>
          <View style={styles.headerCopy}>
            <Text style={styles.label}>LIMITS</Text>
            <Text style={styles.description}>
              Drag between 0 and 1K USD. Push the final stop to grant unlimited spending.
            </Text>
          </View>

          <Pressable
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => undefined);
              refreshAllowances().catch(console.error);
            }}
            disabled={isRefreshing || !isReady}
            style={({ pressed }) => [
              styles.refreshButton,
              pressed && !(isRefreshing || !isReady) && styles.refreshButtonPressed,
              (isRefreshing || !isReady) && styles.buttonDisabled,
            ]}
          >
            <Text style={styles.refreshText}>{isRefreshing ? "SYNCING" : "REFRESH"}</Text>
          </Pressable>
        </View>

        {!isReady || !smartWalletAddress ? (
          <View style={styles.noticeBox}>
            <Text style={styles.noticeText}>
              Wait for the smart wallet to finish provisioning before updating spending limits.
            </Text>
          </View>
        ) : null}

        <View style={styles.tokenList}>
          {tokens.map((token, index) => {
            const key = token.address.toLowerCase();
            const allowance = allowances[key] ?? 0n;
            const currentValue = allowanceToSliderValue(allowance, token.decimals);
            const sliderValue = sliderValues[key] ?? currentValue;
            const hasChanges = !sliderValuesMatch(sliderValue, currentValue);
            const isPending = pendingToken === key;

            return (
              <View
                key={token.address}
                style={[
                  styles.tokenCard,
                  index < tokens.length - 1 && styles.tokenCardSpacing,
                ]}
              >
                <View style={styles.tokenHeader}>
                  <View style={styles.symbolBadge}>
                    <Text style={styles.symbolText}>{token.symbol}</Text>
                  </View>

                  <View
                    style={[
                      styles.valueChip,
                      sliderValue.mode === "unlimited"
                        ? styles.valueChipUnlimited
                        : styles.valueChipFinite,
                    ]}
                  >
                    <Text style={styles.valueChipText}>{formatSliderChip(sliderValue)}</Text>
                  </View>
                </View>

                <NeoSlider
                  value={sliderValue}
                  onChange={(value) => handleSliderChange(key, value)}
                  disabled={!isReady || isPending}
                />

                <View style={styles.tokenFooter}>
                  <Text style={styles.currentText}>
                    CURRENT {formatCurrentAllowance(allowance, token.decimals)}
                  </Text>

                  {isPending ? (
                    <View style={styles.pendingBadge}>
                      <ActivityIndicator size="small" color={COLORS.textPrimary} />
                    </View>
                  ) : (
                    <Pressable
                      onPress={() => handleApplyPress(token, sliderValue)}
                      disabled={!hasChanges || !isReady}
                      style={({ pressed }) => [
                        styles.applyButton,
                        !hasChanges && styles.applyButtonIdle,
                        pressed && hasChanges && isReady && styles.applyButtonPressed,
                        (!hasChanges || !isReady) && styles.applyButtonDisabled,
                      ]}
                    >
                      <Text style={styles.applyButtonText}>{hasChanges ? "APPLY" : "LIVE"}</Text>
                    </Pressable>
                  )}
                </View>
              </View>
            );
          })}
        </View>

        {error ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}
      </View>

      <ApprovalConfirmModal
        visible={modalVisible}
        tokenSymbol={pendingApproval?.tokenSymbol ?? ""}
        amountLabel={formatModalAmountLabel(pendingApproval?.sliderValue ?? createFiniteSliderValue(0))}
        isUnlimited={pendingApproval?.sliderValue.mode === "unlimited"}
        onConfirm={handleConfirmApproval}
        onCancel={handleCancelModal}
        isLoading={pendingToken !== null}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  cardShadow: {
    backgroundColor: COLORS.border,
  },
  card: {
    backgroundColor: COLORS.surface,
    borderWidth: BORDER_THICK.width,
    borderColor: COLORS.border,
    padding: 16,
    gap: 14,
    transform: [{ translateX: -8 }, { translateY: -8 }],
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 12,
  },
  headerCopy: {
    flex: 1,
    gap: 6,
  },
  label: {
    fontSize: 12,
    fontWeight: "900",
    letterSpacing: 2,
    color: COLORS.textPrimary,
  },
  description: {
    fontSize: 12,
    fontWeight: "700",
    lineHeight: 18,
    color: COLORS.textMuted,
  },
  refreshButton: {
    alignSelf: "flex-start",
    backgroundColor: COLORS.yellow400,
    borderWidth: BORDER_THICK.width,
    borderColor: COLORS.border,
    paddingHorizontal: 12,
    paddingVertical: 10,
    shadowColor: COLORS.border,
    shadowOffset: SHADOW.sm.offset,
    shadowOpacity: SHADOW.sm.opacity,
    shadowRadius: SHADOW.sm.radius,
    elevation: SHADOW.sm.elevation,
  },
  refreshButtonPressed: {
    transform: [
      { translateX: SHADOW.sm.offset.width },
      { translateY: SHADOW.sm.offset.height },
    ],
    shadowOffset: { width: 0, height: 0 },
    elevation: 0,
  },
  refreshText: {
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 1,
    color: COLORS.textPrimary,
  },
  noticeBox: {
    backgroundColor: COLORS.yellow400,
    borderWidth: BORDER_THICK.width,
    borderColor: COLORS.border,
    padding: 12,
  },
  noticeText: {
    fontSize: 13,
    fontWeight: "700",
    lineHeight: 18,
    color: COLORS.textPrimary,
  },
  tokenList: {
    gap: 12,
  },
  tokenCard: {
    backgroundColor: COLORS.backgroundLight,
    borderWidth: BORDER_THICK.width,
    borderColor: COLORS.border,
    padding: 12,
    gap: 12,
  },
  tokenCardSpacing: {
    marginBottom: 2,
  },
  tokenHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
  },
  symbolBadge: {
    backgroundColor: COLORS.surfaceInverted,
    borderWidth: BORDER_THICK.width,
    borderColor: COLORS.border,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  symbolText: {
    fontSize: 13,
    fontWeight: "900",
    letterSpacing: 1,
    color: COLORS.textInverted,
  },
  valueChip: {
    flexShrink: 1,
    borderWidth: BORDER_THICK.width,
    borderColor: COLORS.border,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  valueChipFinite: {
    backgroundColor: COLORS.cyan400,
  },
  valueChipUnlimited: {
    backgroundColor: COLORS.pink400,
  },
  valueChipText: {
    fontSize: 12,
    fontWeight: "900",
    letterSpacing: 1,
    color: COLORS.textPrimary,
  },
  tokenFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
  },
  currentText: {
    flex: 1,
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 1,
    color: COLORS.textMuted,
  },
  applyButton: {
    minWidth: 88,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: BORDER_THICK.width,
    borderColor: COLORS.border,
    backgroundColor: COLORS.green400,
    shadowColor: COLORS.border,
    shadowOffset: SHADOW.sm.offset,
    shadowOpacity: SHADOW.sm.opacity,
    shadowRadius: SHADOW.sm.radius,
    elevation: SHADOW.sm.elevation,
  },
  applyButtonPressed: {
    transform: [
      { translateX: SHADOW.sm.offset.width },
      { translateY: SHADOW.sm.offset.height },
    ],
    shadowOffset: { width: 0, height: 0 },
    elevation: 0,
  },
  applyButtonIdle: {
    backgroundColor: COLORS.surface,
  },
  applyButtonDisabled: {
    borderWidth: BORDER_THIN.width,
    backgroundColor: COLORS.surface,
    shadowOffset: { width: 0, height: 0 },
    elevation: 0,
  },
  applyButtonText: {
    fontSize: 12,
    fontWeight: "900",
    letterSpacing: 1,
    color: COLORS.textPrimary,
  },
  pendingBadge: {
    width: 88,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.yellow400,
    borderWidth: BORDER_THICK.width,
    borderColor: COLORS.border,
  },
  buttonDisabled: {
    opacity: 0.45,
  },
  errorBox: {
    backgroundColor: COLORS.error,
    borderWidth: BORDER_THICK.width,
    borderColor: COLORS.border,
    padding: 12,
  },
  errorText: {
    fontSize: 13,
    fontWeight: "900",
    lineHeight: 18,
    color: COLORS.textInverted,
  },
});
