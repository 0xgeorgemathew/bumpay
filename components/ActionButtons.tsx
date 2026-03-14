import { useState } from "react";
import { View, Text, StyleSheet, Pressable } from "react-native";
import * as Haptics from "expo-haptics";
import { Ionicons } from "@expo/vector-icons";
import { COLORS, BORDER_THICK } from "../constants/theme";

interface ActionButtonsProps {
  onPay: () => void;
  onReceive: () => void;
  payDisabled?: boolean;
  receiveDisabled?: boolean;
}

export function ActionButtons({
  onPay,
  onReceive,
  payDisabled = false,
  receiveDisabled = false,
}: ActionButtonsProps) {
  const [payPressed, setPayPressed] = useState(false);
  const [receivePressed, setReceivePressed] = useState(false);

  const handlePay = async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    onPay();
  };

  const handleReceive = async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    onReceive();
  };

  return (
    <View style={styles.container}>
      <View style={styles.buttonShadow}>
        <Pressable
          onPress={handlePay}
          onPressIn={() => setPayPressed(true)}
          onPressOut={() => setPayPressed(false)}
          disabled={payDisabled}
          style={[
            styles.button,
            styles.payButton,
            payDisabled && styles.buttonDisabled,
            payPressed && styles.buttonPressed,
          ]}
        >
          <Ionicons name="cash" size={28} color={COLORS.textPrimary} />
          <Text style={[styles.buttonText, styles.payButtonText]}>PAY</Text>
        </Pressable>
      </View>
      <View style={styles.buttonShadow}>
        <Pressable
          onPress={handleReceive}
          onPressIn={() => setReceivePressed(true)}
          onPressOut={() => setReceivePressed(false)}
          disabled={receiveDisabled}
          style={[
            styles.button,
            styles.receiveButton,
            receiveDisabled && styles.buttonDisabled,
            receivePressed && styles.buttonPressed,
          ]}
        >
          <Ionicons name="arrow-down" size={28} color={COLORS.textInverted} />
          <Text style={[styles.buttonText, styles.receiveButtonText]}>RECEIVE</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    gap: 12,
  },
  buttonShadow: {
    flex: 1,
    backgroundColor: COLORS.border,
  },
  button: {
    paddingVertical: 16,
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    borderWidth: BORDER_THICK.width,
    borderColor: COLORS.border,
    transform: [{ translateX: -6 }, { translateY: -6 }],
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  payButton: {
    backgroundColor: COLORS.green400,
  },
  receiveButton: {
    backgroundColor: COLORS.primaryBlue,
  },
  buttonPressed: {
    transform: [{ translateX: 0 }, { translateY: 0 }],
  },
  buttonText: {
    fontSize: 14,
    fontWeight: "900",
    textTransform: "uppercase",
    fontStyle: "italic",
  },
  payButtonText: {
    color: COLORS.textPrimary,
  },
  receiveButtonText: {
    color: COLORS.textInverted,
  },
});
