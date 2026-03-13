import { useState } from "react";
import {
  Text,
  StyleSheet,
  ViewStyle,
  TextStyle,
  Pressable,
} from "react-native";
import * as Haptics from "expo-haptics";
import { COLORS, SHADOW, BORDER_THICK, BORDER_THIN } from "../constants/theme";

interface NeoButtonProps {
  title: string;
  onPress: () => void;
  variant?:
    | "primary"
    | "secondary"
    | "tertiary"
    | "outline"
    | "success"
    | "warning"
    | "error";
  size?: "small" | "medium" | "large";
  disabled?: boolean;
  style?: ViewStyle;
  textStyle?: TextStyle;
  icon?: React.ReactNode;
  bold?: boolean;
}

const variantStyles: Record<string, ViewStyle> = {
  primary: {
    backgroundColor: COLORS.primaryAction,
    borderColor: COLORS.border,
  },
  secondary: {
    backgroundColor: COLORS.secondaryAction,
    borderColor: COLORS.border,
  },
  tertiary: {
    backgroundColor: COLORS.surfaceInverted,
    borderColor: COLORS.border,
  },
  outline: {
    backgroundColor: COLORS.surface,
    borderColor: COLORS.border,
  },
  success: {
    backgroundColor: COLORS.success,
    borderColor: COLORS.border,
  },
  warning: {
    backgroundColor: COLORS.warning,
    borderColor: COLORS.border,
  },
  error: {
    backgroundColor: COLORS.error,
    borderColor: COLORS.border,
  },
};

const textVariantStyles: Record<string, TextStyle> = {
  primary: { color: COLORS.textInverted }, // White on Black
  secondary: { color: COLORS.textPrimary }, // Black on Lime
  tertiary: { color: COLORS.textInverted },
  outline: { color: COLORS.textPrimary },
  success: { color: COLORS.textInverted },
  warning: { color: COLORS.textInverted },
  error: { color: COLORS.textInverted },
};

const sizeStyles: Record<string, ViewStyle> = {
  small: {
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  medium: {
    paddingVertical: 16,
    paddingHorizontal: 24,
  },
  large: {
    paddingVertical: 20,
    paddingHorizontal: 32,
  },
};

const textSizeStyles: Record<string, TextStyle> = {
  small: { fontSize: 14 },
  medium: { fontSize: 16 },
  large: { fontSize: 20 },
};

export function NeoButton({
  title,
  onPress,
  variant = "primary",
  size = "medium",
  disabled = false,
  style,
  textStyle,
  icon,
  bold = false,
}: NeoButtonProps) {
  const [pressed, setPressed] = useState(false);

  const handlePressIn = () => {
    setPressed(true);
  };

  const handlePressOut = () => {
    setPressed(false);
  };

  const handlePress = async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    onPress();
  };

  return (
    <Pressable
      onPress={handlePress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      disabled={disabled}
      style={[
        styles.button,
        variantStyles[variant],
        sizeStyles[size],
        disabled && styles.disabled,
        !disabled && pressed && styles.pressed,
        style,
      ]}
    >
      {icon}
      <Text
        style={[
          styles.text,
          textSizeStyles[size],
          textVariantStyles[variant],
          disabled && styles.textDisabled,
          textStyle,
        ]}
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.8}
      >
        {title}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: BORDER_THICK.width,
    shadowColor: COLORS.border,
    shadowOffset: SHADOW.md.offset,
    shadowOpacity: SHADOW.md.opacity,
    shadowRadius: SHADOW.md.radius,
    elevation: SHADOW.md.elevation,
    gap: 10,
  },
  disabled: {
    backgroundColor: COLORS.surface,
    borderColor: COLORS.border,
    borderStyle: "dashed",
    borderWidth: BORDER_THIN.width,
    shadowOffset: { width: 0, height: 0 },
    elevation: 0,
  },
  pressed: {
    transform: [
      { translateX: SHADOW.md.offset.width },
      { translateY: SHADOW.md.offset.height },
    ],
    shadowOffset: { width: 0, height: 0 },
    elevation: 0,
  },
  text: {
    fontWeight: "900",
    color: COLORS.textPrimary,
    textTransform: "uppercase",
    letterSpacing: 2,
  },
  textDisabled: {
    color: COLORS.textPrimary,
    opacity: 0.5,
  },
});
