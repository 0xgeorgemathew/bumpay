import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Animated,
  Easing,
  TextInput,
  ScrollView,
  ActivityIndicator,
  Image,
  Dimensions,
} from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { usePrivy } from "@privy-io/expo";
import { COLORS, BORDER_THICK, SHADOW, BORDER_THIN } from "../constants/theme";
import {
  DEFAULT_BUMP_ENS_PROFILE,
  BUMP_MODE_OPTIONS,
  type BumpMode,
} from "../lib/ens/bump-ens";
import { useBumpEnsDraft } from "../lib/ens/bump-ens-context";
import {
  normalizeEnsLabel,
  validateEnsLabel,
  formatFullEnsName,
  ENS_PARENT_DOMAIN,
} from "../lib/ens/config";
import {
  getEnsClaimStatus,
  checkLabelAvailability,
  claimSubdomain,
  getNodeForLabel,
  getNodeOwner,
  readEnsProfileByLabel,
  writeEnsProfile,
  type WalletWriteClient,
} from "../lib/ens/service";
import { P2P_TOKEN_OPTIONS } from "../lib/blockchain/select-options";
import { useOperationalWallet } from "../lib/wallet";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");

type Step = "welcome" | "claim" | "mode" | "token" | "sync" | "success";
type ClaimStatus = "idle" | "checking" | "available" | "taken" | "claiming" | "error";
type ProfileSyncStatus = "idle" | "saving" | "error";

export default function EnsOnboardingScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = usePrivy();
  const { draft, setDraft } = useBumpEnsDraft();
  const {
    sendContractTransaction,
    smartWalletAddress,
    status: walletStatus,
    error: walletError,
  } = useOperationalWallet();

  const [currentStep, setCurrentStep] = useState<Step>("welcome");
  const [claimStatus, setClaimStatus] = useState<ClaimStatus>("idle");
  const [profileSyncStatus, setProfileSyncStatus] = useState<ProfileSyncStatus>("idle");
  const [usernameInput, setUsernameInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isInitialEnsCheckPending, setIsInitialEnsCheckPending] = useState(true);

  // Animations
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(40)).current;
  const scaleAnim = useRef(new Animated.Value(0.9)).current;

  // Decor animations
  const decor1Anim = useRef(new Animated.Value(0)).current;
  const decor2Anim = useRef(new Animated.Value(0)).current;
  const decor3Anim = useRef(new Animated.Value(0)).current;
  const floatAnim = useRef(new Animated.Value(0)).current;

  // Wallet client wrapper
  const walletClient: WalletWriteClient | null = useMemo(() => {
    if (walletStatus !== "ready") return null;
    return {
      sendTransaction: async (args: { to: `0x${string}`; data: `0x${string}`; value?: bigint }) => {
        const hash = await sendContractTransaction(args.to, args.data, args.value);
        if (!hash) {
          throw new Error(walletError || "Smart wallet transaction was not submitted");
        }
        return hash as `0x${string}`;
      },
    };
  }, [sendContractTransaction, walletError, walletStatus]);

  const walletBlockedMessage = useMemo(() => {
    if (walletStatus === "creating_embedded") {
      return "Wallet is still provisioning. Please wait for embedded wallet setup to finish.";
    }

    if (walletStatus === "creating_smart") {
      return "Smart wallet is still provisioning. Profile setup is temporarily blocked.";
    }

    return walletError || "No wallet connected";
  }, [walletError, walletStatus]);

  // Check if already has ENS on mount
  useEffect(() => {
    let cancelled = false;

    const checkExistingEns = async () => {
      if (!user) {
        if (!cancelled) {
          setIsInitialEnsCheckPending(false);
        }
        return;
      }

      if (walletStatus === "creating_embedded" || walletStatus === "creating_smart") {
        if (!cancelled) {
          setIsInitialEnsCheckPending(true);
        }
        return;
      }

      if (walletStatus !== "ready" || !smartWalletAddress) {
        if (!cancelled) {
          setIsInitialEnsCheckPending(false);
        }
        return;
      }

      if (!cancelled) {
        setIsInitialEnsCheckPending(true);
      }

      try {
        const status = await getEnsClaimStatus(smartWalletAddress);
        if (status.hasClaim && status.fullName) {
          const onchainProfile = status.label
            ? await readEnsProfileByLabel(status.label)
            : null;

          if (!cancelled) {
            setDraft(
              onchainProfile ?? {
                ...DEFAULT_BUMP_ENS_PROFILE,
                ensName: status.fullName,
              },
            );
          }

          if (onchainProfile) {
            router.replace("/(tabs)");
            return;
          }

          if (!cancelled) {
            setCurrentStep("mode");
          }
          return;
        }

        if (status.hasClaim) {
          router.replace("/(tabs)");
          return;
        }
      } catch {
        // Continue with onboarding
      } finally {
        if (!cancelled) {
          setIsInitialEnsCheckPending(false);
        }
      }
    };
    checkExistingEns();

    return () => {
      cancelled = true;
    };
  }, [router, setDraft, smartWalletAddress, user, walletStatus]);

  // Entrance animations
  useEffect(() => {
    const smoothEasing = Easing.bezier(0.25, 0.1, 0.25, 1);

    Animated.parallel([
      // Main content
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 500,
        delay: 200,
        easing: smoothEasing,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 500,
        delay: 200,
        easing: smoothEasing,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        friction: 8,
        tension: 100,
        delay: 300,
        useNativeDriver: true,
      }),
      // Decorative elements
      Animated.timing(decor1Anim, {
        toValue: 1,
        duration: 400,
        delay: 100,
        easing: smoothEasing,
        useNativeDriver: true,
      }),
      Animated.timing(decor2Anim, {
        toValue: 1,
        duration: 400,
        delay: 200,
        easing: smoothEasing,
        useNativeDriver: true,
      }),
      Animated.timing(decor3Anim, {
        toValue: 1,
        duration: 400,
        delay: 300,
        easing: smoothEasing,
        useNativeDriver: true,
      }),
    ]).start();

    // Floating animation
    Animated.loop(
      Animated.sequence([
        Animated.timing(floatAnim, {
          toValue: 1,
          duration: 3000,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(floatAnim, {
          toValue: 0,
          duration: 3000,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, [fadeAnim, slideAnim, scaleAnim, decor1Anim, decor2Anim, decor3Anim, floatAnim]);

  const getGoogleAvatar = () => {
    const googleAccount = user?.linked_accounts?.find(
      (account) => account.type === "google_oauth"
    );
    return (googleAccount as { profile_picture_url?: string })?.profile_picture_url;
  };

  const handleContinue = useCallback(async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    setCurrentStep("claim");
  }, []);

  const handleCheckAvailability = useCallback(async () => {
    const label = normalizeEnsLabel(usernameInput);
    const validationError = validateEnsLabel(label);

    if (validationError) {
      setError(validationError);
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return;
    }

    setClaimStatus("checking");
    setError(null);

    try {
      const isAvailable = await checkLabelAvailability(label);
      if (isAvailable) {
        setClaimStatus("available");
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } else {
        setClaimStatus("taken");
        setError("This username is already taken");
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      }
    } catch {
      setClaimStatus("error");
      setError("Failed to check availability");
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
  }, [usernameInput]);

  const waitForClaimStatus = useCallback(
    async (expectedFullName: string, maxAttempts = 12, delayMs = 2500) => {
      if (!smartWalletAddress) {
        return null;
      }

      for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
        const status = await getEnsClaimStatus(smartWalletAddress);
        if (status.fullName?.toLowerCase() === expectedFullName.toLowerCase()) {
          return status;
        }

        if (attempt < maxAttempts - 1) {
          await new Promise((resolve) => setTimeout(resolve, delayMs));
        }
      }

      return null;
    },
    [smartWalletAddress],
  );

  const handleClaim = useCallback(async () => {
    if (!smartWalletAddress || !walletClient) {
      setError(walletBlockedMessage);
      return;
    }

    const label = normalizeEnsLabel(usernameInput);
    setClaimStatus("claiming");
    setError(null);
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);

    try {
      await claimSubdomain(walletClient, label, smartWalletAddress);

      const fullName = formatFullEnsName(label);
      const claimedStatus = await waitForClaimStatus(fullName);

      if (!claimedStatus?.fullName) {
        throw new Error("Claim transaction was submitted but the ENS name was not confirmed onchain");
      }

      setDraft({
        ...DEFAULT_BUMP_ENS_PROFILE,
        ensName: fullName,
      });

      setCurrentStep("mode");
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (claimError) {
      setClaimStatus("error");
      setError("Couldn't claim that name. Please try again.");
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
  }, [
    smartWalletAddress,
    usernameInput,
    setDraft,
    waitForClaimStatus,
    walletBlockedMessage,
    walletClient,
  ]);

  const waitForProfileSync = useCallback(
    async (label: string, maxAttempts = 12, delayMs = 2500) => {
      for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
        const profile = await readEnsProfileByLabel(label);
        if (
          profile &&
          profile.mode === draft.mode &&
          profile.defaultAsset?.chainId === draft.defaultAsset?.chainId &&
          profile.defaultAsset?.token === draft.defaultAsset?.token
        ) {
          return profile;
        }

        if (attempt < maxAttempts - 1) {
          await new Promise((resolve) => setTimeout(resolve, delayMs));
        }
      }

      return null;
    },
    [draft.defaultAsset?.chainId, draft.defaultAsset?.token, draft.mode],
  );

  const updateMode = useCallback((mode: BumpMode) => {
    setDraft((current) => ({ ...current, mode }));
    setProfileSyncStatus("idle");
    setError(null);
  }, [setDraft]);

  const handleContinueToToken = useCallback(async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    setCurrentStep("token");
  }, []);

  const updateSettlementToken = useCallback((value: string) => {
    setDraft((current) => ({
      ...current,
      defaultAsset: {
        chainId: current.defaultAsset?.chainId ?? 84532,
        token: value.trim() as `0x${string}`,
      },
      acceptedAssets: [
        {
          chainId: current.defaultAsset?.chainId ?? 84532,
          token: value.trim() as `0x${string}`,
          priority: 0,
        },
      ],
    }));
    setProfileSyncStatus("idle");
    setError(null);
  }, [setDraft]);

  const handleContinueToSync = useCallback(async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    setCurrentStep("sync");
  }, []);

  const handleSaveProfile = useCallback(async () => {
    if (!draft.ensName || !walletClient) {
      setError(walletBlockedMessage);
      return;
    }

    const label = normalizeEnsLabel(draft.ensName);
    if (!label) {
      setError("Invalid ENS name");
      return;
    }

    setProfileSyncStatus("saving");
    setError(null);
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);

    try {
      const node = await getNodeForLabel(label);
      if (!node) {
        throw new Error("Failed to get ENS node");
      }

      const nodeOwner = await getNodeOwner(node);
      if (!nodeOwner) {
        throw new Error("ENS node owner not found onchain");
      }

      if (!smartWalletAddress || nodeOwner.toLowerCase() !== smartWalletAddress.toLowerCase()) {
        throw new Error(
          `ENS name is owned by ${nodeOwner}, but the app is trying to write with ${smartWalletAddress ?? "no wallet"}`,
        );
      }

      await writeEnsProfile(walletClient, node, draft);
      const syncedProfile = await waitForProfileSync(label);
      if (!syncedProfile) {
        throw new Error("Profile transactions were submitted but the ENS records were not confirmed onchain");
      }

      setDraft(syncedProfile);
      setProfileSyncStatus("idle");
      setCurrentStep("success");
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (syncError) {
      setProfileSyncStatus("error");
      setError("Couldn't save your profile. Please try again.");
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
  }, [draft, setDraft, smartWalletAddress, waitForProfileSync, walletBlockedMessage, walletClient]);

  const handleFinish = useCallback(async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    router.replace("/(tabs)");
  }, [router]);

  const isLoading = claimStatus === "checking" || claimStatus === "claiming";
  const googleAvatar = getGoogleAvatar();
  const selectedTokenOption = useMemo(
    () =>
      P2P_TOKEN_OPTIONS.find(
        (option) =>
          option.value.toLowerCase() ===
          (draft.defaultAsset?.token ?? P2P_TOKEN_OPTIONS[0]?.value ?? "").toLowerCase(),
      ) ?? P2P_TOKEN_OPTIONS[0],
    [draft.defaultAsset?.token],
  );

  const floatTranslateY = floatAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -10],
  });

  if (isInitialEnsCheckPending) {
    return (
      <View style={[styles.loadingContainer, { paddingTop: insets.top }]}>
        <View style={styles.loadingCardShadow}>
          <View style={styles.loadingCard}>
            <ActivityIndicator size="large" color={COLORS.textPrimary} />
            <Text style={styles.loadingTitle}>OPENING BUMP WALLET</Text>
            <Text style={styles.loadingSubtitle}>Checking your ENS profile...</Text>
          </View>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Decorative Background Elements */}
      <Animated.View
        style={[
          styles.decorSquare,
          styles.decor1,
          {
            opacity: decor1Anim,
            transform: [
              { scale: decor1Anim },
              { translateY: floatTranslateY },
            ],
          },
        ]}
      />
      <Animated.View
        style={[
          styles.decorCircle,
          styles.decor2,
          {
            opacity: decor2Anim,
            transform: [
              { scale: decor2Anim },
              {
                translateY: floatAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0, 8],
                }),
              },
            ],
          },
        ]}
      />
      <Animated.View
        style={[
          styles.decorDiamond,
          styles.decor3,
          {
            opacity: decor3Anim,
            transform: [
              { scale: decor3Anim },
              {
                translateY: floatAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0, -6],
                }),
              },
            ],
          },
        ]}
      />

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[styles.contentContainer, { paddingBottom: insets.bottom + 40 }]}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View
          style={[
            styles.content,
            {
              opacity: fadeAnim,
              transform: [{ translateY: slideAnim }],
            },
          ]}
        >
          {/* Welcome Step */}
          {currentStep === "welcome" && (
            <View style={styles.stepContainer}>
              {/* Avatar Section */}
              <Animated.View style={[styles.avatarSection, { transform: [{ scale: scaleAnim }] }]}>
                <View style={styles.avatarShadow}>
                  <View style={styles.avatar}>
                    {googleAvatar ? (
                      <Image source={{ uri: googleAvatar }} style={styles.avatarImage} />
                    ) : (
                      <Ionicons name="person" size={44} color={COLORS.textInverted} />
                    )}
                  </View>
                </View>
                <View style={styles.verifiedBadge}>
                  <Ionicons name="checkmark" size={14} color={COLORS.textInverted} />
                </View>
              </Animated.View>

              {/* Welcome Text */}
              <View style={styles.welcomeTextSection}>
                <Text style={styles.welcomeLabel}>WELCOME TO BUMP WALLET</Text>
                <View style={styles.logoBox}>
                  <Text style={styles.logoText}>BUMP</Text>
                </View>
              </View>

              {/* Feature Cards */}
              <View style={styles.featuresSection}>
                <View style={styles.featureCard}>
                  <View style={styles.featureIconWrapper}>
                    <View style={styles.featureIcon}>
                      <Ionicons name="at-circle" size={24} color={COLORS.primaryBlue} />
                    </View>
                  </View>
                  <View style={styles.featureContent}>
                    <Text style={styles.featureTitle}>CLAIM YOUR NAME</Text>
                    <Text style={styles.featureDescription}>
                      Claim your Bump Wallet name before entering the app. Other people can pay you using just your name.
                    </Text>
                  </View>
                </View>

                <View style={styles.benefitsRow}>
                  <View style={styles.benefitItem}>
                    <View style={styles.benefitIcon}>
                      <Ionicons name="flash" size={14} color={COLORS.textInverted} />
                    </View>
                    <Text style={styles.benefitText}>Instant</Text>
                  </View>
                  <View style={styles.benefitItem}>
                    <View style={styles.benefitIcon}>
                      <Ionicons name="shield-checkmark" size={14} color={COLORS.textInverted} />
                    </View>
                    <Text style={styles.benefitText}>Secure</Text>
                  </View>
                  <View style={styles.benefitItem}>
                    <View style={styles.benefitIcon}>
                      <Ionicons name="globe" size={14} color={COLORS.textInverted} />
                    </View>
                    <Text style={styles.benefitText}>Onchain</Text>
                  </View>
                </View>
              </View>

              {/* Actions */}
              <View style={styles.actionsSection}>
                <Pressable
                  style={({ pressed }) => [
                    styles.primaryButton,
                    pressed && styles.buttonPressed,
                  ]}
                  onPress={handleContinue}
                >
                  <Ionicons name="arrow-forward" size={20} color={COLORS.textInverted} />
                  <Text style={styles.primaryButtonText}>CLAIM MY NAME</Text>
                </Pressable>
              </View>
            </View>
          )}

          {/* Claim Step */}
          {currentStep === "claim" && (
            <View style={styles.stepContainer}>
              {/* Header */}
              <View style={styles.claimHeader}>
                <View style={styles.claimIconShadow}>
                  <View style={styles.claimIcon}>
                    <Ionicons name="at-circle" size={40} color={COLORS.textInverted} />
                  </View>
                </View>
                <Text style={styles.claimTitle}>Choose Your Username</Text>
                <Text style={styles.claimSubtitle}>
                  This will be your payment name inside Bump Wallet. Make it memorable.
                </Text>
              </View>

              {/* Input Card */}
              <View style={styles.inputCard}>
                <Text style={styles.inputLabel}>USERNAME</Text>
                <View style={styles.inputRow}>
                  <View style={styles.inputShadow}>
                    <View style={styles.inputWrapper}>
                      <Ionicons name="at" size={18} color={COLORS.textMuted} style={styles.inputIcon} />
                      <TextInput
                        style={styles.usernameInput}
                        placeholder="yourname"
                        placeholderTextColor={COLORS.textMuted}
                        value={usernameInput}
                        onChangeText={(value) => {
                          setUsernameInput(normalizeEnsLabel(value));
                          setError(null);
                          if (claimStatus === "available" || claimStatus === "taken") {
                            setClaimStatus("idle");
                          }
                        }}
                        autoCapitalize="none"
                        autoCorrect={false}
                        editable={!isLoading}
                        autoFocus
                      />
                    </View>
                  </View>
                </View>
                <Text style={styles.domainHint}>.{ENS_PARENT_DOMAIN}</Text>
              </View>

              {/* Status Feedback */}
              {claimStatus === "available" && (
                <View style={styles.statusCardAvailable}>
                  <View style={styles.statusIconAvailable}>
                    <Ionicons name="checkmark" size={16} color={COLORS.success} />
                  </View>
                  <Text style={styles.statusTextAvailable}>Available! You can claim this name.</Text>
                </View>
              )}

              {claimStatus === "taken" && (
                <View style={styles.statusCardTaken}>
                  <View style={styles.statusIconTaken}>
                    <Ionicons name="close" size={16} color={COLORS.error} />
                  </View>
                  <Text style={styles.statusTextTaken}>This username is taken</Text>
                </View>
              )}

              {error && claimStatus === "error" && (
                <View style={styles.errorCard}>
                  <Ionicons name="alert-circle" size={16} color={COLORS.textInverted} />
                  <Text style={styles.errorText}>{error}</Text>
                </View>
              )}

              {/* Action Buttons */}
              <View style={styles.claimActions}>
                {claimStatus !== "available" ? (
                  <Pressable
                    style={({ pressed }) => [
                      styles.primaryButton,
                      styles.primaryButtonWhite,
                      (isLoading || !usernameInput.trim()) && styles.buttonDisabled,
                      pressed && styles.buttonPressedWhite,
                    ]}
                    onPress={handleCheckAvailability}
                    disabled={isLoading || !usernameInput.trim()}
                  >
                    {isLoading ? (
                      <ActivityIndicator color={COLORS.primaryBlue} size="small" />
                    ) : (
                      <>
                        <Ionicons name="search" size={20} color={COLORS.primaryBlue} />
                        <Text style={[styles.primaryButtonText, styles.primaryButtonTextWhite]}>
                          CHECK AVAILABILITY
                        </Text>
                      </>
                    )}
                  </Pressable>
                ) : (
                  <Pressable
                    style={({ pressed }) => [
                      styles.primaryButton,
                      styles.primaryButtonGreen,
                      (!walletClient || isLoading) && styles.buttonDisabled,
                      pressed && styles.buttonPressed,
                    ]}
                    onPress={handleClaim}
                    disabled={!walletClient || isLoading}
                  >
                    {isLoading ? (
                      <ActivityIndicator color={COLORS.textInverted} size="small" />
                    ) : (
                      <>
                        <Ionicons name="checkmark-done" size={20} color={COLORS.textInverted} />
                        <Text style={styles.primaryButtonText}>CLAIM THIS NAME</Text>
                      </>
                    )}
                  </Pressable>
                )}
              </View>

              {/* Info */}
              <View style={styles.infoSection}>
                <View style={styles.infoItem}>
                  <View style={styles.infoBullet}>
                    <Ionicons name="information-circle" size={12} color={COLORS.textInverted} />
                  </View>
                  <Text style={styles.infoText}>
                    Your name will automatically point to your wallet address.
                  </Text>
                </View>
              </View>
            </View>
          )}

          {currentStep === "mode" && (
            <View style={styles.stepContainer}>
              <View style={styles.claimHeader}>
                <View style={styles.claimIconShadow}>
                  <View style={[styles.claimIcon, styles.preferencesIcon]}>
                    <Ionicons name="person-circle" size={36} color={COLORS.textInverted} />
                  </View>
                </View>
                <Text style={styles.claimTitle}>How Will You Use Bump Wallet?</Text>
                <Text style={styles.claimSubtitle}>
                  Pick the profile that fits you best. You can change this later.
                </Text>
              </View>

              <View style={styles.slideOptions}>
                {BUMP_MODE_OPTIONS.map((mode) => {
                  const selected = draft.mode === mode;
                  return (
                    <Pressable
                      key={mode}
                      onPress={() => updateMode(mode)}
                      style={[
                        styles.slideOptionCard,
                        selected && styles.slideOptionCardSelected,
                      ]}
                    >
                      <View style={styles.slideOptionTopRow}>
                        <Text
                          style={[
                            styles.slideOptionTitle,
                            selected && styles.slideOptionTitleSelected,
                          ]}
                        >
                          {mode === "p2p"
                            ? "PERSONAL"
                            : mode === "merchant"
                              ? "STORE"
                              : "BOTH"}
                        </Text>
                        {selected ? (
                          <View style={styles.slideOptionBadge}>
                            <Ionicons name="checkmark" size={14} color={COLORS.textInverted} />
                          </View>
                        ) : null}
                      </View>
                      <Text
                        style={[
                          styles.slideOptionBody,
                          selected && styles.slideOptionBodySelected,
                        ]}
                      >
                        {mode === "p2p"
                          ? "Great for sending and receiving money as a person."
                          : mode === "merchant"
                            ? "Best for accepting payments as a business or seller."
                            : "Use one profile for both personal and merchant payments."}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              {error && (
                <View style={styles.errorCard}>
                  <Ionicons name="alert-circle" size={16} color={COLORS.textInverted} />
                  <Text style={styles.errorText}>{error}</Text>
                </View>
              )}

              <View style={styles.claimActions}>
                <Pressable
                  style={({ pressed }) => [
                    styles.primaryButton,
                    pressed && styles.buttonPressed,
                  ]}
                  onPress={handleContinueToToken}
                >
                  <Ionicons name="arrow-forward" size={20} color={COLORS.textInverted} />
                  <Text style={styles.primaryButtonText}>CONTINUE</Text>
                </Pressable>
              </View>

              <View style={styles.infoSection}>
                <View style={styles.infoItem}>
                  <View style={styles.infoBullet}>
                    <Ionicons name="information-circle" size={12} color={COLORS.textInverted} />
                  </View>
                  <Text style={styles.infoText}>
                    This helps Bump Wallet know how to present your profile to other users.
                  </Text>
                </View>
              </View>
            </View>
          )}

          {currentStep === "token" && (
            <View style={styles.stepContainer}>
              <View style={styles.claimHeader}>
                <View style={styles.claimIconShadow}>
                  <View style={[styles.claimIcon, styles.tokenIcon]}>
                    <Ionicons name="cash" size={36} color={COLORS.textInverted} />
                  </View>
                </View>
                <Text style={styles.claimTitle}>What Do You Want To Receive?</Text>
                <Text style={styles.claimSubtitle}>
                  Choose the token people should send you by default.
                </Text>
              </View>

              <View style={styles.slideOptions}>
                {P2P_TOKEN_OPTIONS.map((option) => {
                  const selected =
                    draft.defaultAsset?.token?.toLowerCase() === option.value.toLowerCase();

                  return (
                    <Pressable
                      key={option.value}
                      onPress={() => updateSettlementToken(option.value)}
                      style={[
                        styles.slideOptionCard,
                        selected && styles.slideOptionCardSelected,
                      ]}
                    >
                      <View style={styles.slideOptionTopRow}>
                        <Text
                          style={[
                            styles.slideOptionTitle,
                            selected && styles.slideOptionTitleSelected,
                          ]}
                        >
                          {option.label}
                        </Text>
                        {selected ? (
                          <View style={styles.slideOptionBadge}>
                            <Ionicons name="checkmark" size={14} color={COLORS.textInverted} />
                          </View>
                        ) : null}
                      </View>
                      <Text
                        style={[
                          styles.slideOptionBody,
                          selected && styles.slideOptionBodySelected,
                        ]}
                      >
                        {option.subtitle}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              <View style={styles.claimActions}>
                <Pressable
                  style={({ pressed }) => [
                    styles.primaryButton,
                    pressed && styles.buttonPressed,
                  ]}
                  onPress={handleContinueToSync}
                >
                  <Ionicons name="arrow-forward" size={20} color={COLORS.textInverted} />
                  <Text style={styles.primaryButtonText}>CONTINUE</Text>
                </Pressable>
              </View>

              <View style={styles.infoSection}>
                <View style={styles.infoItem}>
                  <View style={styles.infoBullet}>
                    <Ionicons name="information-circle" size={12} color={COLORS.textInverted} />
                  </View>
                  <Text style={styles.infoText}>
                    People can still choose a different token later if your app supports it.
                  </Text>
                </View>
              </View>
            </View>
          )}

          {currentStep === "sync" && (
            <View style={styles.stepContainer}>
              <View style={styles.claimHeader}>
                <View style={styles.claimIconShadow}>
                  <View style={[styles.claimIcon, styles.syncIcon]}>
                    <Ionicons name="rocket" size={36} color={COLORS.textInverted} />
                  </View>
                </View>
                <Text style={styles.claimTitle}>Finish Your Profile</Text>
                <Text style={styles.claimSubtitle}>
                  Save your name and payment preferences so you are ready to use Bump Wallet.
                </Text>
              </View>

              <View style={styles.summaryCard}>
                <Text style={styles.summaryLabel}>YOUR NAME</Text>
                <Text style={styles.summaryValue}>{draft.ensName}</Text>

                <View style={styles.summaryDivider} />

                <Text style={styles.summaryLabel}>PROFILE TYPE</Text>
                <Text style={styles.summaryValue}>
                  {draft.mode === "p2p"
                    ? "PERSONAL"
                    : draft.mode === "merchant"
                      ? "STORE"
                      : "BOTH"}
                </Text>

                <View style={styles.summaryDivider} />

                <Text style={styles.summaryLabel}>DEFAULT TOKEN</Text>
                <Text style={styles.summaryValue}>{selectedTokenOption?.label ?? "USDC"}</Text>
              </View>

              {error ? (
                <View style={styles.errorCard}>
                  <Ionicons name="alert-circle" size={16} color={COLORS.textInverted} />
                  <Text style={styles.errorText}>{error}</Text>
                </View>
              ) : null}

              <View style={styles.claimActions}>
                <Pressable
                  style={({ pressed }) => [
                    styles.primaryButton,
                    (!walletClient || profileSyncStatus === "saving") && styles.buttonDisabled,
                    pressed && styles.buttonPressed,
                  ]}
                  onPress={handleSaveProfile}
                  disabled={!walletClient || profileSyncStatus === "saving"}
                >
                  {profileSyncStatus === "saving" ? (
                    <ActivityIndicator color={COLORS.textInverted} size="small" />
                  ) : (
                    <>
                      <Ionicons name="checkmark-circle" size={20} color={COLORS.textInverted} />
                      <Text style={styles.primaryButtonText}>FINISH SETUP</Text>
                    </>
                  )}
                </Pressable>
              </View>
            </View>
          )}

          {/* Success Step */}
          {currentStep === "success" && (
            <View style={styles.stepContainer}>
              {/* Success Animation */}
              <Animated.View style={[styles.successSection, { transform: [{ scale: scaleAnim }] }]}>
                <View style={styles.successShadow}>
                  <View style={styles.successCircle}>
                    <Ionicons name="checkmark" size={56} color={COLORS.textInverted} />
                  </View>
                </View>
              </Animated.View>

              {/* Success Message */}
              <Text style={styles.successTitle}>YOU'RE ALL SET!</Text>
              <Text style={styles.successSubtitle}>
                Your name and payment profile are ready.
              </Text>

              {/* ENS Name Card */}
              <View style={styles.ensNameCard}>
                <View style={styles.ensNameHeader}>
                  <Text style={styles.ensNameLabel}>YOUR BUMP NAME</Text>
                </View>
                <View style={styles.ensNameBody}>
                  <View style={styles.ensNameIconWrapper}>
                    <View style={styles.ensNameIcon}>
                      <Ionicons name="at-circle" size={24} color={COLORS.primaryBlue} />
                    </View>
                  </View>
                  <Text style={styles.ensNameText}>{draft.ensName}</Text>
                </View>
              </View>

              {/* Share Hint */}
              <View style={styles.shareHintCard}>
                <Ionicons name="share-social" size={18} color={COLORS.primaryBlue} />
                <Text style={styles.shareHintText}>
                  Share this name with anyone to get paid the way you set up above.
                </Text>
              </View>

              {/* Finish Button */}
              <Pressable
                style={({ pressed }) => [
                  styles.primaryButton,
                  pressed && styles.buttonPressed,
                ]}
                onPress={handleFinish}
              >
                <Ionicons name="arrow-forward" size={20} color={COLORS.textInverted} />
                <Text style={styles.primaryButtonText}>START USING BUMP WALLET</Text>
              </Pressable>
            </View>
          )}
        </Animated.View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    backgroundColor: COLORS.primaryBlue,
    paddingHorizontal: 24,
    justifyContent: "center",
  },
  loadingCardShadow: {
    backgroundColor: COLORS.border,
  },
  loadingCard: {
    backgroundColor: COLORS.surface,
    borderWidth: BORDER_THICK.width,
    borderColor: COLORS.border,
    paddingHorizontal: 24,
    paddingVertical: 28,
    alignItems: "center",
    gap: 12,
    transform: [{ translateX: -8 }, { translateY: -8 }],
  },
  loadingTitle: {
    fontSize: 20,
    fontWeight: "900",
    color: COLORS.textPrimary,
    letterSpacing: 1,
    textAlign: "center",
  },
  loadingSubtitle: {
    fontSize: 14,
    fontWeight: "700",
    color: COLORS.textMuted,
    textAlign: "center",
  },
  container: {
    flex: 1,
    backgroundColor: COLORS.primaryBlue,
  },
  scrollView: {
    flex: 1,
  },
  contentContainer: {
    flexGrow: 1,
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    paddingVertical: 32,
  },
  stepContainer: {
    flex: 1,
    alignItems: "center",
  },

  // Decorative Elements
  decorSquare: {
    position: "absolute",
    width: 56,
    height: 56,
    backgroundColor: COLORS.decorativeYellow,
    borderWidth: BORDER_THICK.width,
    borderColor: COLORS.border,
  },
  decor1: {
    top: SCREEN_HEIGHT * 0.08,
    right: 24,
    transform: [{ rotate: "15deg" }],
  },
  decorCircle: {
    position: "absolute",
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.decorativePink,
    borderWidth: BORDER_THICK.width,
    borderColor: COLORS.border,
  },
  decor2: {
    bottom: SCREEN_HEIGHT * 0.18,
    left: 16,
  },
  decorDiamond: {
    position: "absolute",
    width: 32,
    height: 32,
    backgroundColor: COLORS.decorativeGreen,
    borderWidth: BORDER_THICK.width,
    borderColor: COLORS.border,
    transform: [{ rotate: "45deg" }],
  },
  decor3: {
    top: SCREEN_HEIGHT * 0.35,
    right: 12,
  },

  // Welcome Step
  avatarSection: {
    position: "relative",
    marginBottom: 28,
    marginTop: 16,
  },
  avatarShadow: {
    shadowColor: COLORS.border,
    shadowOffset: SHADOW.lg.offset,
    shadowOpacity: SHADOW.lg.opacity,
    shadowRadius: SHADOW.lg.radius,
    elevation: SHADOW.lg.elevation,
  },
  avatar: {
    width: 88,
    height: 88,
    borderRadius: 44,
    borderWidth: BORDER_THICK.width,
    borderColor: COLORS.border,
    backgroundColor: COLORS.surface,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  avatarImage: {
    width: "100%",
    height: "100%",
  },
  verifiedBadge: {
    position: "absolute",
    bottom: 0,
    right: -2,
    width: 28,
    height: 28,
    backgroundColor: COLORS.success,
    borderWidth: BORDER_THICK.width,
    borderColor: COLORS.border,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },

  welcomeTextSection: {
    alignItems: "center",
    marginBottom: 32,
  },
  welcomeLabel: {
    fontSize: 13,
    fontWeight: "700",
    color: COLORS.textInverted,
    letterSpacing: 3,
    marginBottom: 10,
    opacity: 0.9,
  },
  logoBox: {
    backgroundColor: COLORS.surface,
    paddingHorizontal: 28,
    paddingVertical: 12,
    borderWidth: BORDER_THICK.width,
    borderColor: COLORS.border,
    shadowColor: COLORS.border,
    shadowOffset: SHADOW.md.offset,
    shadowOpacity: SHADOW.md.opacity,
    shadowRadius: SHADOW.md.radius,
    elevation: SHADOW.md.elevation,
  },
  logoText: {
    fontSize: 36,
    fontWeight: "900",
    color: COLORS.textPrimary,
    letterSpacing: 2,
  },

  // Features Section
  featuresSection: {
    width: "100%",
    gap: 16,
    marginBottom: 36,
  },
  featureCard: {
    flexDirection: "row",
    backgroundColor: COLORS.surface,
    borderWidth: BORDER_THICK.width,
    borderColor: COLORS.border,
    padding: 16,
    gap: 14,
    shadowColor: COLORS.border,
    shadowOffset: SHADOW.sm.offset,
    shadowOpacity: SHADOW.sm.opacity,
    shadowRadius: SHADOW.sm.radius,
    elevation: SHADOW.sm.elevation,
  },
  featureIconWrapper: {
    shadowColor: COLORS.border,
    shadowOffset: { width: 2, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 2,
  },
  featureIcon: {
    width: 44,
    height: 44,
    backgroundColor: COLORS.surface,
    borderWidth: BORDER_THICK.width,
    borderColor: COLORS.primaryBlue,
    alignItems: "center",
    justifyContent: "center",
  },
  featureContent: {
    flex: 1,
    justifyContent: "center",
    gap: 4,
  },
  featureTitle: {
    fontSize: 12,
    fontWeight: "900",
    color: COLORS.textPrimary,
    letterSpacing: 1,
  },
  featureDescription: {
    fontSize: 13,
    fontWeight: "500",
    color: COLORS.textMuted,
    lineHeight: 18,
  },

  benefitsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 10,
  },
  benefitItem: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.surface,
    borderWidth: BORDER_THICK.width,
    borderColor: COLORS.border,
    paddingVertical: 12,
    gap: 8,
  },
  benefitIcon: {
    width: 22,
    height: 22,
    backgroundColor: COLORS.primaryAction,
    borderWidth: 2,
    borderColor: COLORS.border,
    alignItems: "center",
    justifyContent: "center",
  },
  benefitText: {
    fontSize: 11,
    fontWeight: "800",
    color: COLORS.textPrimary,
  },

  // Actions
  actionsSection: {
    width: "100%",
    gap: 14,
  },
  primaryButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    backgroundColor: COLORS.primaryAction,
    borderWidth: BORDER_THICK.width,
    borderColor: COLORS.border,
    paddingVertical: 18,
    paddingHorizontal: 24,
    width: "100%",
    shadowColor: COLORS.border,
    shadowOffset: SHADOW.sm.offset,
    shadowOpacity: SHADOW.sm.opacity,
    shadowRadius: SHADOW.sm.radius,
    elevation: SHADOW.sm.elevation,
  },
  primaryButtonWhite: {
    backgroundColor: COLORS.surface,
  },
  primaryButtonGreen: {
    backgroundColor: COLORS.success,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonPressed: {
    shadowOffset: { width: 0, height: 0 },
    transform: [{ translateX: 4 }, { translateY: 4 }],
  },
  buttonPressedWhite: {
    shadowOffset: { width: 0, height: 0 },
    transform: [{ translateX: 4 }, { translateY: 4 }],
  },
  primaryButtonText: {
    fontSize: 14,
    fontWeight: "900",
    color: COLORS.textInverted,
    letterSpacing: 1,
  },
  primaryButtonTextWhite: {
    color: COLORS.primaryBlue,
  },
  // Claim Step
  claimHeader: {
    alignItems: "center",
    marginBottom: 28,
    marginTop: 16,
  },
  claimIconShadow: {
    shadowColor: COLORS.border,
    shadowOffset: SHADOW.lg.offset,
    shadowOpacity: SHADOW.lg.opacity,
    shadowRadius: SHADOW.lg.radius,
    elevation: SHADOW.lg.elevation,
    marginBottom: 20,
  },
  claimIcon: {
    width: 72,
    height: 72,
    backgroundColor: COLORS.surface,
    borderWidth: BORDER_THICK.width,
    borderColor: COLORS.border,
    alignItems: "center",
    justifyContent: "center",
  },
  preferencesIcon: {
    backgroundColor: COLORS.decorativePink,
  },
  tokenIcon: {
    backgroundColor: COLORS.decorativeGreen,
  },
  syncIcon: {
    backgroundColor: COLORS.decorativeYellow,
  },
  claimTitle: {
    fontSize: 22,
    fontWeight: "900",
    color: COLORS.textInverted,
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  claimSubtitle: {
    fontSize: 14,
    fontWeight: "500",
    color: COLORS.textInverted,
    opacity: 0.85,
    textAlign: "center",
    lineHeight: 20,
    paddingHorizontal: 20,
  },

  // Input Card
  inputCard: {
    backgroundColor: COLORS.surface,
    borderWidth: BORDER_THICK.width,
    borderColor: COLORS.border,
    padding: 16,
    width: "100%",
    gap: 12,
    shadowColor: COLORS.border,
    shadowOffset: SHADOW.sm.offset,
    shadowOpacity: SHADOW.sm.opacity,
    shadowRadius: SHADOW.sm.radius,
    elevation: SHADOW.sm.elevation,
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 10,
    fontWeight: "900",
    color: COLORS.textMuted,
    letterSpacing: 2,
  },
  inputRow: {
    flexDirection: "row",
  },
  inputShadow: {
    flex: 1,
    backgroundColor: COLORS.border,
  },
  inputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.surface,
    borderWidth: BORDER_THICK.width,
    borderColor: COLORS.border,
    paddingHorizontal: 14,
    paddingVertical: 14,
    transform: [{ translateX: -4 }, { translateY: -4 }],
  },
  inputIcon: {
    marginRight: 10,
  },
  usernameInput: {
    flex: 1,
    fontSize: 18,
    fontWeight: "700",
    color: COLORS.textPrimary,
  },
  domainHint: {
    fontSize: 13,
    fontWeight: "700",
    color: COLORS.textInverted,
    textAlign: "right",
  },
  slideOptions: {
    width: "100%",
    gap: 14,
    marginBottom: 20,
  },
  slideOptionCard: {
    width: "100%",
    backgroundColor: COLORS.surface,
    borderWidth: BORDER_THICK.width,
    borderColor: COLORS.border,
    padding: 18,
    gap: 10,
    shadowColor: COLORS.border,
    shadowOffset: SHADOW.sm.offset,
    shadowOpacity: SHADOW.sm.opacity,
    shadowRadius: SHADOW.sm.radius,
    elevation: SHADOW.sm.elevation,
  },
  slideOptionCardSelected: {
    backgroundColor: COLORS.yellow400,
  },
  slideOptionTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  slideOptionTitle: {
    fontSize: 18,
    fontWeight: "900",
    color: COLORS.textPrimary,
    letterSpacing: 1,
  },
  slideOptionTitleSelected: {
    color: COLORS.textPrimary,
  },
  slideOptionBody: {
    fontSize: 13,
    fontWeight: "600",
    color: COLORS.textMuted,
    lineHeight: 18,
  },
  slideOptionBodySelected: {
    color: COLORS.textPrimary,
  },
  slideOptionBadge: {
    width: 26,
    height: 26,
    backgroundColor: COLORS.primaryBlue,
    borderWidth: BORDER_THIN.width,
    borderColor: COLORS.border,
    alignItems: "center",
    justifyContent: "center",
  },
  summaryCard: {
    width: "100%",
    backgroundColor: COLORS.surface,
    borderWidth: BORDER_THICK.width,
    borderColor: COLORS.border,
    padding: 20,
    marginBottom: 20,
    shadowColor: COLORS.border,
    shadowOffset: SHADOW.sm.offset,
    shadowOpacity: SHADOW.sm.opacity,
    shadowRadius: SHADOW.sm.radius,
    elevation: SHADOW.sm.elevation,
  },
  summaryLabel: {
    fontSize: 10,
    fontWeight: "900",
    color: COLORS.textMuted,
    letterSpacing: 2,
    marginBottom: 6,
  },
  summaryValue: {
    fontSize: 20,
    fontWeight: "900",
    color: COLORS.textPrimary,
    letterSpacing: 1,
  },
  summaryDivider: {
    height: BORDER_THIN.width,
    backgroundColor: COLORS.border,
    marginVertical: 16,
  },

  // Status Cards
  statusCardAvailable: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.green400,
    borderWidth: BORDER_THICK.width,
    borderColor: COLORS.border,
    paddingVertical: 14,
    paddingHorizontal: 16,
    gap: 12,
    width: "100%",
    marginBottom: 16,
  },
  statusIconAvailable: {
    width: 28,
    height: 28,
    backgroundColor: COLORS.surface,
    borderWidth: BORDER_THIN.width,
    borderColor: COLORS.border,
    alignItems: "center",
    justifyContent: "center",
  },
  statusTextAvailable: {
    flex: 1,
    fontSize: 13,
    fontWeight: "800",
    color: COLORS.textPrimary,
  },
  statusCardTaken: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.pink400,
    borderWidth: BORDER_THICK.width,
    borderColor: COLORS.border,
    paddingVertical: 14,
    paddingHorizontal: 16,
    gap: 12,
    width: "100%",
    marginBottom: 16,
  },
  statusIconTaken: {
    width: 28,
    height: 28,
    backgroundColor: COLORS.surface,
    borderWidth: BORDER_THIN.width,
    borderColor: COLORS.border,
    alignItems: "center",
    justifyContent: "center",
  },
  statusTextTaken: {
    flex: 1,
    fontSize: 13,
    fontWeight: "800",
    color: COLORS.textPrimary,
  },
  errorCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.error,
    borderWidth: BORDER_THICK.width,
    borderColor: COLORS.border,
    paddingVertical: 14,
    paddingHorizontal: 16,
    gap: 10,
    width: "100%",
    marginBottom: 16,
  },
  errorText: {
    flex: 1,
    fontSize: 13,
    fontWeight: "700",
    color: COLORS.textInverted,
  },

  // Claim Actions
  claimActions: {
    width: "100%",
    gap: 14,
    marginBottom: 20,
  },

  // Info Section
  infoSection: {
    width: "100%",
  },
  infoItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  infoBullet: {
    width: 22,
    height: 22,
    backgroundColor: COLORS.primaryAction,
    borderWidth: 2,
    borderColor: COLORS.border,
    alignItems: "center",
    justifyContent: "center",
  },
  infoText: {
    flex: 1,
    fontSize: 12,
    fontWeight: "600",
    color: COLORS.textInverted,
    opacity: 0.85,
    lineHeight: 18,
  },

  // Success Step
  successSection: {
    marginBottom: 24,
    marginTop: 24,
  },
  successShadow: {
    shadowColor: COLORS.border,
    shadowOffset: SHADOW.lg.offset,
    shadowOpacity: SHADOW.lg.opacity,
    shadowRadius: SHADOW.lg.radius,
    elevation: SHADOW.lg.elevation,
  },
  successCircle: {
    width: 100,
    height: 100,
    backgroundColor: COLORS.success,
    borderWidth: BORDER_THICK.width,
    borderColor: COLORS.border,
    borderRadius: 50,
    alignItems: "center",
    justifyContent: "center",
  },
  successTitle: {
    fontSize: 26,
    fontWeight: "900",
    color: COLORS.textInverted,
    letterSpacing: 2,
    marginBottom: 8,
  },
  successSubtitle: {
    fontSize: 14,
    fontWeight: "500",
    color: COLORS.textInverted,
    opacity: 0.85,
    textAlign: "center",
    marginBottom: 28,
    paddingHorizontal: 20,
  },

  // ENS Name Card
  ensNameCard: {
    backgroundColor: COLORS.surface,
    borderWidth: BORDER_THICK.width,
    borderColor: COLORS.border,
    width: "100%",
    marginBottom: 20,
    shadowColor: COLORS.border,
    shadowOffset: SHADOW.sm.offset,
    shadowOpacity: SHADOW.sm.opacity,
    shadowRadius: SHADOW.sm.radius,
    elevation: SHADOW.sm.elevation,
    overflow: "hidden",
  },
  ensNameHeader: {
    backgroundColor: COLORS.background,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderBottomWidth: BORDER_THICK.width,
    borderColor: COLORS.border,
  },
  ensNameLabel: {
    fontSize: 10,
    fontWeight: "900",
    color: COLORS.textMuted,
    letterSpacing: 2,
  },
  ensNameBody: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 16,
  },
  ensNameIconWrapper: {
    shadowColor: COLORS.border,
    shadowOffset: { width: 2, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 2,
  },
  ensNameIcon: {
    width: 40,
    height: 40,
    backgroundColor: COLORS.surface,
    borderWidth: BORDER_THICK.width,
    borderColor: COLORS.primaryBlue,
    alignItems: "center",
    justifyContent: "center",
  },
  ensNameText: {
    fontSize: 18,
    fontWeight: "900",
    color: COLORS.textPrimary,
    letterSpacing: 0.5,
  },

  // Share Hint
  shareHintCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: `${COLORS.surface}20`,
    borderWidth: BORDER_THIN.width,
    borderColor: `${COLORS.surface}50`,
    padding: 14,
    width: "100%",
    marginBottom: 28,
  },
  shareHintText: {
    flex: 1,
    fontSize: 13,
    fontWeight: "600",
    color: COLORS.textInverted,
    opacity: 0.9,
  },
});
