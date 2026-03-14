import { View, Text, StyleSheet, Pressable } from "react-native";
import { useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import { Ionicons } from "@expo/vector-icons";
import { COLORS, BORDER_THICK } from "../../constants/theme";

const SHADOW_OFFSET = { width: 8, height: 8 };

export default function MerchantTabScreen() {
  const router = useRouter();

  const handleRequestPayment = async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    router.push("/merchant" as never);
  };

  const handlePayMerchant = async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    router.push("/pay-merchant" as never);
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>MERCHANT MODE</Text>
        <Text style={styles.subtitle}>Select an option to continue</Text>
      </View>

      <View style={styles.buttonStack}>
        {/* Request Payment Button */}
        <View style={styles.buttonShadow}>
          <Pressable
            onPress={handleRequestPayment}
            style={({ pressed }) => [
              styles.button,
              styles.requestButton,
              pressed && styles.buttonPressed,
            ]}
          >
            <View style={styles.iconContainer}>
              <Ionicons name="arrow-down" size={32} color={COLORS.textInverted} />
            </View>
            <View style={styles.buttonTextContainer}>
              <Text style={styles.buttonTitle}>REQUEST PAYMENT</Text>
              <Text style={styles.buttonSubtitle}>Receive payment from customer</Text>
            </View>
          </Pressable>
        </View>

        {/* Pay Merchant Button */}
        <View style={styles.buttonShadow}>
          <Pressable
            onPress={handlePayMerchant}
            style={({ pressed }) => [
              styles.button,
              styles.payButton,
              pressed && styles.buttonPressed,
            ]}
          >
            <View style={styles.iconContainer}>
              <Ionicons name="arrow-up" size={32} color={COLORS.textPrimary} />
            </View>
            <View style={styles.buttonTextContainer}>
              <Text style={[styles.buttonTitle, styles.payButtonTitle]}>PAY MERCHANT</Text>
              <Text style={[styles.buttonSubtitle, styles.payButtonSubtitle]}>
                Send payment to merchant
              </Text>
            </View>
          </Pressable>
        </View>
      </View>

      <View style={styles.infoBoxShadow}>
        <View style={styles.infoBox}>
          <Text style={styles.infoLabel}>HOW IT WORKS</Text>
          <Text style={styles.infoText}>
            Use NFC to process tap-to-pay transactions between merchant and customer devices.
          </Text>
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
    transform: [{ translateX: -SHADOW_OFFSET.width }, { translateY: -SHADOW_OFFSET.height }],
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
    color: COLORS.textInverted,
    letterSpacing: 1,
  },
  buttonSubtitle: {
    fontSize: 12,
    fontWeight: "700",
    color: COLORS.textInverted,
    opacity: 0.8,
  },
  payButtonTitle: {
    color: COLORS.textInverted,
  },
  payButtonSubtitle: {
    color: COLORS.textInverted,
    opacity: 0.8,
  },
  infoBoxShadow: {
    backgroundColor: COLORS.border,
  },
  infoBox: {
    backgroundColor: COLORS.surface,
    borderWidth: BORDER_THICK.width,
    borderColor: COLORS.border,
    paddingVertical: 16,
    paddingHorizontal: 20,
    transform: [{ translateX: -SHADOW_OFFSET.width }, { translateY: -SHADOW_OFFSET.height }],
  },
  infoLabel: {
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 2,
    color: COLORS.textMuted,
    marginBottom: 8,
  },
  infoText: {
    fontSize: 14,
    fontWeight: "600",
    color: COLORS.textPrimary,
    lineHeight: 20,
  },
});
