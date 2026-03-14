import { View, Text, StyleSheet, Pressable } from "react-native";
import * as Haptics from "expo-haptics";
import { COLORS, BORDER_THICK } from "../constants/theme";
import type { PosItem } from "../constants/pos-items";
import { formatPriceCents } from "../constants/pos-items";

const SHADOW_OFFSET = { width: 4, height: 4 };

interface PosItemCardProps {
  item: PosItem;
  quantity: number;
  onIncrement: () => void;
  onDecrement: () => void;
}

function QuantityButtonIcon({ type }: { type: "increment" | "decrement" }) {
  return (
    <View style={styles.quantityIcon}>
      <View style={styles.quantityIconHorizontal} />
      {type === "increment" ? <View style={styles.quantityIconVertical} /> : null}
    </View>
  );
}

/**
 * POS Item Card with neobrutalism styling
 * Displays item details with quantity controls
 *
 * Layout: [Icon 36px] | [$Price 50px] | [Name (flex)] | [Qty 90px]
 */
export function PosItemCard({
  item,
  quantity,
  onIncrement,
  onDecrement,
}: PosItemCardProps) {
  const handleIncrement = async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    onIncrement();
  };

  const handleDecrement = async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    onDecrement();
  };

  return (
    <View style={styles.cardShadow}>
      <View style={styles.card}>
        {/* Icon Container */}
        <View style={styles.iconContainer}>
          <Text style={styles.iconText}>{item.icon}</Text>
        </View>

        {/* Price - fixed width, left-aligned */}
        <Text style={styles.price}>{formatPriceCents(item.priceCents)}</Text>

        {/* Item Name - flex to take available space */}
        <Text style={styles.name}>
          {item.name}
        </Text>

        {/* Quantity Controls */}
        <View style={styles.quantityContainer}>
          <View style={styles.buttonShadow}>
            <Pressable
              onPress={handleDecrement}
              style={({ pressed }) => [
                styles.quantityButton,
                styles.decrementButton,
                pressed && styles.buttonPressed,
              ]}
            >
              <QuantityButtonIcon type="decrement" />
            </Pressable>
          </View>
          <View style={styles.quantityDisplay}>
            <Text style={styles.quantityText}>{quantity}</Text>
          </View>
          <View style={styles.buttonShadow}>
            <Pressable
              onPress={handleIncrement}
              style={({ pressed }) => [
                styles.quantityButton,
                styles.incrementButton,
                pressed && styles.buttonPressed,
              ]}
            >
              <QuantityButtonIcon type="increment" />
            </Pressable>
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  cardShadow: {
    backgroundColor: COLORS.border,
    marginBottom: 12,
  },
  card: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.surface,
    borderWidth: BORDER_THICK.width,
    borderColor: COLORS.border,
    padding: 8,
    gap: 6,
    transform: [{ translateX: -SHADOW_OFFSET.width }, { translateY: -SHADOW_OFFSET.height }],
    marginLeft: SHADOW_OFFSET.width,
  },
  iconContainer: {
    width: 36,
    height: 36,
    backgroundColor: COLORS.green400,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: BORDER_THICK.width,
    borderColor: COLORS.border,
  },
  iconText: {
    fontSize: 18,
  },
  name: {
    flex: 1,
    fontSize: 14,
    fontWeight: "800",
    color: COLORS.textPrimary,
    letterSpacing: 0.3,
  },
  price: {
    fontSize: 14,
    fontWeight: "900",
    color: COLORS.textPrimary,
    width: 50,
    textAlign: "left",
  },
  quantityContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    width: 90,
    overflow: "visible",
  },
  buttonShadow: {
    backgroundColor: COLORS.border,
  },
  quantityButton: {
    width: 28,
    height: 28,
    borderWidth: BORDER_THICK.width,
    borderColor: COLORS.border,
    alignItems: "center",
    justifyContent: "center",
    transform: [{ translateX: -2 }, { translateY: -2 }],
  },
  decrementButton: {
    backgroundColor: COLORS.surface,
  },
  incrementButton: {
    backgroundColor: COLORS.green400,
  },
  buttonPressed: {
    transform: [{ translateX: 0 }, { translateY: 0 }],
  },
  quantityIcon: {
    width: 14,
    height: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  quantityIconHorizontal: {
    position: "absolute",
    width: 14,
    height: 3,
    backgroundColor: COLORS.textPrimary,
  },
  quantityIconVertical: {
    position: "absolute",
    width: 3,
    height: 14,
    backgroundColor: COLORS.textPrimary,
  },
  quantityDisplay: {
    minWidth: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  quantityText: {
    fontSize: 16,
    fontWeight: "900",
    color: COLORS.green400,
  },
});
