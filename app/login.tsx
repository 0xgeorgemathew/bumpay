import { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  Animated,
  Easing,
  TextInput,
  Pressable,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { usePrivy, useLoginWithEmail, useLoginWithOAuth } from "@privy-io/expo";
import { COLORS, BORDER_THICK } from "../constants/theme";

export default function LoginScreen() {
  const router = useRouter();
  const { user, isReady } = usePrivy();
  const { sendCode, loginWithCode } = useLoginWithEmail();
  const { login: loginWithOAuth } = useLoginWithOAuth();

  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [codeSent, setCodeSent] = useState(false);

  const bumpOpacity = useRef(new Animated.Value(0)).current;
  const bumpScale = useRef(new Animated.Value(0)).current;
  const walletOpacity = useRef(new Animated.Value(0)).current;
  const walletScale = useRef(new Animated.Value(0)).current;
  const walletIconOpacity = useRef(new Animated.Value(0)).current;
  const walletIconScale = useRef(new Animated.Value(0)).current;
  const googleBtnOpacity = useRef(new Animated.Value(0)).current;
  const googleBtnTranslateY = useRef(new Animated.Value(20)).current;
  const dividerOpacity = useRef(new Animated.Value(0)).current;
  const emailFormOpacity = useRef(new Animated.Value(0)).current;
  const emailFormTranslateY = useRef(new Animated.Value(20)).current;

  const decor1Opacity = useRef(new Animated.Value(0)).current;
  const decor1Scale = useRef(new Animated.Value(0)).current;
  const decor2Opacity = useRef(new Animated.Value(0)).current;
  const decor2Scale = useRef(new Animated.Value(0)).current;
  const decor3Opacity = useRef(new Animated.Value(0)).current;
  const decor3Scale = useRef(new Animated.Value(0)).current;
  const decor4Opacity = useRef(new Animated.Value(0)).current;
  const decor4Scale = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (isReady && user) {
      router.replace("/ens-onboarding");
    }
  }, [isReady, router, user]);

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
      Animated.timing(decor1Opacity, { toValue: 1, duration: 800, delay: 100, easing: smoothEasing, useNativeDriver: true }),
      createSmoothSpring(decor1Scale, 100),
    ]);

    const decor2 = Animated.parallel([
      Animated.timing(decor2Opacity, { toValue: 1, duration: 800, delay: 200, easing: smoothEasing, useNativeDriver: true }),
      createSmoothSpring(decor2Scale, 200),
    ]);

    const decor3 = Animated.parallel([
      Animated.timing(decor3Opacity, { toValue: 1, duration: 800, delay: 300, easing: smoothEasing, useNativeDriver: true }),
      createSmoothSpring(decor3Scale, 300),
    ]);

    const decor4 = Animated.parallel([
      Animated.timing(decor4Opacity, { toValue: 1, duration: 800, delay: 400, easing: smoothEasing, useNativeDriver: true }),
      createSmoothSpring(decor4Scale, 400),
    ]);

    const bump = Animated.parallel([
      Animated.timing(bumpOpacity, { toValue: 1, duration: 800, delay: 200, easing: smoothEasing, useNativeDriver: true }),
      Animated.spring(bumpScale, {
        toValue: 1,
        friction: 7,
        tension: 60,
        delay: 200,
        useNativeDriver: true,
      }),
    ]);

    const wallet = Animated.parallel([
      Animated.timing(walletOpacity, { toValue: 1, duration: 800, delay: 400, easing: smoothEasing, useNativeDriver: true }),
      Animated.spring(walletScale, {
        toValue: 1,
        friction: 7,
        tension: 60,
        delay: 400,
        useNativeDriver: true,
      }),
    ]);

    const walletIcon = Animated.parallel([
      Animated.timing(walletIconOpacity, { toValue: 1, duration: 800, delay: 500, easing: smoothEasing, useNativeDriver: true }),
      Animated.spring(walletIconScale, {
        toValue: 1,
        friction: 6,
        tension: 80,
        delay: 500,
        useNativeDriver: true,
      }),
    ]);

    const googleBtn = Animated.parallel([
      Animated.timing(googleBtnOpacity, { toValue: 1, duration: 600, delay: 700, easing: smoothEasing, useNativeDriver: true }),
      Animated.timing(googleBtnTranslateY, { toValue: 0, duration: 600, delay: 700, easing: smoothEasing, useNativeDriver: true }),
    ]);

    const divider = Animated.timing(dividerOpacity, {
      toValue: 1,
      duration: 600,
      delay: 900,
      easing: smoothEasing,
      useNativeDriver: true,
    });

    const emailForm = Animated.parallel([
      Animated.timing(emailFormOpacity, { toValue: 1, duration: 600, delay: 1100, easing: smoothEasing, useNativeDriver: true }),
      Animated.timing(emailFormTranslateY, { toValue: 0, duration: 600, delay: 1100, easing: smoothEasing, useNativeDriver: true }),
    ]);

    Animated.parallel([
      decor1,
      decor2,
      decor3,
      decor4,
      bump,
      wallet,
      walletIcon,
      googleBtn,
      divider,
      emailForm,
    ]).start();
  }, []);

  const handleEmailSubmit = async () => {
    if (!email.trim()) {
      setError("Enter your email!");
      return;
    }

    try {
      setError(null);
      await sendCode({ email: email.trim() });
      setCodeSent(true);
    } catch (err) {
      setError("Failed to send code. Try again!");
    }
  };

  const handleCodeSubmit = async () => {
    if (!code.trim()) {
      setError("Enter the code!");
      return;
    }

    try {
      setError(null);
      await loginWithCode({ code: code.trim() });
    } catch (err) {
      setError("Invalid code. Try again!");
    }
  };

  const handleGoogleLogin = async () => {
    try {
      setError(null);
      await loginWithOAuth({ provider: "google" });
    } catch (err) {
      setError("Google login failed. Try again!");
    }
  };

  const handleButtonPress = async (callback: () => void) => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    callback();
  };

  if (!isReady) {
    return (
      <View style={styles.container}>
        <View style={styles.loadingBox}>
          <Text style={styles.loadingText}>LOADING...</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Animated.View style={[styles.decorSquare, styles.decor1, { opacity: decor1Opacity, transform: [{ scale: decor1Scale }] }]} />
      <Animated.View style={[styles.decorSquarePink, styles.decor2, { opacity: decor2Opacity, transform: [{ scale: decor2Scale }] }]} />
      <Animated.View style={[styles.decorSquareGreen, styles.decor3, { opacity: decor3Opacity, transform: [{ scale: decor3Scale }] }]} />
      <Animated.View style={[styles.decorSquareOrange, styles.decor4, { opacity: decor4Opacity, transform: [{ scale: decor4Scale }] }]} />

      <View style={styles.content}>
        <View style={styles.headerContainer}>
          <Animated.View style={[styles.bumpContainer, { opacity: bumpOpacity, transform: [{ scale: bumpScale }, { rotate: '-1deg' }] }]}>
            <Text style={styles.bumpText}>BUMP</Text>
          </Animated.View>

          <Animated.View style={[styles.walletContainer, { opacity: walletOpacity, transform: [{ scale: walletScale }, { rotate: '1deg' }] }]}>
            <Text style={styles.walletText}>WALLET</Text>
          </Animated.View>
        </View>

        <Animated.View style={[styles.walletIconWrapper, { opacity: walletIconOpacity, transform: [{ scale: walletIconScale }] }]}>
          <View style={styles.walletIconContainer}>
            <Ionicons name="wallet" size={48} color={COLORS.black} />
          </View>
        </Animated.View>

        <Animated.View style={[styles.form, { opacity: googleBtnOpacity, transform: [{ translateY: googleBtnTranslateY }] }]}>
          {!codeSent ? (
            <>
              <View style={styles.buttonShadow}>
                <Pressable
                  style={({ pressed }) => [styles.googleButton, pressed && styles.buttonPressed]}
                  onPress={() => handleButtonPress(handleGoogleLogin)}
                >
                  <Ionicons name="logo-google" size={20} color={COLORS.white} style={styles.buttonIcon} />
                  <Text style={styles.googleButtonText}>Continue with Google</Text>
                </Pressable>
              </View>

              <Animated.View style={[styles.divider, { opacity: dividerOpacity }]}>
                <View style={styles.dividerLine} />
                <Text style={styles.dividerText}>OR</Text>
                <View style={styles.dividerLine} />
              </Animated.View>

              <Animated.View style={[styles.emailSection, { opacity: emailFormOpacity, transform: [{ translateY: emailFormTranslateY }] }]}>
                <Text style={styles.emailLabel}>EMAIL ADDRESS</Text>
                <View style={styles.inputShadow}>
                  <TextInput
                    style={styles.emailInput}
                    placeholder="you@example.com"
                    placeholderTextColor={COLORS.black}
                    value={email}
                    onChangeText={setEmail}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoComplete="email"
                  />
                </View>

                <View style={styles.buttonShadow}>
                  <Pressable
                    style={({ pressed }) => [styles.emailButton, pressed && styles.buttonPressed]}
                    onPress={() => handleButtonPress(handleEmailSubmit)}
                  >
                    <Ionicons name="mail" size={18} color={COLORS.black} style={styles.buttonIcon} />
                    <Text style={styles.emailButtonText}>Sign in with Email</Text>
                  </Pressable>
                </View>

                {error && (
                  <View style={styles.errorBox}>
                    <Text style={styles.errorText}>{error}</Text>
                  </View>
                )}
              </Animated.View>
            </>
          ) : (
            <Animated.View style={[styles.codeSection, { opacity: emailFormOpacity }]}>
              <View style={styles.codeSentBadge}>
                <Text style={styles.codeSentText}>
                  Code sent to <Text style={styles.emailHighlight}>{email}</Text>
                </Text>
              </View>

              <Text style={styles.emailLabel}>VERIFICATION CODE</Text>
              <View style={styles.inputShadow}>
                <TextInput
                  style={styles.emailInput}
                  placeholder="000000"
                  placeholderTextColor={COLORS.black}
                  value={code}
                  onChangeText={setCode}
                  keyboardType="number-pad"
                  maxLength={6}
                />
              </View>

              <View style={styles.buttonShadow}>
                <Pressable
                  style={({ pressed }) => [styles.verifyButton, pressed && styles.buttonPressed]}
                  onPress={() => handleButtonPress(handleCodeSubmit)}
                >
                  <Text style={styles.verifyButtonText}>Verify</Text>
                </Pressable>
              </View>

              <Pressable
                style={({ pressed }) => [styles.backButton, pressed && styles.backButtonPressed]}
                onPress={() => {
                  setCodeSent(false);
                  setCode("");
                  setError(null);
                }}
              >
                <Text style={styles.backButtonText}>Back</Text>
              </Pressable>

              {error && (
                <View style={styles.errorBox}>
                  <Text style={styles.errorText}>{error}</Text>
                </View>
              )}
            </Animated.View>
          )}
        </Animated.View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.primaryBlue,
  },
  content: {
    flex: 1,
    padding: 20,
    paddingTop: 40,
    alignItems: "center",
  },
  loadingBox: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  loadingText: {
    fontSize: 24,
    fontWeight: "900",
    color: COLORS.white,
    letterSpacing: 4,
  },

  decorSquare: {
    position: "absolute",
    width: 72,
    height: 72,
    backgroundColor: COLORS.decorativeYellow,
    borderWidth: BORDER_THICK.width,
    borderColor: COLORS.black,
    shadowColor: COLORS.black,
    shadowOffset: { width: 4, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 4,
  },
  decor1: {
    top: 30,
    left: 30,
    transform: [{ rotate: "-15deg" }],
  },
  decorSquarePink: {
    position: "absolute",
    width: 96,
    height: 96,
    backgroundColor: COLORS.decorativePink,
    borderWidth: BORDER_THICK.width,
    borderColor: COLORS.black,
    shadowColor: COLORS.black,
    shadowOffset: { width: 4, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 4,
  },
  decor2: {
    right: -16,
    top: 180,
    transform: [{ rotate: "12deg" }],
  },
  decorSquareGreen: {
    position: "absolute",
    width: 80,
    height: 80,
    backgroundColor: COLORS.decorativeGreen,
    borderWidth: BORDER_THICK.width,
    borderColor: COLORS.black,
    shadowColor: COLORS.black,
    shadowOffset: { width: 4, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 4,
  },
  decor3: {
    bottom: 80,
    right: 20,
    transform: [{ rotate: "10deg" }],
  },
  decorSquareOrange: {
    position: "absolute",
    width: 56,
    height: 56,
    backgroundColor: COLORS.decorativeOrange,
    borderWidth: BORDER_THICK.width,
    borderColor: COLORS.black,
    shadowColor: COLORS.black,
    shadowOffset: { width: 4, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 4,
  },
  decor4: {
    bottom: 200,
    left: -10,
    transform: [{ rotate: "20deg" }],
  },

  headerContainer: {
    alignItems: "center",
    marginBottom: 16,
  },
  bumpContainer: {
    backgroundColor: COLORS.black,
    paddingHorizontal: 20,
    paddingVertical: 16,
    shadowColor: COLORS.black,
    shadowOffset: { width: 4, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 4,
  },
  bumpText: {
    fontSize: 48,
    fontWeight: "900",
    color: COLORS.white,
    letterSpacing: -2,
    textTransform: "uppercase",
  },
  walletContainer: {
    backgroundColor: COLORS.white,
    borderWidth: BORDER_THICK.width,
    borderColor: COLORS.black,
    paddingHorizontal: 24,
    paddingVertical: 6,
    marginTop: 12,
    shadowColor: COLORS.black,
    shadowOffset: { width: 4, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 4,
  },
  walletText: {
    fontSize: 18,
    fontWeight: "700",
    color: COLORS.black,
    letterSpacing: 4,
    textTransform: "uppercase",
  },

  walletIconWrapper: {
    marginBottom: 20,
  },
  walletIconContainer: {
    backgroundColor: COLORS.white,
    padding: 20,
    borderWidth: BORDER_THICK.width,
    borderColor: COLORS.black,
    shadowColor: COLORS.black,
    shadowOffset: { width: 4, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 4,
    transform: [{ rotate: "-2deg" }],
  },

  form: {
    width: "100%",
    maxWidth: 360,
    alignSelf: "center",
  },
  buttonShadow: {
    backgroundColor: COLORS.black,
  },
  googleButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.primaryBlue,
    borderWidth: BORDER_THICK.width,
    borderColor: COLORS.black,
    paddingVertical: 14,
    paddingHorizontal: 20,
    transform: [{ translateX: -4 }, { translateY: -4 }],
  },
  buttonIcon: {
    marginRight: 10,
  },
  googleButtonText: {
    fontSize: 16,
    fontWeight: "700",
    color: COLORS.white,
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  buttonPressed: {
    transform: [{ translateX: 0 }, { translateY: 0 }],
  },

  divider: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: 14,
  },
  dividerLine: {
    flex: 1,
    height: 4,
    backgroundColor: COLORS.black,
  },
  dividerText: {
    fontSize: 18,
    fontWeight: "900",
    color: COLORS.black,
    marginHorizontal: 12,
  },

  emailSection: {
    gap: 0,
  },
  emailLabel: {
    fontSize: 14,
    fontWeight: "900",
    color: COLORS.black,
    textTransform: "uppercase",
    marginBottom: 6,
    textAlign: "center",
  },
  inputShadow: {
    backgroundColor: COLORS.black,
    marginBottom: 12,
  },
  emailInput: {
    backgroundColor: COLORS.white,
    borderWidth: BORDER_THICK.width,
    borderColor: COLORS.black,
    padding: 12,
    fontSize: 16,
    fontWeight: "600",
    color: COLORS.black,
    transform: [{ translateX: -4 }, { translateY: -4 }],
  },
  emailButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.white,
    borderWidth: BORDER_THICK.width,
    borderColor: COLORS.black,
    paddingVertical: 12,
    paddingHorizontal: 20,
    transform: [{ translateX: -4 }, { translateY: -4 }],
  },
  emailButtonText: {
    fontSize: 15,
    fontWeight: "700",
    color: COLORS.black,
    textTransform: "uppercase",
  },

  errorBox: {
    marginTop: 12,
    padding: 10,
    backgroundColor: COLORS.error,
    borderWidth: BORDER_THICK.width,
    borderColor: COLORS.black,
  },
  errorText: {
    color: COLORS.white,
    fontWeight: "900",
    fontSize: 12,
    textTransform: "uppercase",
    textAlign: "center",
  },

  codeSection: {
    gap: 0,
  },
  codeSentBadge: {
    backgroundColor: COLORS.white,
    padding: 12,
    borderWidth: BORDER_THICK.width,
    borderColor: COLORS.black,
    marginBottom: 12,
  },
  codeSentText: {
    color: COLORS.black,
    fontSize: 13,
    fontWeight: "600",
    textAlign: "center",
  },
  emailHighlight: {
    fontWeight: "800",
    color: COLORS.primaryBlue,
  },
  verifyButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.white,
    borderWidth: BORDER_THICK.width,
    borderColor: COLORS.black,
    paddingVertical: 12,
    paddingHorizontal: 20,
    transform: [{ translateX: -4 }, { translateY: -4 }],
  },
  verifyButtonText: {
    fontSize: 15,
    fontWeight: "700",
    color: COLORS.black,
    textTransform: "uppercase",
  },
  backButton: {
    backgroundColor: "transparent",
    paddingVertical: 10,
    marginTop: 8,
  },
  backButtonPressed: {
    opacity: 0.7,
  },
  backButtonText: {
    fontSize: 14,
    fontWeight: "700",
    color: COLORS.black,
    textAlign: "center",
  },
});
