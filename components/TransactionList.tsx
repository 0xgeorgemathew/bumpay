import { useState } from "react";
import { View, Text, StyleSheet, Pressable, ScrollView } from "react-native";
import * as Haptics from "expo-haptics";
import { Ionicons } from "@expo/vector-icons";
import { COLORS, BORDER_THICK } from "../constants/theme";

interface Transaction {
  id: string;
  name: string;
  date: string;
  amount: number;
  isPositive: boolean;
  iconName: keyof typeof Ionicons.glyphMap;
  iconBgColor: string;
}

const MOCK_TRANSACTIONS: Transaction[] = [
  {
    id: "1",
    name: "Coffee Shop",
    date: "Today, 09:41 AM",
    amount: -4.5,
    isPositive: false,
    iconName: "cafe",
    iconBgColor: COLORS.pink400,
  },
  {
    id: "2",
    name: "Alex Rivera",
    date: "Yesterday",
    amount: 120.0,
    isPositive: true,
    iconName: "person",
    iconBgColor: COLORS.cyan400,
  },
  {
    id: "3",
    name: "Uber Ride",
    date: "Mar 5, 2024",
    amount: -15.75,
    isPositive: false,
    iconName: "car",
    iconBgColor: COLORS.decorativeOrange,
  },
  {
    id: "4",
    name: "Salary Deposit",
    date: "Mar 1, 2024",
    amount: 2500.0,
    isPositive: true,
    iconName: "wallet",
    iconBgColor: COLORS.green400,
  },
  {
    id: "5",
    name: "Netflix",
    date: "Feb 28, 2024",
    amount: -15.99,
    isPositive: false,
    iconName: "film",
    iconBgColor: COLORS.red500,
  },
];

interface TransactionListProps {
  onViewAll?: () => void;
}

export function TransactionList({ onViewAll }: TransactionListProps) {
  const [viewAllPressed, setViewAllPressed] = useState(false);

  const handleViewAll = async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onViewAll?.();
  };

  const formatAmount = (amount: number, isPositive: boolean) => {
    const prefix = isPositive ? "+" : "-";
    const absAmount = Math.abs(amount);
    return `${prefix}$${absAmount.toFixed(2)}`;
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Recent Activity</Text>
        <Pressable
          onPress={handleViewAll}
          onPressIn={() => setViewAllPressed(true)}
          onPressOut={() => setViewAllPressed(false)}
          style={viewAllPressed && styles.viewAllPressed}
        >
          <Text style={styles.viewAll}>View All</Text>
        </Pressable>
      </View>
      <ScrollView
        style={styles.listContainer}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
      >
        {MOCK_TRANSACTIONS.map((tx) => (
          <View key={tx.id} style={styles.txCardShadow}>
            <View style={styles.txCard}>
              <View style={styles.txLeft}>
                <View style={[styles.txIconContainer, { backgroundColor: tx.iconBgColor }]}>
                  <Ionicons name={tx.iconName} size={20} color={COLORS.textPrimary} />
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
         ))}
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
  listContent: {
    gap: 12,
    paddingTop: 4,
    paddingLeft: 4,
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
