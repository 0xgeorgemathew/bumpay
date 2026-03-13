import { useState, useRef } from "react";
import { View, Text, StyleSheet, Pressable, Modal, ScrollView, Dimensions } from "react-native";
import * as Haptics from "expo-haptics";
import { COLORS, BORDER_THICK, SHADOW } from "../constants/theme";
import { fromTokenUnits } from "../lib/blockchain/token-mint";

interface TokenBalance {
  symbol: string;
  balance: bigint;
  decimals: number;
  usdValue: number;
}

interface BalanceCardProps {
  tokens: TokenBalance[];
  onDetailsPress: () => void;
  onRefreshPress: () => Promise<void> | void;
  isRefreshing: boolean;
  hasLoaded: boolean;
  error?: string | null;
}

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const CARD_PADDING = 16;
const CAROUSEL_WIDTH = SCREEN_WIDTH - 80;

export function BalanceCard({
  tokens,
  onDetailsPress,
  onRefreshPress,
  isRefreshing,
  hasLoaded,
  error,
}: BalanceCardProps) {
  const [detailsPressed, setDetailsPressed] = useState(false);
  const [refreshPressed, setRefreshPressed] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const scrollViewRef = useRef<ScrollView>(null);

  const handleDetailsPress = async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    setModalVisible(true);
  };

  const handleRefreshPress = async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    await onRefreshPress();
  };

  const handleScroll = (event: any) => {
    const contentOffset = event.nativeEvent.contentOffset.x;
    const index = Math.round(contentOffset / CAROUSEL_WIDTH);
    if (index !== activeIndex && index >= 0 && index < tokens.length) {
      setActiveIndex(index);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  };

  const totalUsdValue = tokens.reduce((sum, token) => sum + token.usdValue, 0);
  const formatUsdValue = (value: number) => {
    if (value >= 1000) {
      return `$${value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    }
    return `$${value.toFixed(2)}`;
  };

  const formatTokenBalance = (token: TokenBalance) => {
    return fromTokenUnits(token.balance).toFixed(2);
  };

  const balanceHeadline = hasLoaded ? formatUsdValue(totalUsdValue) : isRefreshing ? "SYNCING..." : "PENDING...";
  const statusText = error
    ? error.toUpperCase()
    : isRefreshing
      ? "REFRESHING ALL TOKENS"
      : hasLoaded
        ? "ALL TOKENS LIVE"
        : "WAITING FOR FIRST BALANCE SYNC";

  return (
    <>
      <View style={styles.cardShadow}>
        <View style={styles.container}>
          <View style={styles.content}>
            <View style={styles.headerRow}>
              <Text style={styles.label}>Total Balance</Text>
              <View style={styles.refreshShadow}>
                <Pressable
                  onPress={handleRefreshPress}
                  onPressIn={() => setRefreshPressed(true)}
                  onPressOut={() => setRefreshPressed(false)}
                  disabled={isRefreshing}
                  style={[
                    styles.refreshButton,
                    refreshPressed && styles.refreshButtonPressed,
                    isRefreshing && styles.refreshButtonDisabled,
                  ]}
                >
                  <Text style={styles.refreshButtonText}>
                    {isRefreshing ? "SYNCING" : "REFRESH ALL"}
                  </Text>
                </Pressable>
              </View>
            </View>

            <Text style={styles.balance}>{balanceHeadline}</Text>
            
            <View style={styles.carouselContainer}>
              <ScrollView
                ref={scrollViewRef}
                horizontal
                pagingEnabled
                showsHorizontalScrollIndicator={false}
                onScroll={handleScroll}
                scrollEventThrottle={16}
                style={styles.carousel}
                contentContainerStyle={styles.carouselContent}
              >
                {tokens.map((token) => (
                  <View key={token.symbol} style={styles.tokenSlide}>
                    <View style={styles.nestedCardShadow}>
                      <View style={styles.nestedCard}>
                        <View style={styles.nestedContent}>
                          <View style={styles.tokenInfo}>
                            <Text style={styles.nestedLabel}>{token.symbol} Balance</Text>
                            <View style={styles.balanceRow}>
                              <Text style={styles.nestedBalance}>
                                {hasLoaded ? formatTokenBalance(token) : "--"}
                              </Text>
                              <Text style={styles.tokenSymbol}>{token.symbol}</Text>
                            </View>
                          </View>
                          <View style={styles.detailsShadow}>
                            <Pressable
                              onPress={handleDetailsPress}
                              onPressIn={() => setDetailsPressed(true)}
                              onPressOut={() => setDetailsPressed(false)}
                              style={[styles.detailsButton, detailsPressed && styles.detailsButtonPressed]}
                            >
                              <Text style={styles.detailsButtonText}>Details</Text>
                            </Pressable>
                          </View>
                        </View>
                      </View>
                    </View>
                  </View>
                ))}
              </ScrollView>
            </View>

            {tokens.length > 1 && (
              <View style={styles.indicatorContainer}>
                {tokens.map((_, index) => (
                  <View
                    key={index}
                    style={[styles.indicator, index === activeIndex && styles.indicatorActive]}
                  />
                ))}
              </View>
            )}

            <View style={[styles.statusStrip, error && styles.statusStripError]}>
              <Text style={styles.statusStripText}>{statusText}</Text>
            </View>
          </View>
        </View>
      </View>

      <Modal
        animationType="none"
        transparent
        visible={modalVisible}
        onRequestClose={() => setModalVisible(false)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setModalVisible(false)}>
          <Pressable style={styles.modalContent} onPress={(e) => e.stopPropagation()}>
            <View style={styles.modalShadow}>
              <View style={styles.modalCard}>
                <View style={styles.modalHeader}>
                  <Text style={styles.modalTitle}>TOKEN DETAILS</Text>
                  <Pressable
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
                      setModalVisible(false);
                    }}
                    style={styles.closeButton}
                  >
                    <Text style={styles.closeButtonText}>X</Text>
                  </Pressable>
                </View>

                <View style={styles.modalBody}>
                  <View style={styles.totalRow}>
                    <Text style={styles.totalLabel}>Total Balance</Text>
                    <Text style={styles.totalValue}>{balanceHeadline}</Text>
                  </View>

                  {tokens.map((token, index) => (
                    <View key={token.symbol} style={[styles.tokenRow, index === tokens.length - 1 && styles.tokenRowLast]}>
                      <View style={styles.tokenRowLeft}>
                        <View style={[styles.tokenIcon, token.symbol === "USDC" ? styles.usdcIcon : styles.usdtIcon]}>
                          <Text style={styles.tokenIconText}>{token.symbol.charAt(0)}</Text>
                        </View>
                        <View>
                          <Text style={styles.tokenName}>{token.symbol}</Text>
                          <Text style={styles.tokenFullName}>{token.symbol === "USDC" ? "USD Coin" : "Tether USD"}</Text>
                        </View>
                      </View>
                      <View style={styles.tokenRowRight}>
                        <Text style={styles.tokenAmount}>
                          {hasLoaded ? formatTokenBalance(token) : "--"}
                        </Text>
                        <Text style={styles.tokenFiat}>
                          {hasLoaded ? `$${token.usdValue.toFixed(2)}` : "--"}
                        </Text>
                      </View>
                    </View>
                  ))}
                </View>
              </View>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  cardShadow: {
    backgroundColor: COLORS.border,
  },
  container: {
    backgroundColor: COLORS.primaryBlue,
    borderWidth: BORDER_THICK.width,
    borderColor: COLORS.border,
    padding: 16,
    transform: [{ translateX: -8 }, { translateY: -8 }],
  },
  content: {
    gap: 4,
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 12,
  },
  label: {
    color: COLORS.textInverted,
    fontSize: 14,
    fontWeight: "900",
    textTransform: "uppercase",
    letterSpacing: 3,
  },
  balance: {
    color: COLORS.textInverted,
    fontSize: 36,
    fontWeight: "900",
    letterSpacing: -1,
  },
  refreshShadow: {
    backgroundColor: COLORS.border,
  },
  refreshButton: {
    backgroundColor: COLORS.yellow400,
    borderWidth: BORDER_THICK.width,
    borderColor: COLORS.border,
    paddingHorizontal: 12,
    paddingVertical: 8,
    transform: [{ translateX: -4 }, { translateY: -4 }],
  },
  refreshButtonPressed: {
    transform: [{ translateX: 0 }, { translateY: 0 }],
  },
  refreshButtonDisabled: {
    backgroundColor: COLORS.surface,
  },
  refreshButtonText: {
    color: COLORS.textPrimary,
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  carouselContainer: {
    marginTop: 16,
    overflow: "hidden",
  },
  carousel: {
    width: CAROUSEL_WIDTH,
  },
  carouselContent: {},
  tokenSlide: {
    width: CAROUSEL_WIDTH,
    paddingHorizontal: 8,
  },
  nestedCardShadow: {
    backgroundColor: COLORS.border,
  },
  nestedCard: {
    backgroundColor: COLORS.surface,
    borderWidth: BORDER_THICK.width,
    borderColor: COLORS.border,
    padding: 12,
    transform: [{ translateX: -4 }, { translateY: -4 }],
  },
  nestedContent: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  tokenInfo: {
    flex: 1,
  },
  nestedLabel: {
    fontSize: 12,
    fontWeight: "900",
    textTransform: "uppercase",
    color: COLORS.textMuted,
  },
  balanceRow: {
    flexDirection: "row",
    alignItems: "baseline",
    flexWrap: "wrap",
    gap: 4,
  },
  nestedBalance: {
    fontSize: 24,
    fontWeight: "900",
    fontStyle: "italic",
    color: COLORS.textPrimary,
  },
  tokenSymbol: {
    fontSize: 24,
    fontWeight: "900",
    fontStyle: "italic",
    color: COLORS.textMuted,
  },
  detailsShadow: {
    backgroundColor: COLORS.border,
    marginLeft: 12,
  },
  detailsButton: {
    backgroundColor: COLORS.yellow400,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderWidth: BORDER_THICK.width,
    borderColor: COLORS.border,
    transform: [{ translateX: -4 }, { translateY: -4 }],
  },
  detailsButtonPressed: {
    transform: [{ translateX: 0 }, { translateY: 0 }],
  },
  detailsButtonText: {
    fontSize: 14,
    fontWeight: "900",
    textTransform: "uppercase",
    color: COLORS.textPrimary,
  },
  indicatorContainer: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 8,
    marginTop: 12,
  },
  indicator: {
    width: 8,
    height: 8,
    backgroundColor: COLORS.textInverted,
    opacity: 0.4,
  },
  indicatorActive: {
    opacity: 1,
    backgroundColor: COLORS.yellow400,
  },
  statusStrip: {
    marginTop: 12,
    alignSelf: "flex-start",
    backgroundColor: COLORS.progressYellow,
    borderWidth: BORDER_THICK.width,
    borderColor: COLORS.border,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  statusStripError: {
    backgroundColor: COLORS.red500,
  },
  statusStripText: {
    color: COLORS.textPrimary,
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.6)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  modalContent: {
    width: "100%",
    maxWidth: 340,
  },
  modalShadow: {
    backgroundColor: COLORS.border,
  },
  modalCard: {
    backgroundColor: COLORS.surface,
    borderWidth: BORDER_THICK.width,
    borderColor: COLORS.border,
    transform: [{ translateX: -6 }, { translateY: -6 }],
  },
  modalHeader: {
    backgroundColor: COLORS.surfaceInverted,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderWidth: BORDER_THICK.width,
    borderColor: COLORS.border,
    borderBottomWidth: 0,
  },
  modalTitle: {
    color: COLORS.background,
    fontSize: 14,
    fontWeight: "900",
    letterSpacing: 2,
    textTransform: "uppercase",
  },
  closeButton: {
    backgroundColor: COLORS.error,
    width: 32,
    height: 32,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: BORDER_THICK.width,
    borderColor: COLORS.border,
  },
  closeButtonText: {
    color: COLORS.textInverted,
    fontSize: 16,
    fontWeight: "900",
  },
  modalBody: {
    padding: 16,
    gap: 16,
  },
  totalRow: {
    backgroundColor: COLORS.primaryBlue,
    padding: 16,
    borderWidth: BORDER_THICK.width,
    borderColor: COLORS.border,
  },
  totalLabel: {
    color: COLORS.textInverted,
    fontSize: 12,
    fontWeight: "900",
    textTransform: "uppercase",
    letterSpacing: 2,
    opacity: 0.8,
  },
  totalValue: {
    color: COLORS.textInverted,
    fontSize: 28,
    fontWeight: "900",
    marginTop: 4,
  },
  tokenRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 12,
    borderBottomWidth: BORDER_THICK.width,
    borderBottomColor: COLORS.border,
  },
  tokenRowLast: {
    borderBottomWidth: 0,
  },
  tokenRowLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  tokenRowRight: {
    alignItems: "flex-end",
  },
  tokenIcon: {
    width: 40,
    height: 40,
    borderRadius: 0,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: BORDER_THICK.width,
    borderColor: COLORS.border,
  },
  usdcIcon: {
    backgroundColor: COLORS.primaryBlue,
  },
  usdtIcon: {
    backgroundColor: COLORS.green400,
  },
  tokenIconText: {
    fontSize: 18,
    fontWeight: "900",
    color: COLORS.textInverted,
  },
  tokenName: {
    fontSize: 16,
    fontWeight: "900",
    color: COLORS.textPrimary,
    textTransform: "uppercase",
  },
  tokenFullName: {
    fontSize: 12,
    color: COLORS.textMuted,
    marginTop: 2,
  },
  tokenAmount: {
    fontSize: 18,
    fontWeight: "900",
    color: COLORS.textPrimary,
  },
  tokenFiat: {
    fontSize: 12,
    color: COLORS.textMuted,
    marginTop: 2,
  },
});
