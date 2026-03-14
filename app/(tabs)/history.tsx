import { View, Text, StyleSheet, Pressable } from "react-native";
import { useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import { Ionicons } from "@expo/vector-icons";
import { COLORS, BORDER_THICK } from "../../constants/theme";

export default function HistoryScreen() {
  const router = useRouter();

  const handleRequestBitGo = async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    router.push("/merchant-bitgo" as never);
  };

  const handlePayMerchantBitGo = async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    router.push("/pay-merchant-bitgo" as never);
  };

  const handleWithdrawBitGo = async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    router.push("/merchant-bitgo-withdraw" as never);
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>MERCHANT PRIVACY</Text>
        <Text style={styles.subtitle}>bitgo powered private merchant checkout rail</Text>
      </View>

      <View style={styles.buttonStack}>
        <View style={styles.buttonShadow}>
          <Pressable
            onPress={handleRequestBitGo}
            style={({ pressed }) => [
              styles.button,
              styles.requestButton,
              pressed && styles.buttonPressed,
            ]}
          >
            <View style={styles.iconContainer}>
              <Ionicons name="shield-checkmark" size={32} color={COLORS.textPrimary} />
            </View>
            <View style={styles.buttonTextContainer}>
              <Text style={[styles.buttonTitle, styles.darkButtonTitle]}>CREATE CHECKOUT</Text>
              <Text style={[styles.buttonSubtitle, styles.darkButtonSubtitle]}>
                Generate a fresh BitGo address
              </Text>
            </View>
          </Pressable>
        </View>

        <View style={styles.buttonShadow}>
          <Pressable
            onPress={handlePayMerchantBitGo}
            style={({ pressed }) => [
              styles.button,
              styles.payButton,
              pressed && styles.buttonPressed,
            ]}
          >
            <View style={styles.iconContainer}>
              <Ionicons name="wallet" size={32} color={COLORS.textPrimary} />
            </View>
            <View style={styles.buttonTextContainer}>
              <Text style={[styles.buttonTitle, styles.darkButtonTitle]}>PAY CHECKOUT</Text>
              <Text style={[styles.buttonSubtitle, styles.darkButtonSubtitle]}>
                Tap and pay a masked merchant
              </Text>
            </View>
          </Pressable>
        </View>

        <View style={styles.buttonShadow}>
          <Pressable
            onPress={handleWithdrawBitGo}
            style={({ pressed }) => [
              styles.button,
              styles.withdrawButton,
              pressed && styles.buttonPressed,
            ]}
          >
            <View style={styles.iconContainer}>
              <Ionicons name="exit-outline" size={32} color={COLORS.textPrimary} />
            </View>
            <View style={styles.buttonTextContainer}>
              <Text style={[styles.buttonTitle, styles.darkButtonTitle]}>WITHDRAW</Text>
              <Text style={[styles.buttonSubtitle, styles.darkButtonSubtitle]}>
                Use the BitGo SDK withdraw flow
              </Text>
            </View>
          </Pressable>
        </View>

        <View style={styles.infoBoxShadow}>
          <View style={styles.infoBox}>
            <Text style={styles.infoLabel}>WHY THIS TAB</Text>
            <Text style={styles.infoText}>
              This is the merchant privacy rail. Each checkout creates a fresh BitGo receive
              address so the payer never sees the merchant treasury wallet directly.
            </Text>
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.backgroundLight,
    paddingHorizontal: 16,
    paddingTop: 40,
    paddingBottom: 16,
  },
  header: {
    marginBottom: 32,
  },
  title: {
    fontSize: 32,
    fontWeight: "900",
    color: COLORS.textPrimary,
    letterSpacing: 2,
  },
  subtitle: {
    fontSize: 14,
    fontWeight: "700",
    color: COLORS.textMuted,
    marginTop: 8,
    textTransform: "none",
  },
  buttonStack: {
    gap: 16,
    marginBottom: 32,
  },
  buttonShadow: {
    backgroundColor: COLORS.border,
  },
  button: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 20,
    paddingHorizontal: 20,
    gap: 16,
    borderWidth: BORDER_THICK.width,
    borderColor: COLORS.border,
    transform: [{ translateX: -8 }, { translateY: -8 }],
  },
  requestButton: {
    backgroundColor: COLORS.yellow400,
  },
  payButton: {
    backgroundColor: COLORS.cyan400,
  },
  withdrawButton: {
    backgroundColor: COLORS.decorativeYellow,
  },
  buttonPressed: {
    transform: [{ translateX: 0 }, { translateY: 0 }],
  },
  iconContainer: {
    width: 56,
    height: 56,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: BORDER_THICK.width,
    borderColor: COLORS.border,
    backgroundColor: COLORS.surface,
  },
  buttonTextContainer: {
    flex: 1,
    gap: 4,
  },
  buttonTitle: {
    fontSize: 18,
    fontWeight: "900",
    color: COLORS.textPrimary,
    letterSpacing: 1,
  },
  darkButtonTitle: {
    color: COLORS.textPrimary,
  },
  buttonSubtitle: {
    fontSize: 12,
    fontWeight: "700",
    color: COLORS.textPrimary,
    opacity: 0.8,
  },
  darkButtonSubtitle: {
    color: COLORS.textPrimary,
    opacity: 0.8,
  },
  infoBoxShadow: {
    backgroundColor: COLORS.border,
  },
  infoBox: {
    backgroundColor: COLORS.surface,
    borderWidth: BORDER_THICK.width,
    borderColor: COLORS.border,
    padding: 20,
    transform: [{ translateX: -8 }, { translateY: -8 }],
  },
  infoLabel: {
    fontSize: 12,
    fontWeight: "900",
    color: COLORS.textPrimary,
    letterSpacing: 2,
    marginBottom: 10,
  },
  infoText: {
    fontSize: 14,
    fontWeight: "700",
    color: COLORS.textPrimary,
    lineHeight: 22,
  },
});
