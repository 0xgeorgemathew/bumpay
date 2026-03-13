import { useState, useEffect, useCallback } from "react";
import { View, Text, StyleSheet, Pressable } from "react-native";
import * as Clipboard from "expo-clipboard";
import * as Haptics from "expo-haptics";
import { COLORS, BORDER_THICK, SHADOW } from "../constants/theme";
import { useOperationalWallet } from "../lib/wallet";
import { useBalance } from "../lib/balance-context";
import {
  CHAIN_NAME,
  CHAIN_ID,
  TOKEN_SYMBOL,
} from "../lib/blockchain/contracts";
import { fromTokenUnits } from "../lib/blockchain/token-mint";

interface WalletSetupCardProps {
  onWalletUpdate?: (state: {
    address: `0x${string}` | null;
    balance: bigint;
    ethBalance: bigint;
    isReady: boolean;
  }) => void;
  smartWalletAddress?: `0x${string}` | null;
}

export function WalletSetupCard({ onWalletUpdate, smartWalletAddress: propAddress }: WalletSetupCardProps) {
  const {
    rootSignerAddress,
    embeddedWalletAddress,
    smartWalletAddress: hookAddress,
    status,
    isReady,
    isLoading,
    error,
    retryProvisioning,
    mintTestTokens,
    mintTestUSDT,
    refreshBalances,
  } = useOperationalWallet();

  const { refreshBalance } = useBalance();

  const smartWalletAddress = propAddress ?? hookAddress;

  const [usdcBalance, setUsdcBalance] = useState(BigInt(0));
  const [usdtBalance, setUsdtBalance] = useState(BigInt(0));
  const [ethBalance, setEthBalance] = useState(BigInt(0));
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [copiedAddress, setCopiedAddress] = useState<"smart" | "root" | null>(null);

  const refreshState = useCallback(async () => {
    if (!smartWalletAddress || !isReady) {
      return;
    }

    setIsRefreshing(true);
    try {
      const result = await refreshBalances();
      if (!result) {
        return;
      }

      setUsdcBalance(result.usdcBalance);
      setUsdtBalance(result.usdtBalance);
      setEthBalance(result.nativeBalance);
      onWalletUpdate?.({
        address: smartWalletAddress,
        balance: result.usdcBalance,
        ethBalance: result.nativeBalance,
        isReady: true,
      });
    } finally {
      setIsRefreshing(false);
    }
  }, [isReady, onWalletUpdate, refreshBalances, smartWalletAddress]);

  useEffect(() => {
    refreshState();
  }, [refreshState]);

  const handleMint = async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    await mintTestTokens();
    setTimeout(() => {
      refreshState();
      refreshBalance();
    }, 2000);
  };

  const handleMintUSDT = async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    await mintTestUSDT();
    setTimeout(() => {
      refreshState();
      refreshBalance();
    }, 2000);
  };

  const handleRefresh = async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    await refreshState();
  };

  const handleCopy = async (type: "smart" | "root", address: string | null) => {
    if (!address) {
      return;
    }

    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await Clipboard.setStringAsync(address);
    setCopiedAddress(type);
    setTimeout(() => setCopiedAddress(null), 1600);
  };

  if (!isExpanded && isReady) {
    return (
      <Pressable
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          setIsExpanded(true);
        }}
        style={styles.compactCard}
      >
        <Text style={styles.compactText}>✓ SMART WALLET READY • TAP TO MANAGE</Text>
      </Pressable>
    );
  }

  return (
    <View style={styles.card}>
      <Pressable
        style={styles.header}
        onPress={() => isReady && setIsExpanded(false)}
      >
        <Text style={styles.label}>WALLET SETUP</Text>
        {isReady && <Text style={styles.collapseLabel}>COLLAPSE</Text>}
      </Pressable>
      <View style={styles.content}>
        <View style={styles.row}>
          <View style={styles.rowText}>
            <Text style={styles.rowLabel}>SMART WALLET</Text>
            <Text style={styles.value}>
              {smartWalletAddress ?? "PROVISIONING"}
            </Text>
          </View>
          <Pressable
            onPress={() => handleCopy("smart", smartWalletAddress)}
            style={styles.copyButton}
            disabled={!smartWalletAddress}
          >
            <Text style={styles.copyText}>
              {copiedAddress === "smart" ? "COPIED" : "COPY"}
            </Text>
          </Pressable>
        </View>

        <View style={styles.row}>
          <View style={styles.rowText}>
            <Text style={styles.rowLabel}>EMBEDDED SIGNER</Text>
            <Text style={styles.value}>
              {embeddedWalletAddress ?? rootSignerAddress ?? "PROVISIONING"}
            </Text>
          </View>
          <Pressable
            onPress={() => handleCopy("root", embeddedWalletAddress ?? rootSignerAddress)}
            style={styles.copyButton}
            disabled={!embeddedWalletAddress && !rootSignerAddress}
          >
            <Text style={styles.copyText}>
              {copiedAddress === "root" ? "COPIED" : "COPY"}
            </Text>
          </Pressable>
        </View>

        <View style={styles.row}>
          <View style={styles.rowText}>
            <Text style={styles.rowLabel}>STATUS</Text>
            <Text style={styles.value}>
              {status === "ready"
                ? "READY"
                : status === "creating_embedded"
                  ? "CREATING EMBEDDED WALLET"
                  : status === "creating_smart"
                    ? "CREATING SMART WALLET"
                    : "SETUP FAILED"}
            </Text>
          </View>
        </View>

        <View style={styles.row}>
          <View style={styles.rowText}>
            <Text style={styles.rowLabel}>NETWORK</Text>
            <Text style={styles.value}>
              {CHAIN_NAME} · CHAIN {CHAIN_ID}
            </Text>
          </View>
        </View>

        <View style={styles.row}>
          <View style={styles.rowText}>
            <Text style={styles.rowLabel}>USDC BALANCE</Text>
            <Text style={styles.value}>
              {fromTokenUnits(usdcBalance).toFixed(2)} USDC
            </Text>
          </View>
        </View>

        <View style={styles.row}>
          <View style={styles.rowText}>
            <Text style={styles.rowLabel}>USDT BALANCE</Text>
            <Text style={styles.value}>
              {fromTokenUnits(usdtBalance).toFixed(2)} USDT
            </Text>
          </View>
        </View>

        <View style={styles.row}>
          <View style={styles.rowText}>
            <Text style={styles.rowLabel}>NATIVE GAS BALANCE</Text>
            <Text style={styles.value}>{Number(ethBalance) / 1e18} ETH</Text>
          </View>
        </View>

        {error && (
          <View style={styles.errorRow}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        <View style={styles.actions}>
          {status === "error" ? (
            <Pressable
              onPress={retryProvisioning}
              style={({ pressed }) => [
                styles.actionButton,
                styles.retryButton,
                pressed && styles.buttonPressed,
              ]}
            >
              <Text style={styles.actionText}>RETRY SETUP</Text>
            </Pressable>
          ) : null}

          <Pressable
            onPress={handleMint}
            disabled={isLoading || !isReady || !smartWalletAddress}
            style={({ pressed }) => [
              styles.actionButton,
              styles.mintButton,
              (isLoading || !isReady || !smartWalletAddress) && styles.actionDisabled,
              pressed && styles.buttonPressed,
            ]}
          >
            <Text style={styles.actionText}>MINT TEST USDC</Text>
          </Pressable>

          <Pressable
            onPress={handleMintUSDT}
            disabled={isLoading || !isReady || !smartWalletAddress}
            style={({ pressed }) => [
              styles.actionButton,
              styles.mintUsdtButton,
              (isLoading || !isReady || !smartWalletAddress) && styles.actionDisabled,
              pressed && styles.buttonPressed,
            ]}
          >
            <Text style={styles.actionText}>MINT TEST USDT</Text>
          </Pressable>

          <Pressable
            onPress={handleRefresh}
            disabled={isRefreshing || !isReady}
            style={({ pressed }) => [
              styles.actionButton,
              styles.refreshButton,
              (isRefreshing || !isReady) && styles.actionDisabled,
              pressed && styles.buttonPressed,
            ]}
          >
            <Text style={[styles.actionText, { color: COLORS.textPrimary }]}>
              {isRefreshing ? "REFRESHING..." : "REFRESH"}
            </Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  compactCard: {
    backgroundColor: COLORS.success,
    borderWidth: BORDER_THICK.width,
    borderColor: COLORS.border,
    padding: 14,
    alignItems: "center",
    marginBottom: 24,
    shadowColor: COLORS.border,
    shadowOffset: SHADOW.sm.offset,
    shadowOpacity: SHADOW.sm.opacity,
    shadowRadius: SHADOW.sm.radius,
    elevation: SHADOW.sm.elevation,
  },
  compactText: {
    color: COLORS.textInverted,
    fontWeight: "900",
    fontSize: 12,
    letterSpacing: 2,
  },
  card: {
    backgroundColor: COLORS.surface,
    borderWidth: BORDER_THICK.width,
    borderColor: COLORS.border,
    shadowColor: COLORS.border,
    shadowOffset: SHADOW.md.offset,
    shadowOpacity: SHADOW.md.opacity,
    shadowRadius: SHADOW.md.radius,
    elevation: SHADOW.md.elevation,
    marginBottom: 24,
  },
  header: {
    backgroundColor: COLORS.surfaceInverted,
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  label: {
    color: COLORS.background,
    fontWeight: "900",
    fontSize: 12,
    letterSpacing: 2,
    textTransform: "uppercase",
  },
  collapseLabel: {
    color: COLORS.textInverted,
    fontWeight: "800",
    fontSize: 10,
    opacity: 0.7,
  },
  content: {
    padding: 16,
    gap: 16,
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 12,
  },
  rowText: {
    flex: 1,
  },
  rowLabel: {
    fontWeight: "900",
    fontSize: 10,
    color: COLORS.textPrimary,
    letterSpacing: 1,
    textTransform: "uppercase",
    marginBottom: 4,
    opacity: 0.7,
  },
  value: {
    fontWeight: "800",
    fontSize: 14,
    color: COLORS.textPrimary,
    lineHeight: 20,
  },
  copyButton: {
    backgroundColor: COLORS.surfaceInverted,
    borderWidth: BORDER_THICK.width,
    borderColor: COLORS.border,
    paddingHorizontal: 14,
    paddingVertical: 10,
    minWidth: 88,
    alignItems: "center",
  },
  copyText: {
    color: COLORS.textInverted,
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 1,
  },
  errorRow: {
    backgroundColor: COLORS.error,
    padding: 12,
    borderWidth: BORDER_THICK.width,
    borderColor: COLORS.border,
  },
  errorText: {
    fontWeight: "800",
    fontSize: 12,
    color: COLORS.textInverted,
    textAlign: "center",
  },
  actions: {
    gap: 12,
  },
  actionButton: {
    paddingVertical: 14,
    alignItems: "center",
    borderWidth: BORDER_THICK.width,
    borderColor: COLORS.border,
  },
  mintButton: {
    backgroundColor: COLORS.green400,
  },
  mintUsdtButton: {
    backgroundColor: COLORS.cyan400,
  },
  retryButton: {
    backgroundColor: COLORS.warning,
  },
  refreshButton: {
    backgroundColor: COLORS.yellow400,
  },
  actionDisabled: {
    opacity: 0.5,
  },
  actionText: {
    fontWeight: "900",
    fontSize: 12,
    textTransform: "uppercase",
    letterSpacing: 1,
    color: COLORS.textPrimary,
  },
  buttonPressed: {
    opacity: 0.8,
  },
});
