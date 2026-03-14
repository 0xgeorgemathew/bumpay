import { useCallback, useEffect, useMemo, useState } from "react";
import { View, Text, StyleSheet, Pressable } from "react-native";
import * as Haptics from "expo-haptics";
import type { Address } from "viem";
import { useOperationalWallet } from "../lib/wallet";
import { getPaymentTrackingPollingClient } from "../lib/payments/payment-tracking-client";
import { TOKENS, VERIFIER_ADDRESS } from "../lib/blockchain/contracts";
import { COLORS, BORDER_THICK } from "../constants/theme";

const MAX_ALLOWANCE = (1n << 256n) - 1n;

type AllowanceMap = Record<string, bigint>;

function formatAddress(address: Address) {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function formatAllowance(amount: bigint, decimals: number) {
  if (amount === 0n) {
    return "NOT APPROVED";
  }

  if (amount === MAX_ALLOWANCE) {
    return "MAX APPROVED";
  }

  const whole = amount / 10n ** BigInt(decimals);
  if (whole >= 1_000_000n) {
    return `${whole.toString()} UNITS`;
  }

  const value = Number(amount) / 10 ** decimals;
  return `${value.toFixed(2)} APPROVED`;
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
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [pendingToken, setPendingToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refreshAllowances = useCallback(async () => {
    if (!smartWalletAddress || !isReady) {
      setAllowances({});
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

      setAllowances(Object.fromEntries(next));
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

  const handleSetAllowance = useCallback(
    async (tokenAddress: Address, amount: bigint) => {
      if (!smartWalletAddress || !isReady) {
        return;
      }

      const key = tokenAddress.toLowerCase();
      setPendingToken(key);
      setError(null);
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);

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
      }
    },
    [isReady, refreshAllowances, setAllowance, smartWalletAddress],
  );

  return (
    <View style={styles.cardShadow}>
      <View style={styles.card}>
        <View style={styles.header}>
          <View>
            <Text style={styles.label}>TOKEN APPROVALS</Text>
            <Text style={styles.description}>
              Pre-approve the verifier used for merchant claims.
            </Text>
          </View>
          <Pressable
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              refreshAllowances().catch(console.error);
            }}
            disabled={isRefreshing || !isReady}
            style={[
              styles.refreshButton,
              (isRefreshing || !isReady) && styles.buttonDisabled,
            ]}
          >
            <Text style={styles.refreshText}>{isRefreshing ? "SYNCING" : "REFRESH"}</Text>
          </Pressable>
        </View>

        <View style={styles.verifierBox}>
          <Text style={styles.verifierLabel}>VERIFIER</Text>
          <Text style={styles.verifierValue}>{formatAddress(VERIFIER_ADDRESS)}</Text>
        </View>

        {!isReady || !smartWalletAddress ? (
          <View style={styles.noticeBox}>
            <Text style={styles.noticeText}>
              Wait for the smart wallet to finish provisioning before approving tokens.
            </Text>
          </View>
        ) : null}

        {tokens.map((token) => {
          const key = token.address.toLowerCase();
          const allowance = allowances[key] ?? 0n;
          const isPending = pendingToken === key;

          return (
            <View key={token.address} style={styles.tokenRow}>
              <View style={styles.tokenMeta}>
                <Text style={styles.tokenSymbol}>{token.symbol}</Text>
                <Text style={styles.tokenName}>{token.name}</Text>
                <Text style={styles.allowanceText}>
                  {isReady ? formatAllowance(allowance, token.decimals) : "WALLET REQUIRED"}
                </Text>
              </View>

              <View style={styles.tokenActions}>
                <Pressable
                  onPress={() => handleSetAllowance(token.address, MAX_ALLOWANCE)}
                  disabled={!isReady || isPending}
                  style={[
                    styles.actionButton,
                    styles.approveButton,
                    (!isReady || isPending) && styles.buttonDisabled,
                  ]}
                >
                  <Text style={styles.actionText}>{isPending ? "PENDING" : "APPROVE MAX"}</Text>
                </Pressable>

                <Pressable
                  onPress={() => handleSetAllowance(token.address, 0n)}
                  disabled={!isReady || isPending || allowance === 0n}
                  style={[
                    styles.actionButton,
                    styles.revokeButton,
                    (!isReady || isPending || allowance === 0n) && styles.buttonDisabled,
                  ]}
                >
                  <Text style={[styles.actionText, styles.revokeText]}>REVOKE</Text>
                </Pressable>
              </View>
            </View>
          );
        })}

        {error ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}
      </View>
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
    gap: 16,
    transform: [{ translateX: -8 }, { translateY: -8 }],
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
  },
  label: {
    fontSize: 12,
    fontWeight: "900",
    letterSpacing: 2,
    color: COLORS.textPrimary,
  },
  description: {
    marginTop: 6,
    fontSize: 13,
    fontWeight: "700",
    color: COLORS.textMuted,
    lineHeight: 18,
  },
  refreshButton: {
    alignSelf: "flex-start",
    backgroundColor: COLORS.yellow400,
    borderWidth: BORDER_THICK.width,
    borderColor: COLORS.border,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  refreshText: {
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 1,
    color: COLORS.textPrimary,
  },
  verifierBox: {
    backgroundColor: COLORS.backgroundLight,
    borderWidth: BORDER_THICK.width,
    borderColor: COLORS.border,
    padding: 12,
  },
  verifierLabel: {
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 1.5,
    color: COLORS.textMuted,
    marginBottom: 4,
  },
  verifierValue: {
    fontSize: 14,
    fontWeight: "900",
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
  tokenRow: {
    gap: 12,
    borderWidth: BORDER_THICK.width,
    borderColor: COLORS.border,
    padding: 12,
    backgroundColor: COLORS.backgroundLight,
  },
  tokenMeta: {
    gap: 4,
  },
  tokenSymbol: {
    fontSize: 20,
    fontWeight: "900",
    color: COLORS.textPrimary,
  },
  tokenName: {
    fontSize: 13,
    fontWeight: "700",
    color: COLORS.textMuted,
  },
  allowanceText: {
    fontSize: 12,
    fontWeight: "900",
    letterSpacing: 1,
    color: COLORS.textPrimary,
  },
  tokenActions: {
    flexDirection: "row",
    gap: 8,
  },
  actionButton: {
    flex: 1,
    borderWidth: BORDER_THICK.width,
    borderColor: COLORS.border,
    paddingVertical: 12,
    alignItems: "center",
  },
  approveButton: {
    backgroundColor: COLORS.green400,
  },
  revokeButton: {
    backgroundColor: COLORS.surface,
  },
  actionText: {
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 1,
    color: COLORS.textPrimary,
  },
  revokeText: {
    color: COLORS.textPrimary,
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
