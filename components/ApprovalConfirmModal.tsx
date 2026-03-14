import { useState } from "react";
import { View, Text, StyleSheet, Modal, Pressable } from "react-native";
import * as Haptics from "expo-haptics";
import { COLORS, SHADOW, BORDER_THICK, BORDER_THIN } from "../constants/theme";

interface ApprovalConfirmModalProps {
  visible: boolean;
  tokenSymbol: string;
  amountLabel: string;
  isUnlimited: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  isLoading?: boolean;
}

export function ApprovalConfirmModal({
  visible,
  tokenSymbol,
  amountLabel,
  isUnlimited,
  onConfirm,
  onCancel,
  isLoading = false,
}: ApprovalConfirmModalProps) {
  const [cancelPressed, setCancelPressed] = useState(false);
  const [confirmPressed, setConfirmPressed] = useState(false);

  const handleConfirm = async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    onConfirm();
  };

  const handleCancel = async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    onCancel();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={handleCancel}
    >
      <View style={styles.overlay}>
        <View style={styles.cardShadow}>
          <View style={styles.card}>
            <Text style={styles.title}>CONFIRM APPROVAL</Text>

            <View style={styles.amountContainer}>
              {isUnlimited ? (
                <Text style={styles.infinitySymbol}>∞</Text>
              ) : (
                <Text style={styles.amountText}>{amountLabel}</Text>
              )}
              <Text style={styles.tokenSymbol}>{tokenSymbol}</Text>
            </View>

            <Text style={styles.description}>
              {isUnlimited
                ? "Grant unlimited spending allowance to the payment verifier."
                : `Allow the verifier to spend up to ${amountLabel} ${tokenSymbol}.`}
            </Text>

            <View style={styles.buttons}>
              <Pressable
                onPress={handleCancel}
                onPressIn={() => setCancelPressed(true)}
                onPressOut={() => setCancelPressed(false)}
                disabled={isLoading}
                style={[
                  styles.button,
                  styles.cancelButton,
                  !isLoading && cancelPressed && styles.buttonPressed,
                  isLoading && styles.buttonDisabled,
                ]}
              >
                <Text style={styles.cancelText}>CANCEL</Text>
              </Pressable>

              <Pressable
                onPress={handleConfirm}
                onPressIn={() => setConfirmPressed(true)}
                onPressOut={() => setConfirmPressed(false)}
                disabled={isLoading}
                style={[
                  styles.button,
                  styles.confirmButton,
                  !isLoading && confirmPressed && styles.buttonPressed,
                  isLoading && styles.buttonDisabled,
                ]}
              >
                <Text style={styles.confirmText}>
                  {isLoading ? "PENDING..." : "CONFIRM"}
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.7)",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  cardShadow: {
    backgroundColor: COLORS.border,
    width: "100%",
    maxWidth: 340,
  },
  card: {
    backgroundColor: COLORS.yellow400,
    borderWidth: BORDER_THICK.width,
    borderColor: COLORS.border,
    padding: 20,
    gap: 20,
    transform: [{ translateX: -8 }, { translateY: -8 }],
  },
  title: {
    fontSize: 14,
    fontWeight: "900",
    letterSpacing: 2,
    color: COLORS.textPrimary,
    textAlign: "center",
  },
  amountContainer: {
    alignItems: "center",
    gap: 4,
  },
  infinitySymbol: {
    fontSize: 64,
    fontWeight: "900",
    color: COLORS.textPrimary,
  },
  amountText: {
    fontSize: 40,
    fontWeight: "900",
    color: COLORS.textPrimary,
  },
  tokenSymbol: {
    fontSize: 18,
    fontWeight: "900",
    letterSpacing: 1,
    color: COLORS.textPrimary,
  },
  description: {
    fontSize: 13,
    fontWeight: "700",
    color: COLORS.textPrimary,
    textAlign: "center",
    lineHeight: 18,
    opacity: 0.8,
  },
  buttons: {
    flexDirection: "row",
    gap: 12,
  },
  button: {
    flex: 1,
    paddingVertical: 14,
    borderWidth: BORDER_THICK.width,
    borderColor: COLORS.border,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: COLORS.border,
    shadowOffset: SHADOW.sm.offset,
    shadowOpacity: SHADOW.sm.opacity,
    shadowRadius: SHADOW.sm.radius,
    elevation: SHADOW.sm.elevation,
  },
  cancelButton: {
    backgroundColor: COLORS.surface,
  },
  confirmButton: {
    backgroundColor: COLORS.green400,
  },
  buttonPressed: {
    transform: [
      { translateX: SHADOW.sm.offset.width },
      { translateY: SHADOW.sm.offset.height },
    ],
    shadowOffset: { width: 0, height: 0 },
    elevation: 0,
  },
  cancelText: {
    fontSize: 14,
    fontWeight: "900",
    letterSpacing: 1,
    color: COLORS.textPrimary,
  },
  confirmText: {
    fontSize: 14,
    fontWeight: "900",
    letterSpacing: 1,
    color: COLORS.textPrimary,
  },
  buttonDisabled: {
    backgroundColor: COLORS.backgroundLight,
    borderStyle: "dashed",
    borderWidth: BORDER_THIN.width,
    shadowOffset: { width: 0, height: 0 },
    elevation: 0,
    opacity: 0.6,
  },
});
