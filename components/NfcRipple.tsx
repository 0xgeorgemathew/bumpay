import React, { useEffect, useRef } from "react";
import { View, StyleSheet, Animated } from "react-native";
import { COLORS, BORDER_THICK } from "../constants/theme";

interface NfcRippleProps {
  color: string;
  isAnimating: boolean;
}

export function NfcRipple({ color, isAnimating }: NfcRippleProps) {
  // We'll use 3 concentric rings
  const ring1 = useRef(new Animated.Value(0)).current;
  const ring2 = useRef(new Animated.Value(0)).current;
  const ring3 = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!isAnimating) {
      ring1.setValue(0);
      ring2.setValue(0);
      ring3.setValue(0);
      return;
    }

    const createRippleAnim = (animValue: Animated.Value, delay: number) => {
      return Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.parallel([
            Animated.timing(animValue, {
              toValue: 1,
              duration: 2000,
              useNativeDriver: true,
            }),
          ]),
        ]),
      );
    };

    const anim1 = createRippleAnim(ring1, 0);
    const anim2 = createRippleAnim(ring2, 600);
    const anim3 = createRippleAnim(ring3, 1200);

    anim1.start();
    anim2.start();
    anim3.start();

    return () => {
      anim1.stop();
      anim2.stop();
      anim3.stop();
    };
  }, [isAnimating, ring1, ring2, ring3]);

  const getRingStyle = (animValue: Animated.Value) => {
    return {
      transform: [
        {
          scale: animValue.interpolate({
            inputRange: [0, 1],
            outputRange: [1, 3], // Scale from 1x to 3x size
          }),
        },
      ],
      opacity: animValue.interpolate({
        inputRange: [0, 0.8, 1],
        outputRange: [1, 0.2, 0], // Hard visible, then fade out at the very end
      }),
    };
  };

  return (
    <View style={styles.container}>
      {isAnimating && (
        <>
          <Animated.View
            style={[styles.ring, { borderColor: color }, getRingStyle(ring3)]}
          />
          <Animated.View
            style={[styles.ring, { borderColor: color }, getRingStyle(ring2)]}
          />
          <Animated.View
            style={[styles.ring, { borderColor: color }, getRingStyle(ring1)]}
          />
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    zIndex: -1, // Ensure rings go behind the main icon
    pointerEvents: "none",
  },
  ring: {
    position: "absolute",
    width: 160, // Matches the size of the nfcIcon in Pay/Receive
    height: 160,
    borderRadius: 80,
    borderWidth: BORDER_THICK.width,
    backgroundColor: "transparent",
  },
});
