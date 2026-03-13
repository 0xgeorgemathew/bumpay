import { useState } from "react";
import { View, Text, StyleSheet, Pressable } from "react-native";
import * as Clipboard from "expo-clipboard";
import * as Haptics from "expo-haptics";
import { COLORS, BORDER_THICK, SHADOW } from "../constants/theme";

interface WalletCardProps {
  embeddedAddress?: string;
  smartAddress?: string;
  isProvisioningSmartWallet?: boolean;
}

export function WalletCard({
  embeddedAddress,
  smartAddress,
  isProvisioningSmartWallet = false,
}: WalletCardProps) {
  const [copied, setCopied] = useState(false);

  const formatAddress = (address?: string) =>
    address ? `${address.slice(0, 6)}...${address.slice(-4)}` : "N/A";

  const primaryAddress = smartAddress || embeddedAddress;

  const handleCopy = async () => {
    if (!primaryAddress) return;
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await Clipboard.setStringAsync(primaryAddress);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!primaryAddress && !isProvisioningSmartWallet) {
    return null;
  }

  return (
    <View style={styles.container}>
      <Text style={styles.label}>SMART: </Text>
      <Text style={styles.address}>
        {isProvisioningSmartWallet
          ? "CREATING..."
          : formatAddress(primaryAddress)}
      </Text>
      <Pressable onPress={handleCopy} style={styles.copyButton}>
        <Text style={styles.copyText}>{copied ? "COPIED" : "COPY"}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.surface,
    paddingLeft: 12,
    borderWidth: BORDER_THICK.width,
    borderColor: COLORS.border,
    marginBottom: 24,
    shadowColor: COLORS.border,
    shadowOffset: SHADOW.sm.offset,
    shadowOpacity: SHADOW.sm.opacity,
    shadowRadius: SHADOW.sm.radius,
    elevation: SHADOW.sm.elevation,
  },
  label: {
    fontWeight: "900",
    fontSize: 12,
    color: COLORS.textPrimary,
    letterSpacing: 2,
  },
  address: {
    flex: 1,
    fontWeight: "700",
    fontSize: 12,
    color: COLORS.textPrimary,
  },
  copyButton: {
    backgroundColor: COLORS.surfaceInverted,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderLeftWidth: BORDER_THICK.width,
    borderLeftColor: COLORS.border,
  },
  copyText: {
    color: COLORS.textInverted,
    fontWeight: "900",
    fontSize: 10,
    letterSpacing: 1,
  },
});
