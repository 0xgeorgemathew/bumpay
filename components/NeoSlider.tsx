import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Animated, LayoutChangeEvent, PanResponder, StyleSheet, Text, View } from "react-native";
import * as Haptics from "expo-haptics";
import { BORDER_THICK, COLORS, SHADOW } from "../constants/theme";

export type NeoSliderValue =
  | { mode: "finite"; amount: number }
  | { mode: "unlimited" };

interface NeoSliderProps {
  value: NeoSliderValue;
  onChange: (value: NeoSliderValue) => void;
  onRelease?: (value: NeoSliderValue) => void;
  disabled?: boolean;
  min?: number;
  max?: number;
}

const TRACK_TOUCH_HEIGHT = 56;
const TRACK_HEIGHT = 14;
const THUMB_SIZE = 28;
const UNLIMITED_ZONE_RATIO = 0.1;
const FINITE_TRACK_RATIO = 1 - UNLIMITED_ZONE_RATIO;
const MARKERS = [
  { label: "0", progress: 0 },
  { label: "250", progress: 0.225 },
  { label: "500", progress: 0.45 },
  { label: "750", progress: 0.675 },
  { label: "1K", progress: 0.9 },
  { label: "∞", progress: 1 },
] as const;

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function normalizeFiniteAmount(amount: number, min: number, max: number) {
  return Math.round(clamp(amount, min, max));
}

function normalizeValue(value: NeoSliderValue, min: number, max: number): NeoSliderValue {
  if (value.mode === "unlimited") {
    return { mode: "unlimited" };
  }

  return {
    mode: "finite",
    amount: normalizeFiniteAmount(value.amount, min, max),
  };
}

function valuesMatch(left: NeoSliderValue, right: NeoSliderValue) {
  if (left.mode !== right.mode) {
    return false;
  }

  if (left.mode === "unlimited" && right.mode === "unlimited") {
    return true;
  }

  if (left.mode !== "finite" || right.mode !== "finite") {
    return false;
  }

  return left.amount === right.amount;
}

export function NeoSlider({
  value,
  onChange,
  onRelease,
  disabled = false,
  min = 0,
  max = 1000,
}: NeoSliderProps) {
  const animatedX = useRef(new Animated.Value(0)).current;
  const latestValueRef = useRef<NeoSliderValue>(normalizeValue(value, min, max));
  const trackWidthRef = useRef(0);
  const dragStartXRef = useRef(0);
  const disabledRef = useRef(disabled);
  const [trackWidth, setTrackWidth] = useState(0);
  const [isDragging, setIsDragging] = useState(false);

  disabledRef.current = disabled;

  const getUsableWidth = useCallback(() => {
    return Math.max(trackWidthRef.current - THUMB_SIZE, 0);
  }, []);

  const valueToProgress = useCallback(
    (nextValue: NeoSliderValue) => {
      if (nextValue.mode === "unlimited") {
        return 1;
      }

      const normalizedRange = max === min ? 0 : (nextValue.amount - min) / (max - min);
      return clamp(normalizedRange, 0, 1) * FINITE_TRACK_RATIO;
    },
    [max, min],
  );

  const progressToValue = useCallback(
    (progress: number): NeoSliderValue => {
      const clampedProgress = clamp(progress, 0, 1);

      if (clampedProgress > FINITE_TRACK_RATIO) {
        return { mode: "unlimited" };
      }

      const normalizedRange = FINITE_TRACK_RATIO === 0 ? 0 : clampedProgress / FINITE_TRACK_RATIO;
      const amount = min + normalizedRange * (max - min);

      return {
        mode: "finite",
        amount: normalizeFiniteAmount(amount, min, max),
      };
    },
    [max, min],
  );

  const valueToX = useCallback(
    (nextValue: NeoSliderValue) => {
      return valueToProgress(nextValue) * getUsableWidth();
    },
    [getUsableWidth, valueToProgress],
  );

  const updateFromX = useCallback(
    (nextX: number) => {
      const usableWidth = getUsableWidth();
      const clampedX = clamp(nextX, 0, usableWidth);
      const progress = usableWidth === 0 ? 0 : clampedX / usableWidth;
      const nextValue = progressToValue(progress);
      const previousValue = latestValueRef.current;

      animatedX.setValue(clampedX);

      if (!valuesMatch(previousValue, nextValue)) {
        latestValueRef.current = nextValue;

        if (previousValue.mode !== nextValue.mode) {
          Haptics.selectionAsync().catch(() => undefined);
        }

        onChange(nextValue);
      }
    },
    [animatedX, getUsableWidth, onChange, progressToValue],
  );

  useEffect(() => {
    const normalized = normalizeValue(value, min, max);
    latestValueRef.current = normalized;

    if (!isDragging && trackWidthRef.current > 0) {
      Animated.spring(animatedX, {
        toValue: valueToX(normalized),
        damping: 20,
        stiffness: 240,
        mass: 0.8,
        useNativeDriver: false,
      }).start();
    }
  }, [animatedX, isDragging, max, min, value, valueToX]);

  const handleLayout = useCallback(
    (event: LayoutChangeEvent) => {
      const { width } = event.nativeEvent.layout;
      trackWidthRef.current = width;
      setTrackWidth(width);
      animatedX.setValue(valueToX(normalizeValue(value, min, max)));
    },
    [animatedX, max, min, value, valueToX],
  );

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => !disabledRef.current,
        onMoveShouldSetPanResponder: () => !disabledRef.current,

        onPanResponderGrant: (event) => {
          const currentX = valueToX(latestValueRef.current);
          const touchX = clamp(
            event.nativeEvent.locationX - THUMB_SIZE / 2,
            0,
            getUsableWidth(),
          );
          const shouldJump = Math.abs(touchX - currentX) > THUMB_SIZE;

          dragStartXRef.current = shouldJump ? touchX : currentX;
          setIsDragging(true);
          Haptics.selectionAsync().catch(() => undefined);
          updateFromX(dragStartXRef.current);
        },

        onPanResponderMove: (_, gestureState) => {
          updateFromX(dragStartXRef.current + gestureState.dx);
        },

        onPanResponderRelease: () => {
          setIsDragging(false);
          const finalValue = latestValueRef.current;

          Animated.spring(animatedX, {
            toValue: valueToX(finalValue),
            damping: 20,
            stiffness: 240,
            mass: 0.8,
            useNativeDriver: false,
          }).start();

          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => undefined);
          onRelease?.(finalValue);
        },

        onPanResponderTerminate: () => {
          setIsDragging(false);

          Animated.spring(animatedX, {
            toValue: valueToX(latestValueRef.current),
            damping: 20,
            stiffness: 240,
            mass: 0.8,
            useNativeDriver: false,
          }).start();
        },
      }),
    [animatedX, getUsableWidth, onRelease, updateFromX, valueToX],
  );

  const thumbStyle = {
    transform: [{ translateX: animatedX }],
  };

  const fillWidth = Animated.add(animatedX, THUMB_SIZE / 2);

  return (
    <View style={styles.container}>
      <View style={styles.trackTouchArea} onLayout={handleLayout} {...panResponder.panHandlers}>
        <View style={[styles.track, disabled && styles.trackDisabled]}>
          <View style={styles.unlimitedZone} />
          <Animated.View style={[styles.fill, { width: fillWidth }]} />
          <Animated.View
            style={[
              styles.thumb,
              disabled && styles.thumbDisabled,
              isDragging && styles.thumbDragging,
              thumbStyle,
            ]}
          >
            <View style={styles.thumbInner} />
          </Animated.View>
        </View>
      </View>

      <View style={styles.markers}>
        {MARKERS.map((marker) => {
          const left = trackWidth <= 0 ? 0 : marker.progress * Math.max(trackWidth - 1, 0);

          return (
            <View
              key={marker.label}
              style={[
                styles.marker,
                marker.label === "0" && styles.markerStart,
                marker.label === "∞" && styles.markerEnd,
                marker.label !== "0" &&
                  marker.label !== "∞" && {
                    left,
                    transform: [{ translateX: -18 }],
                  },
              ]}
            >
              <Text style={styles.markerLabel}>{marker.label}</Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: "100%",
    gap: 10,
  },
  trackTouchArea: {
    height: TRACK_TOUCH_HEIGHT,
    justifyContent: "center",
  },
  track: {
    height: TRACK_HEIGHT,
    backgroundColor: COLORS.surface,
    borderWidth: BORDER_THICK.width,
    borderColor: COLORS.border,
    overflow: "visible",
  },
  trackDisabled: {
    opacity: 0.5,
  },
  unlimitedZone: {
    position: "absolute",
    top: -BORDER_THICK.width,
    right: -BORDER_THICK.width,
    bottom: -BORDER_THICK.width,
    width: `${UNLIMITED_ZONE_RATIO * 100}%`,
    backgroundColor: COLORS.yellow400,
    borderLeftWidth: BORDER_THICK.width,
    borderLeftColor: COLORS.border,
    borderStyle: "dashed",
  },
  fill: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    backgroundColor: COLORS.cyan400,
  },
  thumb: {
    position: "absolute",
    top: -(THUMB_SIZE - TRACK_HEIGHT) / 2 - BORDER_THICK.width / 2,
    width: THUMB_SIZE,
    height: THUMB_SIZE,
    backgroundColor: COLORS.green400,
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
  thumbDragging: {
    backgroundColor: COLORS.pink400,
  },
  thumbDisabled: {
    backgroundColor: COLORS.backgroundLight,
  },
  thumbInner: {
    width: 12,
    height: 4,
    backgroundColor: COLORS.border,
  },
  markers: {
    position: "relative",
    height: 16,
  },
  marker: {
    position: "absolute",
    top: 0,
  },
  markerStart: {
    left: 0,
  },
  markerEnd: {
    right: 0,
  },
  markerLabel: {
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 1,
    color: COLORS.textPrimary,
  },
});
