import { View, Text, StyleSheet, ViewStyle } from "react-native";
import { COLORS, BORDER, SHADOW } from "../constants/theme";

interface LogoBoxProps {
  size?: "large" | "small";
  style?: ViewStyle;
}

export function LogoBox({ size = "large", style }: LogoBoxProps) {
  const isLarge = size === "large";

  return (
    <View
      style={[styles.container, isLarge ? styles.large : styles.small, style]}
    >
      <Text
        style={[styles.text, isLarge ? styles.textLarge : styles.textSmall]}
      >
        B
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: COLORS.surface,
    borderWidth: BORDER.width,
    borderColor: COLORS.black,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: COLORS.black,
    shadowOpacity: 1,
    shadowRadius: 0,
  },
  large: {
    width: 120,
    height: 120,
    shadowOffset: SHADOW.lg.offset,
    elevation: SHADOW.lg.elevation,
  },
  small: {
    width: 48,
    height: 48,
    shadowOffset: SHADOW.sm.offset,
    elevation: SHADOW.sm.elevation,
  },
  text: {
    fontWeight: "900",
    color: COLORS.textPrimary,
  },
  textLarge: {
    fontSize: 72,
  },
  textSmall: {
    fontSize: 28,
  },
});
