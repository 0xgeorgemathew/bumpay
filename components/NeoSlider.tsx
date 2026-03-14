import { useRef, useCallback, useEffect, useState, useMemo } from "react";
import { View, StyleSheet, PanResponder, Animated, LayoutChangeEvent } from "react-native";
import * as Haptics from "expo-haptics";
import { COLORS, SHADOW, BORDER_THICK } from "../constants/theme";

export interface SliderStep {
  value: bigint;
  label: string;
}

interface NeoSliderProps {
  steps: Array<SliderStep>;
  value: bigint;
  onChange: (value: bigint) => void;
  onRelease?: (value: bigint) => void;
  disabled?: boolean;
}

const THUMB_SIZE = 32;  // Was 28 (too small for reliable touch), was 40 (original)
const TRACK_HEIGHT = 36; // Was 32, was 48 (original)

export function NeoSlider({
  steps,
  value,
  onChange,
  onRelease,
  disabled = false,
}: NeoSliderProps) {
  const trackWidth = useRef(0);
  const trackOffsetX = useRef(0);
  const animatedX = useRef(new Animated.Value(0)).current;
  const [isDragging, setIsDragging] = useState(false);
  const currentStepIndex = useRef(0);
  const initialThumbX = useRef(0);

  // Keep disabled value in a ref to avoid recreating PanResponder
  const disabledRef = useRef(disabled);
  disabledRef.current = disabled;

  // Find current step index from value
  const findStepIndex = useCallback(
    (val: bigint) => {
      const index = steps.findIndex((step) => step.value === val);
      return index >= 0 ? index : 0;
    },
    [steps],
  );

  const getThumbPosition = useCallback(
    (stepIndex: number) => {
      if (trackWidth.current <= 0) return 0;
      const usableWidth = trackWidth.current - THUMB_SIZE;
      const stepWidth = usableWidth / Math.max(1, steps.length - 1);
      return stepIndex * stepWidth;
    },
    [steps.length],
  );

  const getIndexFromPosition = useCallback(
    (x: number) => {
      if (trackWidth.current <= 0) return 0;
      const usableWidth = trackWidth.current - THUMB_SIZE;
      const stepWidth = usableWidth / Math.max(1, steps.length - 1);
      const index = Math.round(x / stepWidth);
      return Math.max(0, Math.min(steps.length - 1, index));
    },
    [steps.length],
  );

  // Update thumb position when value changes externally
  useEffect(() => {
    if (!isDragging && trackWidth.current > 0) {
      const index = findStepIndex(value);
      currentStepIndex.current = index;
      const position = getThumbPosition(index);
      animatedX.setValue(position);
    }
  }, [value, findStepIndex, getThumbPosition, animatedX, isDragging]);

  const handleLayout = useCallback((event: LayoutChangeEvent) => {
    trackWidth.current = event.nativeEvent.layout.width;
    // Set initial position after layout
    const index = findStepIndex(value);
    currentStepIndex.current = index;
    const position = getThumbPosition(index);
    animatedX.setValue(position);
  }, [value, findStepIndex, getThumbPosition, animatedX]);

  // Create PanResponder once - use ref to check disabled state
  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => !disabledRef.current,
        onMoveShouldSetPanResponder: () => !disabledRef.current,

        onPanResponderGrant: (evt) => {
          // Record track position and initial thumb position
          trackOffsetX.current = evt.nativeEvent.locationX;
          initialThumbX.current = getThumbPosition(currentStepIndex.current);
          setIsDragging(true);
        },

        onPanResponderMove: (_, gestureState) => {
          // Calculate new position using delta from gesture start
          const newX = Math.max(
            0,
            Math.min(trackWidth.current - THUMB_SIZE, initialThumbX.current + gestureState.dx)
          );
          const newIndex = getIndexFromPosition(newX);

          if (newIndex !== currentStepIndex.current) {
            currentStepIndex.current = newIndex;
            onChange(steps[newIndex].value);
          }

          animatedX.setValue(getThumbPosition(newIndex));
        },

        onPanResponderRelease: () => {
          setIsDragging(false);
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
          onRelease?.(steps[currentStepIndex.current].value);
        },

        onPanResponderTerminate: () => {
          setIsDragging(false);
          // Reset to current value position
          const index = findStepIndex(value);
          currentStepIndex.current = index;
          Animated.spring(animatedX, {
            toValue: getThumbPosition(index),
            useNativeDriver: true,
          }).start();
        },
      }),
    [getIndexFromPosition, getThumbPosition, onChange, onRelease, steps, findStepIndex, value, animatedX],
  );

  const thumbAnimatedStyle = {
    transform: [{ translateX: animatedX }],
  };

  const thumbShadowStyle = isDragging
    ? { shadowOffset: { width: 0, height: 0 } as const, elevation: 0 }
    : { shadowOffset: SHADOW.sm.offset, shadowOpacity: SHADOW.sm.opacity, shadowRadius: SHADOW.sm.radius, elevation: SHADOW.sm.elevation };

  return (
    <View style={styles.container}>
      <View style={styles.trackContainer} onLayout={handleLayout}>
        <View style={[styles.track, disabled && styles.trackDisabled]}>
          <Animated.View
            style={[
              styles.thumb,
              disabled && styles.thumbDisabled,
              isDragging && styles.thumbDragging,
              thumbAnimatedStyle,
              thumbShadowStyle,
            ]}
            hitSlop={{ top: 8, bottom: 8, left: 12, right: 12 }}
            {...panResponder.panHandlers}
          >
            <View style={styles.thumbInner} />
          </Animated.View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: "100%",
    height: TRACK_HEIGHT,
  },
  trackContainer: {
    width: "100%",
    height: TRACK_HEIGHT,
  },
  track: {
    height: TRACK_HEIGHT,
    backgroundColor: COLORS.surface,
    borderWidth: BORDER_THICK.width,
    borderColor: COLORS.border,
    justifyContent: "center",
  },
  trackDisabled: {
    backgroundColor: COLORS.backgroundLight,
    borderStyle: "dashed",
  },
  thumb: {
    position: "absolute",
    width: THUMB_SIZE,
    height: THUMB_SIZE,
    backgroundColor: COLORS.green400,
    borderWidth: BORDER_THICK.width,
    borderColor: COLORS.border,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: COLORS.border,
    shadowOpacity: 1,
  },
  thumbDragging: {
    backgroundColor: COLORS.yellow400,
  },
  thumbDisabled: {
    backgroundColor: COLORS.backgroundLight,
    borderStyle: "dashed",
  },
  thumbInner: {
    width: 12,
    height: 3,
    backgroundColor: COLORS.border,
  },
});
