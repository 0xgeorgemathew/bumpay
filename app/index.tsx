import { useCallback, useEffect, useRef, useState } from "react";
import { View, Text, StyleSheet, Dimensions, Animated, Easing } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { usePrivy } from "@privy-io/expo";
import { COLORS, BORDER_THICK } from "../constants/theme";
import { useBalance } from "../lib/balance-context";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");

export default function SplashScreen() {
  const router = useRouter();
  const { isReady, user } = usePrivy();
  const { state: balanceState, prefetchBalance } = useBalance();
  const [displayPercentage, setDisplayPercentage] = useState(0);
  const [animationComplete, setAnimationComplete] = useState(false);
  const [initializationComplete, setInitializationComplete] = useState(false);
  const hasNavigated = useRef(false);
  
  const logoScale = useRef(new Animated.Value(0.3)).current;
  const logoOpacity = useRef(new Animated.Value(0)).current;
  const logoRotate = useRef(new Animated.Value(-30)).current;
  
  const bumpScale = useRef(new Animated.Value(0)).current;
  const bumpOpacity = useRef(new Animated.Value(0)).current;
  
  const walletScale = useRef(new Animated.Value(0)).current;
  const walletOpacity = useRef(new Animated.Value(0)).current;
  
  const progressWidth = useRef(new Animated.Value(0)).current;
  const progressOpacity = useRef(new Animated.Value(0)).current;
  
  const footerOpacity = useRef(new Animated.Value(0)).current;
  
  const decor1Opacity = useRef(new Animated.Value(0)).current;
  const decor1Scale = useRef(new Animated.Value(0)).current;
  const decor2Opacity = useRef(new Animated.Value(0)).current;
  const decor2Scale = useRef(new Animated.Value(0)).current;
  const decor3Opacity = useRef(new Animated.Value(0)).current;
  const decor3Scale = useRef(new Animated.Value(0)).current;
  const decor4Opacity = useRef(new Animated.Value(0)).current;
  const decor4Scale = useRef(new Animated.Value(0)).current;

  const handleNavigation = useCallback(() => {
    if (hasNavigated.current) return;
    hasNavigated.current = true;
    
    if (isReady && user) {
      router.replace("/(tabs)");
    } else {
      router.replace("/login");
    }
  }, [isReady, router, user]);

  useEffect(() => {
    setInitializationComplete(false);

    if (!isReady) {
      return;
    }

    let cancelled = false;

    const initializeApp = async () => {
      if (user) {
        await prefetchBalance({ waitForWallet: true });
      }

      if (!cancelled) {
        setInitializationComplete(true);
      }
    };

    initializeApp();

    return () => {
      cancelled = true;
    };
  }, [isReady, user, prefetchBalance]);

  useEffect(() => {
    if (!animationComplete || !initializationComplete || !isReady) {
      return;
    }

    handleNavigation();
  }, [animationComplete, handleNavigation, initializationComplete, isReady]);

  useEffect(() => {
    const smoothEasing = Easing.bezier(0.25, 0.1, 0.25, 1);
    
    const createSmoothSpring = (animValue: Animated.Value, delay: number) => {
      return Animated.sequence([
        Animated.delay(delay),
        Animated.spring(animValue, {
          toValue: 1,
          friction: 8,
          tension: 100,
          useNativeDriver: true,
        }),
      ]);
    };

    const decor1 = Animated.parallel([
      Animated.timing(decor1Opacity, { toValue: 1, duration: 800, delay: 200, easing: smoothEasing, useNativeDriver: true }),
      createSmoothSpring(decor1Scale, 200),
    ]);
    
    const decor2 = Animated.parallel([
      Animated.timing(decor2Opacity, { toValue: 1, duration: 800, delay: 400, easing: smoothEasing, useNativeDriver: true }),
      createSmoothSpring(decor2Scale, 400),
    ]);
    
    const decor3 = Animated.parallel([
      Animated.timing(decor3Opacity, { toValue: 1, duration: 800, delay: 600, easing: smoothEasing, useNativeDriver: true }),
      createSmoothSpring(decor3Scale, 600),
    ]);
    
    const decor4 = Animated.parallel([
      Animated.timing(decor4Opacity, { toValue: 1, duration: 800, delay: 800, easing: smoothEasing, useNativeDriver: true }),
      createSmoothSpring(decor4Scale, 800),
    ]);
    
    const logo = Animated.parallel([
      Animated.timing(logoOpacity, { toValue: 1, duration: 1000, delay: 300, easing: smoothEasing, useNativeDriver: true }),
      Animated.spring(logoScale, {
        toValue: 1,
        friction: 8,
        tension: 80,
        delay: 300,
        useNativeDriver: true,
      }),
      Animated.timing(logoRotate, {
        toValue: 3,
        duration: 1200,
        delay: 300,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]);
    
    const bump = Animated.parallel([
      Animated.timing(bumpOpacity, { toValue: 1, duration: 800, delay: 800, easing: smoothEasing, useNativeDriver: true }),
      Animated.spring(bumpScale, {
        toValue: 1,
        friction: 7,
        tension: 60,
        delay: 800,
        useNativeDriver: true,
      }),
    ]);
    
    const wallet = Animated.parallel([
      Animated.timing(walletOpacity, { toValue: 1, duration: 800, delay: 1100, easing: smoothEasing, useNativeDriver: true }),
      Animated.spring(walletScale, {
        toValue: 1,
        friction: 7,
        tension: 60,
        delay: 1100,
        useNativeDriver: true,
      }),
    ]);
    
    const progress = Animated.parallel([
      Animated.timing(progressOpacity, { toValue: 1, duration: 800, delay: 1400, easing: smoothEasing, useNativeDriver: true }),
      Animated.timing(progressWidth, {
        toValue: 100,
        duration: 3000,
        delay: 1400,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: false,
      }),
    ]);
    
    const footer = Animated.timing(footerOpacity, {
      toValue: 1,
      duration: 1000,
      delay: 1800,
      easing: smoothEasing,
      useNativeDriver: true,
    });

    const mainAnimation = Animated.parallel([
      decor1,
      decor2,
      decor3,
      decor4,
      logo,
      bump,
      wallet,
      progress,
      footer,
    ]);

    mainAnimation.start((result) => {
      if (result.finished) {
        setAnimationComplete(true);
      }
    });

    const percentageInterval = setInterval(() => {
      setDisplayPercentage(prev => {
        if (prev >= 100) {
          clearInterval(percentageInterval);
          return 100;
        }
        return prev + 1;
      });
    }, 30);

    return () => {
      mainAnimation.stop();
      clearInterval(percentageInterval);
    };
  }, []);

  const logoRotateStr = logoRotate.interpolate({
    inputRange: [-30, 3],
    outputRange: ['-30deg', '3deg'],
  });

  const statusLabel = !isReady
    ? "BOOTING PRIVY"
    : user
      ? balanceState.isLoading || !initializationComplete
        ? "SYNCING ALL BALANCES"
        : "BALANCES READY"
      : "READY TO LOGIN";

  return (
    <View style={styles.container}>
      <Animated.View style={[
        styles.decorSquare, 
        styles.decor1, 
        { 
          opacity: decor1Opacity,
          transform: [{ scale: decor1Scale }] 
        }
      ]} />
      <Animated.View style={[
        styles.decorCircle, 
        styles.decor2, 
        { 
          opacity: decor2Opacity,
          transform: [{ scale: decor2Scale }] 
        }
      ]} />
      <Animated.View style={[
        styles.decorSquareSmall, 
        styles.decor3, 
        { 
          opacity: decor3Opacity,
          transform: [{ scale: decor3Scale }] 
        }
      ]} />
      <Animated.View style={[
        styles.decorSquare, 
        styles.decor4, 
        { 
          opacity: decor4Opacity,
          transform: [{ scale: decor4Scale }] 
        }
      ]} />

      <View style={styles.contentContainer}>
        <Animated.View style={[
          styles.logoContainer, 
          { 
            opacity: logoOpacity,
            transform: [
              { scale: logoScale },
              { rotate: logoRotateStr }
            ]
          }
        ]}>
          <View style={styles.logoBox}>
            <Ionicons name="wallet" size={80} color={COLORS.textPrimary} />
          </View>
        </Animated.View>

        <View style={styles.brandContainer}>
          <Animated.View style={[
            styles.bumpContainer, 
            { 
              opacity: bumpOpacity,
              transform: [
                { scale: bumpScale },
                { rotate: '-2deg' }
              ]
            }
          ]}>
            <Text style={styles.bumpText}>BUMP</Text>
          </Animated.View>
          
          <Animated.View style={[
            styles.walletContainer, 
            { 
              opacity: walletOpacity,
              transform: [
                { scale: walletScale },
                { rotate: '1deg' }
              ]
            }
          ]}>
            <Text style={styles.walletText}>WALLET</Text>
          </Animated.View>
        </View>

        <Animated.View style={[styles.progressSection, { opacity: progressOpacity }]}>
          <View style={styles.progressHeader}>
            <View style={styles.loadingLabelContainer}>
              <Text style={styles.loadingLabel}>Loading Assets...</Text>
            </View>
            <Text style={styles.percentageText}>{Math.min(displayPercentage, 100)}%</Text>
          </View>
          <View style={styles.progressBarContainer}>
            <Animated.View style={[styles.progressBarFill, { width: progressWidth.interpolate({
              inputRange: [0, 100],
              outputRange: ['0%', '100%'],
            }) }]} />
          </View>
        </Animated.View>
      </View>

      <Animated.View style={[styles.footer, { opacity: footerOpacity }]}>
        <View style={styles.footerTextContainer}>
          <Text style={styles.footerText}>SECURED BY BUMP PROTOCOL</Text>
        </View>
        <View style={styles.statusTextContainer}>
          <Text style={styles.statusText}>{statusLabel}</Text>
        </View>
        <View style={styles.footerIcons}>
          <Ionicons name="shield-checkmark" size={20} color={COLORS.textPrimary} />
          <Ionicons name="flash" size={20} color={COLORS.textPrimary} />
          <Ionicons name="lock-closed" size={20} color={COLORS.textPrimary} />
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.primaryBlue,
  },
  contentContainer: {
    alignItems: "center",
    gap: 32,
  },
  logoContainer: {
    marginBottom: 8,
  },
  logoBox: {
    backgroundColor: COLORS.surface,
    borderWidth: BORDER_THICK.width,
    borderColor: COLORS.border,
    padding: 28,
    shadowColor: COLORS.black,
    shadowOffset: { width: 8, height: 8 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 8,
  },
  brandContainer: {
    alignItems: "center",
    gap: 16,
  },
  bumpContainer: {
    backgroundColor: COLORS.black,
    paddingHorizontal: 32,
    paddingVertical: 16,
    shadowColor: COLORS.black,
    shadowOffset: { width: 8, height: 8 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 8,
  },
  bumpText: {
    fontSize: 64,
    fontWeight: "900",
    color: COLORS.white,
    letterSpacing: -2,
    textTransform: "uppercase",
  },
  walletContainer: {
    backgroundColor: COLORS.surface,
    borderWidth: BORDER_THICK.width,
    borderColor: COLORS.border,
    paddingHorizontal: 24,
    paddingVertical: 8,
    shadowColor: COLORS.black,
    shadowOffset: { width: 8, height: 8 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 8,
  },
  walletText: {
    fontSize: 24,
    fontWeight: "700",
    color: COLORS.textPrimary,
    letterSpacing: 6,
    textTransform: "uppercase",
  },
  progressSection: {
    width: 256,
    marginTop: 32,
  },
  progressHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    marginBottom: 8,
  },
  loadingLabelContainer: {
    backgroundColor: COLORS.progressYellow,
    borderWidth: 2,
    borderColor: COLORS.border,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  loadingLabel: {
    fontSize: 14,
    fontWeight: "900",
    color: COLORS.textPrimary,
    textTransform: "uppercase",
    fontStyle: "italic",
  },
  percentageText: {
    fontSize: 18,
    fontWeight: "900",
    color: COLORS.textPrimary,
  },
  progressBarContainer: {
    height: 32,
    width: "100%",
    backgroundColor: COLORS.surface,
    borderWidth: BORDER_THICK.width,
    borderColor: COLORS.border,
    padding: 4,
    overflow: "hidden",
  },
  progressBarFill: {
    height: "100%",
    backgroundColor: COLORS.black,
  },
  footer: {
    position: "absolute",
    bottom: 40,
    alignItems: "center",
    gap: 8,
  },
  footerTextContainer: {
    backgroundColor: COLORS.surface,
    borderWidth: BORDER_THICK.width,
    borderColor: COLORS.border,
    paddingHorizontal: 16,
    paddingVertical: 4,
  },
  footerText: {
    fontSize: 12,
    fontWeight: "700",
    color: COLORS.textPrimary,
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  statusTextContainer: {
    backgroundColor: COLORS.progressYellow,
    borderWidth: BORDER_THICK.width,
    borderColor: COLORS.border,
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  statusText: {
    fontSize: 11,
    fontWeight: "900",
    color: COLORS.textPrimary,
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  footerIcons: {
    flexDirection: "row",
    gap: 16,
  },
  decorSquare: {
    width: 96,
    height: 96,
    backgroundColor: COLORS.decorativeYellow,
    borderWidth: BORDER_THICK.width,
    borderColor: COLORS.border,
    shadowColor: COLORS.black,
    shadowOffset: { width: 8, height: 8 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 8,
  },
  decor1: {
    position: "absolute",
    top: 40,
    left: 40,
    transform: [{ rotate: '-12deg' }],
  },
  decorCircle: {
    width: 128,
    height: 128,
    backgroundColor: COLORS.decorativeGreen,
    borderWidth: BORDER_THICK.width,
    borderColor: COLORS.border,
    borderRadius: 64,
    shadowColor: COLORS.black,
    shadowOffset: { width: 8, height: 8 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 8,
  },
  decor2: {
    position: "absolute",
    bottom: 100,
    right: 40,
    transform: [{ rotate: '12deg' }],
  },
  decorSquareSmall: {
    width: 64,
    height: 64,
    backgroundColor: COLORS.decorativePink,
    borderWidth: BORDER_THICK.width,
    borderColor: COLORS.border,
    shadowColor: COLORS.black,
    shadowOffset: { width: 8, height: 8 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 8,
  },
  decor3: {
    position: "absolute",
    top: SCREEN_HEIGHT * 0.25,
    right: 80,
    transform: [{ rotate: '45deg' }],
  },
  decor4: {
    width: 80,
    height: 80,
    backgroundColor: COLORS.decorativeOrange,
    position: "absolute",
    bottom: SCREEN_HEIGHT * 0.25,
    left: 64,
    borderWidth: BORDER_THICK.width,
    borderColor: COLORS.border,
    shadowColor: COLORS.black,
    shadowOffset: { width: 8, height: 8 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 8,
    transform: [{ rotate: '-6deg' }],
  },
});
