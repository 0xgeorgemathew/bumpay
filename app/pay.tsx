import { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
} from "react-native";
import { useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import { COLORS, BORDER_THICK } from "../constants/theme";
import { useOperationalWallet } from "../lib/wallet";

const KEYPAD_ROWS = [
  ["1", "2", "3"],
  ["4", "5", "6"],
  ["7", "8", "9"],
  [".", "0", "backspace"],
];

export default function PayScreen() {
  const router = useRouter();
  const wallet = useOperationalWallet();
  const [amount, setAmount] = useState("");
  const [pressedKey, setPressedKey] = useState<string | null>(null);
  const [confirmPressed, setConfirmPressed] = useState(false);
  const [backPressed, setBackPressed] = useState(false);

  const handleKeyPress = async (key: string) => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);

    if (key === "backspace") {
      setAmount((prev) => prev.slice(0, -1));
      return;
    }

    if (key === ".") {
      if (amount.includes(".")) {
        return;
      }
      if (amount === "") {
        setAmount("0.");
        return;
      }
      setAmount((prev) => prev + ".");
      return;
    }

    if (amount.includes(".")) {
      const decimals = amount.split(".")[1] || "";
      if (decimals.length >= 2) {
        return;
      }
    }

    if (amount === "0" && key !== ".") {
      setAmount(key);
      return;
    }

    if (amount.length >= 10) {
      return;
    }

    setAmount((prev) => prev + key);
  };

  const handleConfirm = async () => {
    if (!amount || parseFloat(amount) <= 0) {
      return;
    }
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    router.push(`/pay-nfc?amount=${amount}` as const);
  };

  const handleBack = async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    router.back();
  };

  const formattedAmount = amount
    ? parseFloat(amount).toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 2 })
    : "0";

  const isConfirmDisabled = !wallet.isReady || !amount || parseFloat(amount) <= 0;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.backButtonShadow}>
          <Pressable
            onPress={handleBack}
            onPressIn={() => setBackPressed(true)}
            onPressOut={() => setBackPressed(false)}
            style={[styles.backButton, backPressed && styles.buttonPressed]}
          >
            <Text style={styles.backIcon}>←</Text>
          </Pressable>
        </View>
        <Text style={styles.title}>Bump Wallet</Text>
        <View style={styles.placeholder} />
      </View>

      <View style={styles.amountSection}>
        <View style={styles.amountBoxShadow}>
          <View style={styles.amountBox}>
            <Text style={styles.amountLabel}>PAY AMOUNT</Text>
            <Text style={styles.amountText}>
              {formattedAmount}
            </Text>
          </View>
        </View>
      </View>

      {!wallet.isReady ? (
        <View style={styles.statusShadow}>
          <View style={styles.statusCard}>
            <Text style={styles.statusTitle}>
              {wallet.status === "error" ? "WALLET SETUP FAILED" : "WALLET STILL PROVISIONING"}
            </Text>
            <Text style={styles.statusText}>
              {wallet.error ??
                (wallet.status === "creating_embedded"
                  ? "Creating your embedded wallet signer."
                  : "Waiting for your smart wallet to finish deploying.")}
            </Text>
            {wallet.status === "error" ? (
              <Pressable onPress={wallet.retryProvisioning} style={styles.retryButton}>
                <Text style={styles.retryText}>RETRY</Text>
              </Pressable>
            ) : null}
          </View>
        </View>
      ) : null}

      <View style={styles.keypad}>
        {KEYPAD_ROWS.map((row, rowIndex) => (
          <View key={rowIndex} style={styles.keypadRow}>
            {row.map((key) => (
              <View key={key} style={styles.keyButtonShadow}>
                <Pressable
                  onPress={() => handleKeyPress(key)}
                  onPressIn={() => setPressedKey(key)}
                  onPressOut={() => setPressedKey(null)}
                  style={[
                    styles.keyButton,
                    key === "backspace" && styles.backspaceButton,
                    pressedKey === key && styles.keyPressed,
                  ]}
                >
                  {key === "backspace" ? (
                    <Text style={styles.backspaceIcon}>⌫</Text>
                  ) : (
                    <Text style={styles.keyText}>{key}</Text>
                  )}
                </Pressable>
              </View>
            ))}
          </View>
        ))}
      </View>

      <View style={styles.confirmSection}>
        <View style={styles.confirmButtonShadow}>
          <Pressable
            onPress={handleConfirm}
            onPressIn={() => !isConfirmDisabled && setConfirmPressed(true)}
            onPressOut={() => setConfirmPressed(false)}
            disabled={isConfirmDisabled}
            style={[
              styles.confirmButton,
              isConfirmDisabled && styles.confirmDisabled,
              confirmPressed && !isConfirmDisabled && styles.confirmPressed,
            ]}
          >
            <Text style={styles.confirmText}>
              CONFIRM
            </Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.green400,
    paddingHorizontal: 16,
    paddingTop: 60,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 32,
  },
  backButtonShadow: {
    backgroundColor: COLORS.border,
  },
  backButton: {
    backgroundColor: COLORS.surface,
    borderWidth: BORDER_THICK.width,
    borderColor: COLORS.border,
    padding: 8,
    transform: [{ translateX: -4 }, { translateY: -4 }],
  },
  backIcon: {
    fontSize: 24,
    fontWeight: "900",
    color: COLORS.textPrimary,
  },
  buttonPressed: {
    transform: [{ translateX: 0 }, { translateY: 0 }],
  },
  title: {
    fontSize: 24,
    fontWeight: "900",
    color: COLORS.textPrimary,
    letterSpacing: -1,
    fontStyle: "italic",
    textTransform: "uppercase",
  },
  placeholder: {
    width: 44,
  },
  amountSection: {
    alignItems: "center",
    marginBottom: 32,
  },
  amountBoxShadow: {
    backgroundColor: COLORS.border,
    width: "100%",
  },
  amountBox: {
    backgroundColor: COLORS.surface,
    borderWidth: BORDER_THICK.width,
    borderColor: COLORS.border,
    paddingVertical: 24,
    paddingHorizontal: 32,
    width: "100%",
    alignItems: "center",
    transform: [{ translateX: -8 }, { translateY: -8 }],
  },
  amountLabel: {
    fontSize: 12,
    fontWeight: "900",
    letterSpacing: 2,
    color: COLORS.textMuted,
    textAlign: "center",
    marginBottom: 6,
  },
  amountText: {
    fontSize: 48,
    fontWeight: "900",
    fontStyle: "italic",
    color: COLORS.textPrimary,
    textAlign: "center",
  },
  keypad: {
    width: "100%",
    marginBottom: 24,
  },
  statusShadow: {
    backgroundColor: COLORS.border,
    marginBottom: 24,
  },
  statusCard: {
    backgroundColor: COLORS.yellow400,
    borderWidth: BORDER_THICK.width,
    borderColor: COLORS.border,
    padding: 16,
    gap: 8,
    transform: [{ translateX: -6 }, { translateY: -6 }],
  },
  statusTitle: {
    fontSize: 14,
    fontWeight: "900",
    color: COLORS.textPrimary,
    letterSpacing: 1,
  },
  statusText: {
    fontSize: 13,
    fontWeight: "700",
    color: COLORS.textPrimary,
    lineHeight: 18,
  },
  retryButton: {
    alignSelf: "flex-start",
    backgroundColor: COLORS.surface,
    borderWidth: BORDER_THICK.width,
    borderColor: COLORS.border,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  retryText: {
    fontSize: 11,
    fontWeight: "900",
    color: COLORS.textPrimary,
    letterSpacing: 1,
  },
  keypadRow: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 12,
  },
  keyButtonShadow: {
    flex: 1,
    backgroundColor: COLORS.border,
  },
  keyButton: {
    aspectRatio: 1.5,
    backgroundColor: COLORS.surface,
    borderWidth: BORDER_THICK.width,
    borderColor: COLORS.border,
    alignItems: "center",
    justifyContent: "center",
    transform: [{ translateX: -4 }, { translateY: -4 }],
  },
  backspaceButton: {
    backgroundColor: COLORS.pink400,
  },
  keyText: {
    fontSize: 32,
    fontWeight: "900",
    color: COLORS.textPrimary,
  },
  backspaceIcon: {
    fontSize: 32,
    fontWeight: "900",
    color: COLORS.textPrimary,
  },
  keyPressed: {
    transform: [{ translateX: 0 }, { translateY: 0 }],
  },
  confirmSection: {
    width: "100%",
    marginBottom: 24,
  },
  confirmButtonShadow: {
    backgroundColor: COLORS.border,
  },
  confirmButton: {
    backgroundColor: COLORS.green400,
    borderWidth: BORDER_THICK.width,
    borderColor: COLORS.border,
    paddingVertical: 20,
    alignItems: "center",
    transform: [{ translateX: -8 }, { translateY: -8 }],
  },
  confirmText: {
    fontSize: 24,
    fontWeight: "900",
    color: COLORS.textPrimary,
    fontStyle: "italic",
    letterSpacing: 4,
    textTransform: "uppercase",
  },
  confirmDisabled: {
    transform: [{ translateX: 0 }, { translateY: 0 }],
    opacity: 0.5,
  },
  confirmPressed: {
    transform: [{ translateX: 0 }, { translateY: 0 }],
  },
});
