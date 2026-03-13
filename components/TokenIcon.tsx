import { View, Text, StyleSheet } from "react-native";
import { COLORS } from "../constants/theme";

interface TokenIconProps {
  symbol: string;
  size?: number;
  backgroundColor?: string;
}

const TOKEN_COLORS: Record<string, string> = {
  USDC: COLORS.primaryBlue,
  USDT: COLORS.green400,
  ETH: "#627EEA",
  NATIVE: "#627EEA",
  BASE: "#0052FF",
};

export function TokenIcon({ symbol, size = 32, backgroundColor }: TokenIconProps) {
  const displaySymbol = symbol === "NATIVE" ? "ETH" : symbol;
  const bgColor = backgroundColor || TOKEN_COLORS[symbol] || COLORS.primaryBlue;
  const fontSize = Math.max(size * 0.4, 10);

  return (
    <View
      style={[
        styles.container,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: bgColor,
        },
      ]}
    >
      <Text style={[styles.symbol, { fontSize }]}>
        {displaySymbol.charAt(0).toUpperCase()}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: COLORS.border,
  },
  symbol: {
    color: COLORS.textInverted,
    fontWeight: "900",
  },
});
