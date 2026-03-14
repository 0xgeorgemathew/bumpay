import { useState } from "react";
import { View, Text, StyleSheet, Pressable, ScrollView } from "react-native";
import * as Haptics from "expo-haptics";
import { Ionicons } from "@expo/vector-icons";
import { COLORS, BORDER_THICK } from "../constants/theme";
import { useTransactions } from "../lib/transaction-context";

export function TransactionList() {
  const [isExpanded, setIsExpanded] = useState(false);
  const [viewAllPressed, setViewAllPressed] = useState(false);
  const { state } = useTransactions();

  const handleViewAll = async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setIsExpanded(!isExpanded);
  };

  const formatAmount = (amount: number, isPositive: boolean) => {
    const prefix = isPositive ? "+" : "-";
    const absAmount = Math.abs(amount);
    return `${prefix}$${absAmount.toFixed(2)}`;
  };

  const displayCount = isExpanded ? state.transactions.length : 5;
  const transactions = state.transactions.slice(0, displayCount);
  const hasMore = state.transactions.length > 5;
  const buttonText = isExpanded ? "Show Less" : "View All";

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Recent Activity</Text>
        {hasMore && (
          <Pressable
            onPress={handleViewAll}
            onPressIn={() => setViewAllPressed(true)}
            onPressOut={() => setViewAllPressed(false)}
            style={viewAllPressed && styles.viewAllPressed}
          >
            <Text style={styles.viewAll}>{buttonText}</Text>
          </Pressable>
        )}
      </View>
      <ScrollView
        style={[styles.listContainer, isExpanded && styles.listContainerExpanded]}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
      >
        {transactions.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>No transactions yet</Text>
            <Text style={styles.emptySubtext}>
              Your payment history will appear here
            </Text>
          </View>
        ) : (
          transactions.map((tx) => (
            <View key={tx.id} style={styles.txCardShadow}>
              <View style={styles.txCard}>
                <View style={styles.txLeft}>
                  <View
                    style={[styles.txIconContainer, { backgroundColor: tx.iconBgColor }]}
                  >
                    <Ionicons
                      name={tx.iconName}
                      size={20}
                      color={COLORS.textPrimary}
                    />
                  </View>
                  <View style={styles.txInfo}>
                    <Text style={styles.txName}>{tx.name}</Text>
                    <Text style={styles.txDate}>{tx.date}</Text>
                  </View>
                </View>
                <Text style={[styles.txAmount, tx.isPositive && styles.txAmountPositive]}>
                  {formatAmount(tx.amount, tx.isPositive)}
                </Text>
              </View>
            </View>
          ))
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 12,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
  },
  title: {
    fontSize: 18,
    fontWeight: "900",
    textTransform: "uppercase",
    fontStyle: "italic",
    color: COLORS.textPrimary,
  },
  viewAll: {
    fontSize: 14,
    fontWeight: "700",
    textDecorationLine: "underline",
    textDecorationColor: COLORS.primaryBlue,
    color: COLORS.textPrimary,
  },
  viewAllPressed: {
    opacity: 0.6,
  },
  listContainer: {
    maxHeight: 200,
  },
  listContainerExpanded: {
    maxHeight: 400,
  },
  listContent: {
    gap: 12,
    paddingTop: 4,
    paddingLeft: 4,
  },
  emptyState: {
    paddingVertical: 24,
    alignItems: "center",
    gap: 4,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: "900",
    color: COLORS.textMuted,
  },
  emptySubtext: {
    fontSize: 14,
    fontWeight: "700",
    color: COLORS.textMuted,
  },
  txCardShadow: {
    backgroundColor: COLORS.border,
    marginRight: 4,
  },
  txCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: COLORS.surface,
    borderWidth: BORDER_THICK.width,
    borderColor: COLORS.border,
    padding: 12,
    transform: [{ translateX: -4 }, { translateY: -4 }],
  },
  txLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    flex: 1,
  },
  txIconContainer: {
    width: 40,
    height: 40,
    borderWidth: BORDER_THICK.width,
    borderColor: COLORS.border,
    alignItems: "center",
    justifyContent: "center",
  },
  txInfo: {
    gap: 2,
  },
  txName: {
    fontSize: 14,
    fontWeight: "900",
    color: COLORS.textPrimary,
  },
  txDate: {
    fontSize: 12,
    fontWeight: "700",
    color: COLORS.textMuted,
  },
  txAmount: {
    fontSize: 14,
    fontWeight: "900",
    color: COLORS.red500,
  },
  txAmountPositive: {
    color: COLORS.green400,
  },
});
