import { useCallback, useEffect, useMemo, useState } from "react";
import { View, Text, StyleSheet, Pressable, ActivityIndicator } from "react-native";
import * as Haptics from "expo-haptics";
import type { Address } from "viem";
import { useOperationalWallet } from "../lib/wallet";
import { getPaymentTrackingPollingClient } from "../lib/payments/payment-tracking-client";
import { TOKENS, VERIFIER_ADDRESS } from "../lib/blockchain/contracts";
import { COLORS, BORDER_THICK, SHADOW } from "../constants/theme";
import { NeoSlider, type SliderStep } from "./NeoSlider";
import { ApprovalConfirmModal } from "./ApprovalConfirmModal";

const MAX_ALLOWANCE = (1n << 256n) - 1n;

// Slider steps: 0, 10, 50, 100, 500, 1K, ∞
const APPROVAL_STEPS: Array<SliderStep> = [
  { value: 0n, label: "0" },
  { value: 10n * 10n ** 6n, label: "10" },
  { value: 50n * 10n ** 6n, label: "50" },
  { value: 100n * 10n ** 6n, label: "100" },
  { value: 500n * 10n ** 6n, label: "500" },
  { value: 1000n * 10n ** 6n, label: "1K" },
  { value: MAX_ALLOWANCE, label: "∞" },
];

type AllowanceMap = Record<string, bigint>;

function findNearestStep(allowance: bigint): bigint {
  // Find the closest step to the current allowance
  let nearest = APPROVAL_STEPS[0].value;
  let minDiff = allowance > nearest ? allowance - nearest : nearest - allowance;

  for (const step of APPROVAL_STEPS) {
    const diff = allowance > step.value ? allowance - step.value : step.value - allowance;
    if (diff < minDiff) {
      minDiff = diff;
      nearest = step.value;
    }
  }

  return nearest;
}

function getStepLabel(value: bigint): string {
  const step = APPROVAL_STEPS.find((s) => s.value === value);
  return step?.label ?? "0";
}

function isUnlimited(value: bigint): boolean {
  return value === MAX_ALLOWANCE;
}

export function TokenApprovalsCard() {
  const {
    smartWalletAddress,
    isReady,
    checkAllowance,
    setAllowance,
  } = useOperationalWallet();

  const tokens = useMemo(() => Object.values(TOKENS), []);
  const [allowances, setAllowances] = useState<AllowanceMap>({});
  const [sliderValues, setSliderValues] = useState<AllowanceMap>({});
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [refreshPressed, setRefreshPressed] = useState(false);
  const [pendingToken, setPendingToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Modal state
  const [modalVisible, setModalVisible] = useState(false);
  const [pendingApproval, setPendingApproval] = useState<{
    tokenAddress: Address;
    tokenSymbol: string;
    amount: bigint;
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
      const next = await Promise.all(
        tokens.map(async (token) => {
          const allowance = await checkAllowance(
            token.address,
            smartWalletAddress,
            VERIFIER_ADDRESS,
          );

          return [token.address.toLowerCase(), allowance] as const;
        }),
      );

      const allowanceMap = Object.fromEntries(next);
      setAllowances(allowanceMap);

      // Initialize slider values to nearest step
      const sliderMap: AllowanceMap = {};
      for (const [addr, allowance] of Object.entries(allowanceMap)) {
        sliderMap[addr] = findNearestStep(allowance);
      }
      setSliderValues(sliderMap);
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

  const handleSliderChange = useCallback(
    (tokenAddress: string, value: bigint) => {
      setSliderValues((prev) => ({
        ...prev,
        [tokenAddress.toLowerCase()]: value,
      }));
    },
    [],
  );

  const handleConfirmApproval = useCallback(async () => {
    if (!pendingApproval || !smartWalletAddress || !isReady) {
      return;
    }

    const { tokenAddress, amount } = pendingApproval;
    const key = tokenAddress.toLowerCase();
    setPendingToken(key);
    setError(null);
    setModalVisible(false);

    try {
      const txHash = await setAllowance(tokenAddress, VERIFIER_ADDRESS, amount);
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
    } catch (setErrorState) {
      setError(
        setErrorState instanceof Error
          ? setErrorState.message
          : "Failed to update allowance",
      );
    } finally {
      setPendingToken(null);
      setPendingApproval(null);
    }
  }, [isReady, pendingApproval, refreshAllowances, setAllowance, smartWalletAddress]);

  const handleCancelModal = useCallback(() => {
    setModalVisible(false);
    // Reset slider to current allowance
    if (pendingApproval) {
      const key = pendingApproval.tokenAddress.toLowerCase();
      const currentAllowance = allowances[key] ?? 0n;
      setSliderValues((prev) => ({
        ...prev,
        [key]: findNearestStep(currentAllowance),
      }));
    }
    setPendingApproval(null);
  }, [allowances, pendingApproval]);

  const handleTickPress = useCallback(
    (token: { address: Address; symbol: string }, amount: bigint) => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
      setPendingApproval({
        tokenAddress: token.address,
        tokenSymbol: token.symbol,
        amount,
      });
      setModalVisible(true);
    },
    [],
  );

  return (
    <View style={styles.cardShadow}>
      <View style={styles.card}>
        <View style={styles.header}>
          <Text style={styles.label}>LIMITS</Text>
          <Pressable
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
              refreshAllowances().catch(console.error);
            }}
            onPressIn={() => setRefreshPressed(true)}
            onPressOut={() => setRefreshPressed(false)}
            disabled={isRefreshing || !isReady}
            style={[
              styles.refreshButton,
              !(isRefreshing || !isReady) && refreshPressed && styles.refreshButtonPressed,
              (isRefreshing || !isReady) && styles.buttonDisabled,
            ]}
          >
            <Text style={styles.refreshText}>{isRefreshing ? "SYNCING" : "REFRESH"}</Text>
          </Pressable>
        </View>

        {!isReady || !smartWalletAddress ? (
          <View style={styles.noticeBox}>
            <Text style={styles.noticeText}>
              Wait for the smart wallet to finish provisioning before approving tokens.
            </Text>
          </View>
        ) : null}

        <View style={styles.tokenList}>
          {tokens.map((token, index) => {
            const key = token.address.toLowerCase();
            const allowance = allowances[key] ?? 0n;
            const sliderValue = sliderValues[key] ?? 0n;
            const currentStep = findNearestStep(allowance);
            const hasChanges = sliderValue !== currentStep;
            const isPending = pendingToken === key;

            return (
              <View
                key={token.address}
                style={[
                  styles.tokenRow,
                  index < tokens.length - 1 && styles.tokenRowBorder,
                ]}
              >
                <Text style={styles.tokenSymbol}>{token.symbol}</Text>

                <View style={styles.sliderContainer}>
                  <NeoSlider
                    steps={APPROVAL_STEPS}
                    value={sliderValue}
                    onChange={(value) => handleSliderChange(key, value)}
                    disabled={!isReady || isPending}
                  />
                </View>

                <Text style={styles.valueText}>
                  {isUnlimited(sliderValue) ? "∞" : getStepLabel(sliderValue)}
                </Text>

                {hasChanges && !isPending && (
                  <Pressable
                    style={styles.confirmTick}
                    onPress={() => handleTickPress(token, sliderValue)}
                  >
                    <Text style={styles.tickText}>✓</Text>
                  </Pressable>
                )}

                {isPending && (
                  <View style={styles.pendingIndicator}>
                    <ActivityIndicator size="small" color={COLORS.textPrimary} />
                  </View>
                )}
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
        amountLabel={getStepLabel(pendingApproval?.amount ?? 0n)}
        isUnlimited={isUnlimited(pendingApproval?.amount ?? 0n)}
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
    gap: 12,
    transform: [{ translateX: -8 }, { translateY: -8 }],
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
  },
  label: {
    fontSize: 12,
    fontWeight: "900",
    letterSpacing: 2,
    color: COLORS.textPrimary,
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
    color: COLORS.textPrimary,
    lineHeight: 18,
  },
  tokenList: {
    gap: 0,
  },
  tokenRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 12,
  },
  tokenRowBorder: {
    borderBottomWidth: BORDER_THICK.width,
    borderBottomColor: COLORS.border,
  },
  tokenSymbol: {
    fontSize: 16,
    fontWeight: "900",
    color: COLORS.textPrimary,
    minWidth: 50,
  },
  sliderContainer: {
    flex: 1,
  },
  valueText: {
    fontSize: 18,
    fontWeight: "900",
    color: COLORS.textPrimary,
    minWidth: 40,
    textAlign: "right",
  },
  confirmTick: {
    width: 36,
    height: 36,
    backgroundColor: COLORS.green400,
    borderWidth: BORDER_THICK.width,
    borderColor: COLORS.border,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: COLORS.border,
    shadowOffset: SHADOW.sm.offset,
    shadowOpacity: SHADOW.sm.opacity,
    shadowRadius: SHADOW.sm.radius,
    elevation: SHADOW.sm.elevation,
  },
  tickText: {
    fontSize: 20,
    fontWeight: "900",
    color: COLORS.textPrimary,
  },
  pendingIndicator: {
    width: 36,
    height: 36,
    justifyContent: "center",
    alignItems: "center",
  },
  buttonDisabled: {
    opacity: 0.45,
  },
  errorBox: {
    backgroundColor: COLORS.red500,
    borderWidth: BORDER_THICK.width,
    borderColor: COLORS.border,
    padding: 12,
  },
  errorText: {
    fontSize: 12,
    fontWeight: "800",
    color: COLORS.textInverted,
    lineHeight: 18,
  },
});
