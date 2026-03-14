import { View, Text, StyleSheet, Pressable } from "react-native";
import { useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import { Ionicons } from "@expo/vector-icons";
import { COLORS, BORDER_THICK } from "../../constants/theme";
import { HomeHeader } from "../../components/HomeHeader";

const SHADOW_OFFSET = 6;

export default function MerchantTabScreen() {
  const router = useRouter();

  const handleRequestPayment = async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    router.push("/pos-terminal" as never);
  };

  const handlePayMerchant = async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    router.push("/pay-merchant" as never);
  };

  return (
    <View style={styles.container}>
      <HomeHeader />

      {/* Top Half - Request Payment */}
      <View style={styles.buttonContainer}>
        <View style={styles.buttonShadow}>
          <Pressable
            onPress={handleRequestPayment}
            style={({ pressed }) => [
              styles.button,
              styles.requestButton,
              pressed && styles.buttonPressed,
            ]}
          >
            <Ionicons name="arrow-down" size={48} color={COLORS.surface} />
            <Text style={styles.buttonTitle}>REQUEST PAYMENT</Text>
            <Text style={styles.buttonSubtitle}>Receive from customer</Text>
          </Pressable>
        </View>
      </View>

      {/* Bottom Half - Pay Merchant */}
      <View style={styles.buttonContainer}>
        <View style={styles.buttonShadow}>
          <Pressable
            onPress={handlePayMerchant}
            style={({ pressed }) => [
              styles.button,
              styles.payButton,
              pressed && styles.buttonPressed,
            ]}
          >
            <Ionicons name="arrow-up" size={48} color={COLORS.surface} />
            <Text style={styles.buttonTitle}>PAY MERCHANT</Text>
            <Text style={styles.buttonSubtitle}>Send to merchant</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.backgroundLight,
  },
  buttonContainer: {
    flex: 1,
    padding: 16,
    justifyContent: "center",
  },
  buttonShadow: {
    flex: 1,
    backgroundColor: COLORS.border,
  },
  button: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    borderWidth: BORDER_THICK.width,
    borderColor: COLORS.border,
    transform: [{ translateX: -SHADOW_OFFSET }, { translateY: -SHADOW_OFFSET }],
  },
  requestButton: {
    backgroundColor: COLORS.green400,
  },
  payButton: {
    backgroundColor: COLORS.primaryBlue,
  },
  buttonPressed: {
    transform: [{ translateX: 0 }, { translateY: 0 }],
  },
  buttonTitle: {
    fontSize: 28,
    fontWeight: "900",
    color: COLORS.surface,
    letterSpacing: 2,
    textAlign: "center",
    textShadowColor: COLORS.border,
    textShadowOffset: { width: 2, height: 2 },
    textShadowRadius: 0,
  },
  buttonSubtitle: {
    fontSize: 15,
    fontWeight: "700",
    color: COLORS.surface,
    textAlign: "center",
    textShadowColor: COLORS.border,
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 0,
  },
});
