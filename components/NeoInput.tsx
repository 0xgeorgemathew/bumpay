import { useState, useRef, useEffect } from "react";
import {
  TextInput,
  View,
  Text,
  StyleSheet,
  Animated,
  ViewStyle,
} from "react-native";
import * as Haptics from "expo-haptics";
import { COLORS, SHADOW, BORDER_THIN, BORDER_THICK } from "../constants/theme";

export type NeoInputProps = React.ComponentProps<typeof TextInput> & {
  label?: string;
  error?: string | null;
  containerStyle?: ViewStyle;
  variant?: "default" | "filled";
  disabled?: boolean;
};

type TextInputFocusEvent = Parameters<
  NonNullable<React.ComponentProps<typeof TextInput>["onFocus"]>
>[0];
type TextInputBlurEvent = Parameters<
  NonNullable<React.ComponentProps<typeof TextInput>["onBlur"]>
>[0];

export function NeoInput({
  label,
  error,
  containerStyle,
  variant = "default",
  disabled,
  ...props
}: NeoInputProps) {
  const [isFocused, setIsFocused] = useState(false);
  const shakeAnim = useRef(new Animated.Value(0)).current;
  const prevError = useRef<string | null | undefined>(null);

  // Track error changes for shake animation
  useEffect(() => {
    if (error && error !== prevError.current) {
      shake();
    }
    prevError.current = error;
  }, [error, disabled]);

  const handleFocus = (event: TextInputFocusEvent) => {
    if (disabled) return;
    setIsFocused(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    props.onFocus?.(event);
  };

  const handleBlur = (event: TextInputBlurEvent) => {
    if (disabled) return;
    setIsFocused(false);
    props.onBlur?.(event);
  };

  const shake = () => {
    Animated.sequence([
      Animated.timing(shakeAnim, {
        toValue: 10,
        duration: 50,
        useNativeDriver: true,
      }),
      Animated.timing(shakeAnim, {
        toValue: -10,
        duration: 50,
        useNativeDriver: true,
      }),
      Animated.timing(shakeAnim, {
        toValue: 10,
        duration: 50,
        useNativeDriver: true,
      }),
      Animated.timing(shakeAnim, {
        toValue: 0,
        duration: 50,
        useNativeDriver: true,
      }),
    ]).start();
  };

  return (
    <View style={[styles.container, containerStyle]}>
      {label && (
        <View style={styles.labelContainer}>
          <Text style={[styles.label, disabled && styles.textDisabled]}>
            {label}
          </Text>
        </View>
      )}
      <Animated.View
        style={[
          styles.inputWrapper,
          variant === "filled" && styles.inputFilled,
          isFocused && styles.inputFocused,
          error && styles.inputError,
          disabled && styles.inputDisabled,
          {
            transform: [{ translateX: shakeAnim }],
          },
        ]}
      >
        <TextInput
          {...props}
          editable={!disabled}
          style={[
            styles.input,
            props.multiline && styles.inputMultiline,
            disabled && styles.textDisabled,
          ]}
          placeholderTextColor={disabled ? COLORS.textPrimary : COLORS.border}
          onFocus={handleFocus}
          onBlur={handleBlur}
          selectionColor={COLORS.primaryAction}
        />
      </Animated.View>
      {error && (
        <Animated.View style={styles.errorBox}>
          <Text style={styles.errorText}>⚠ {error}</Text>
        </Animated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 20,
  },
  labelContainer: {
    backgroundColor: COLORS.surfaceInverted,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: BORDER_THIN.width,
    borderColor: COLORS.border,
    marginBottom: -2,
    zIndex: 1,
    alignSelf: "flex-start",
  },
  label: {
    fontSize: 12,
    fontWeight: "900",
    color: COLORS.background, // contrasting yellow on black
    textTransform: "uppercase",
    letterSpacing: 2,
  },
  inputWrapper: {
    backgroundColor: COLORS.surface,
    borderWidth: BORDER_THIN.width,
    borderColor: COLORS.border,
    shadowColor: COLORS.border,
    shadowOffset: SHADOW.sm.offset,
    shadowOpacity: SHADOW.sm.opacity,
    shadowRadius: SHADOW.sm.radius,
    elevation: SHADOW.sm.elevation,
  },
  inputFilled: {
    backgroundColor: COLORS.background,
  },
  inputFocused: {
    backgroundColor: COLORS.surface,
    borderWidth: BORDER_THICK.width,
    borderColor: COLORS.primaryAction,
    shadowColor: COLORS.border,
    shadowOffset: SHADOW.sm.offset,
    elevation: SHADOW.sm.elevation,
  },
  inputError: {
    borderColor: COLORS.error,
    backgroundColor: COLORS.surface,
    borderWidth: BORDER_THICK.width,
    shadowColor: COLORS.error,
    shadowOffset: SHADOW.sm.offset,
    elevation: SHADOW.sm.elevation,
  },
  inputDisabled: {
    backgroundColor: COLORS.surface,
    borderStyle: "dashed",
    borderWidth: BORDER_THIN.width,
    shadowOffset: { width: 0, height: 0 },
    elevation: 0,
  },
  input: {
    padding: 16,
    fontSize: 16,
    fontWeight: "800",
    color: COLORS.textPrimary,
  },
  inputMultiline: {
    minHeight: 100,
    textAlignVertical: "top",
  },
  textDisabled: {
    opacity: 0.5,
  },
  errorBox: {
    marginTop: 10,
    padding: 12,
    backgroundColor: COLORS.error,
    borderWidth: BORDER_THICK.width,
    borderColor: COLORS.border,
    shadowColor: COLORS.border,
    shadowOffset: SHADOW.sm.offset,
    shadowOpacity: SHADOW.sm.opacity,
    shadowRadius: SHADOW.sm.radius,
    elevation: SHADOW.sm.elevation,
  },
  errorText: {
    color: COLORS.textInverted,
    fontWeight: "900",
    fontSize: 14,
    textTransform: "uppercase",
    letterSpacing: 1,
  },
});
