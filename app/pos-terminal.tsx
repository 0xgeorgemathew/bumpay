import { useCallback, useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  FlatList,
  ActivityIndicator,
} from "react-native";
import { useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import { Ionicons } from "@expo/vector-icons";
import { usePrivy } from "@privy-io/expo";
import { COLORS, BORDER_THICK } from "../constants/theme";
import { useOperationalWallet } from "../lib/wallet";
import { getEnsClaimStatus } from "../lib/ens/service";
import { HomeHeader } from "../components/HomeHeader";
import { PosItemCard } from "../components/PosItemCard";
import {
  POS_ITEMS,
  formatPriceCents,
  calculateCartTotal,
  calculateCartItemCount,
  centsToTokenAmount,
  type PosItem,
} from "../constants/pos-items";

const SHADOW_OFFSET = { width: 4, height: 4 };

interface CartEntry {
  item: PosItem;
  quantity: number;
}

export default function PosTerminalScreen() {
  const router = useRouter();
  const { user, isReady: privyReady } = usePrivy();
  const { smartWalletAddress } = useOperationalWallet();

  const [merchantEnsName, setMerchantEnsName] = useState<string | null>(null);
  const [isLoadingEns, setIsLoadingEns] = useState(true);
  const [cart, setCart] = useState<Map<string, CartEntry>>(new Map());

  // Redirect to login if not authenticated
  useEffect(() => {
    if (privyReady && !user) {
      router.replace("/login");
    }
  }, [privyReady, router, user]);

  // Load merchant ENS name
  useEffect(() => {
    if (!smartWalletAddress) {
      setMerchantEnsName(null);
      setIsLoadingEns(false);
      return;
    }

    setIsLoadingEns(true);
    getEnsClaimStatus(smartWalletAddress)
      .then((status) => {
        setMerchantEnsName(status.fullName);
      })
      .catch((error) => {
        console.warn("Failed to load merchant ENS:", error);
        setMerchantEnsName(null);
      })
      .finally(() => {
        setIsLoadingEns(false);
      });
  }, [smartWalletAddress]);

  const handleIncrement = useCallback((item: PosItem) => {
    setCart((prevCart) => {
      const newCart = new Map(prevCart);
      const existing = newCart.get(item.id);
      if (existing) {
        newCart.set(item.id, { item, quantity: existing.quantity + 1 });
      } else {
        newCart.set(item.id, { item, quantity: 1 });
      }
      return newCart;
    });
  }, []);

  const handleDecrement = useCallback((item: PosItem) => {
    setCart((prevCart) => {
      const newCart = new Map(prevCart);
      const existing = newCart.get(item.id);
      if (existing) {
        if (existing.quantity <= 1) {
          newCart.delete(item.id);
        } else {
          newCart.set(item.id, { item, quantity: existing.quantity - 1 });
        }
      }
      return newCart;
    });
  }, []);

  const handleBack = async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    router.back();
  };

  const handleCheckout = async () => {
    if (cart.size === 0) return;

    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    const tokenAmount = centsToTokenAmount(calculateCartTotal(cart));
    router.push(
      `/request-payment?amount=${encodeURIComponent(tokenAmount)}&skipKeypad=true` as never
    );
  };

  const totalCents = useMemo(() => calculateCartTotal(cart), [cart]);
  const itemCount = useMemo(() => calculateCartItemCount(cart), [cart]);

  const renderItem = useCallback(
    ({ item }: { item: PosItem }) => {
      const cartEntry = cart.get(item.id);
      const quantity = cartEntry?.quantity ?? 0;
      return (
        <PosItemCard
          item={item}
          quantity={quantity}
          onIncrement={() => handleIncrement(item)}
          onDecrement={() => handleDecrement(item)}
        />
      );
    },
    [cart, handleIncrement, handleDecrement]
  );

  const keyExtractor = useCallback((item: PosItem) => item.id, []);

  const shopName = isLoadingEns
    ? "Loading..."
    : merchantEnsName
      ? merchantEnsName
      : "My Shop";

  const shopSuffix = !isLoadingEns && merchantEnsName ? "'s Shop" : "";

  return (
    <View style={styles.container}>
      {/* Home Header */}
      <HomeHeader />

      {/* Subheader with back button and shop name */}
      <View style={styles.subheader}>
        <View style={styles.backButtonShadow}>
          <Pressable onPress={handleBack} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color={COLORS.textPrimary} />
          </Pressable>
        </View>
        <View style={styles.shopNameContainer}>
          <Text style={styles.shopName} numberOfLines={1}>
            {shopName}
          </Text>
          {shopSuffix ? (
            <Text style={styles.shopSuffix} numberOfLines={1}>
              {shopSuffix}
            </Text>
          ) : null}
        </View>
        <View style={styles.headerSpacer} />
      </View>

      {/* Items List */}
      <View style={styles.listContainer}>
        <FlatList
          data={POS_ITEMS}
          renderItem={renderItem}
          keyExtractor={keyExtractor}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        />
      </View>

      {/* Bottom Section */}
      <View style={styles.bottomSection}>
        {/* Total Card */}
        <View style={styles.totalCardShadow}>
          <View style={styles.totalCard}>
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>TOTAL</Text>
              <Text style={styles.totalAmount}>{formatPriceCents(totalCents)}</Text>
            </View>
            <Text style={styles.itemCount}>
              {itemCount} item{itemCount !== 1 ? "s" : ""}
            </Text>
          </View>
        </View>

        {/* Checkout Button */}
        <View style={styles.checkoutButtonShadow}>
          <Pressable
            onPress={handleCheckout}
            disabled={cart.size === 0}
            style={({ pressed }) => [
              styles.checkoutButton,
              pressed && styles.checkoutButtonPressed,
              cart.size === 0 && styles.checkoutButtonDisabled,
            ]}
          >
            {isLoadingEns ? (
              <ActivityIndicator color={COLORS.textInverted} />
            ) : (
              <Text
                style={[
                  styles.checkoutButtonText,
                  cart.size === 0 && styles.checkoutButtonTextDisabled,
                ]}
              >
                CHECKOUT
              </Text>
            )}
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#e8f5e9", // Light green tint
  },
  subheader: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 12,
    backgroundColor: COLORS.green400,
    borderBottomWidth: BORDER_THICK.width,
    borderColor: COLORS.border,
    gap: 12,
  },
  backButtonShadow: {
    backgroundColor: COLORS.border,
  },
  backButton: {
    width: 44,
    height: 44,
    backgroundColor: COLORS.surface,
    borderWidth: BORDER_THICK.width,
    borderColor: COLORS.border,
    alignItems: "center",
    justifyContent: "center",
    transform: [{ translateX: -2 }, { translateY: -2 }],
  },
  shopNameContainer: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  shopName: {
    fontSize: 18,
    fontWeight: "900",
    color: COLORS.textInverted,
    letterSpacing: 0.5,
  },
  shopSuffix: {
    fontSize: 18,
    fontWeight: "700",
    color: COLORS.textInverted,
    opacity: 0.9,
  },
  headerSpacer: {
    width: 44,
  },
  listContainer: {
    flex: 1,
    paddingHorizontal: 16,
  },
  listContent: {
    paddingVertical: 16,
    paddingBottom: 16,
  },
  bottomSection: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 24,
    gap: 12,
    backgroundColor: "#e8f5e9",
  },
  totalCardShadow: {
    backgroundColor: COLORS.border,
  },
  totalCard: {
    backgroundColor: COLORS.green400,
    borderWidth: BORDER_THICK.width,
    borderColor: COLORS.border,
    paddingVertical: 16,
    paddingHorizontal: 20,
    transform: [{ translateX: -SHADOW_OFFSET.width }, { translateY: -SHADOW_OFFSET.height }],
  },
  totalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  totalLabel: {
    fontSize: 14,
    fontWeight: "900",
    color: COLORS.textPrimary,
    letterSpacing: 2,
  },
  totalAmount: {
    fontSize: 28,
    fontWeight: "900",
    color: COLORS.textPrimary,
  },
  itemCount: {
    fontSize: 13,
    fontWeight: "700",
    color: COLORS.textPrimary,
    marginTop: 4,
    textAlign: "right",
  },
  checkoutButtonShadow: {
    backgroundColor: COLORS.border,
  },
  checkoutButton: {
    backgroundColor: COLORS.green400,
    borderWidth: BORDER_THICK.width,
    borderColor: COLORS.border,
    paddingVertical: 18,
    alignItems: "center",
    justifyContent: "center",
    transform: [{ translateX: -SHADOW_OFFSET.width }, { translateY: -SHADOW_OFFSET.height }],
    minHeight: 58,
  },
  checkoutButtonPressed: {
    transform: [{ translateX: 0 }, { translateY: 0 }],
  },
  checkoutButtonDisabled: {
    backgroundColor: COLORS.textMuted,
  },
  checkoutButtonText: {
    fontSize: 18,
    fontWeight: "900",
    color: COLORS.textInverted,
    letterSpacing: 2,
  },
  checkoutButtonTextDisabled: {
    color: COLORS.surface,
  },
});
