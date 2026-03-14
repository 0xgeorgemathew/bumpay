import { useState, useEffect } from "react";
import { View, Text, StyleSheet, Pressable, Image } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import * as Clipboard from "expo-clipboard";
import * as Haptics from "expo-haptics";
import { Ionicons } from "@expo/vector-icons";
import { usePrivy } from "@privy-io/expo";
import { COLORS, BORDER_THICK, BORDER_THIN } from "../constants/theme";
import { useBumpEnsDraft } from "../lib/ens/bump-ens-context";
import { getEnsClaimStatus, readEnsProfileByLabel } from "../lib/ens/service";
import { useOperationalWallet } from "../lib/wallet";
import { extractLabelFromEnsName } from "../lib/ens/config";

export function HomeHeader() {
  const { user } = usePrivy();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { draft, setDraft, resetDraft } = useBumpEnsDraft();
  const { smartWalletAddress } = useOperationalWallet();

  const [notificationPressed, setNotificationPressed] = useState(false);
  const [hasEnsName, setHasEnsName] = useState(false);
  const [isEnsLoading, setIsEnsLoading] = useState(true);
  const [ensNameDisplay, setEnsNameDisplay] = useState<string | null>(null);
  const [copiedEns, setCopiedEns] = useState(false);

  const getAvatarUrl = () => {
    const googleAccount = user?.linked_accounts?.find(
      (account) => account.type === "google_oauth"
    );
    return (googleAccount as { profile_picture_url?: string })?.profile_picture_url;
  };

  // Check ENS status and load profile on mount
  useEffect(() => {
    const checkEnsStatus = async () => {
      if (smartWalletAddress) {
        try {
          const status = await getEnsClaimStatus(smartWalletAddress);
          setHasEnsName(status.hasClaim);

          // If user has ENS, load the profile to get the name
          if (status.hasClaim && status.label) {
            const profile = await readEnsProfileByLabel(status.label);
            if (profile?.ensName) {
              setEnsNameDisplay(profile.ensName);
              setDraft(profile);
            } else if (status.fullName) {
              setEnsNameDisplay(status.fullName);
            }
          } else {
            setEnsNameDisplay(null);
            resetDraft();
          }
        } catch {
          setHasEnsName(false);
          setEnsNameDisplay(null);
          resetDraft();
        } finally {
          setIsEnsLoading(false);
        }
      } else {
        setHasEnsName(false);
        setEnsNameDisplay(null);
        resetDraft();
        setIsEnsLoading(false);
      }
    };
    checkEnsStatus();
  }, [resetDraft, setDraft, smartWalletAddress]);

  // Update when draft changes
  useEffect(() => {
    if (draft.ensName && extractLabelFromEnsName(draft.ensName)) {
      setHasEnsName(true);
      setEnsNameDisplay(draft.ensName);
      setIsEnsLoading(false);
    } else if (!draft.ensName) {
      setHasEnsName(false);
      setEnsNameDisplay(null);
    }
  }, [draft.ensName]);

  const handleAvatarPress = async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    router.push("/ens-profile");
  };

  const handleNotificationPress = async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
  };

  const handleCopyEns = async () => {
    if (!ensNameDisplay) return;
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    await Clipboard.setStringAsync(ensNameDisplay);
    setCopiedEns(true);
    setTimeout(() => setCopiedEns(false), 1500);
  };

  const avatarUrl = getAvatarUrl();

  return (
    <>
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.leftSection}>
          <Pressable
            onPress={handleAvatarPress}
            style={({ pressed }) => [
              styles.avatarWrapper,
              pressed && styles.avatarWrapperPressed,
            ]}
          >
            {({ pressed }) => (
              <>
                <View style={styles.avatarOuter}>
                  <View style={[styles.avatarInner, pressed && styles.avatarPressed]}>
                    {avatarUrl ? (
                      <Image source={{ uri: avatarUrl }} style={styles.avatarImage} />
                    ) : (
                      <Ionicons name="person" size={24} color={COLORS.textPrimary} />
                    )}
                  </View>
                </View>
                {/* ENS Status Indicator - only show after loading completes */}
                {!isEnsLoading && (
                  hasEnsName ? (
                    <View style={styles.ensIndicator}>
                      <Ionicons name="checkmark" size={10} color={COLORS.textInverted} />
                    </View>
                  ) : (
                    <View style={styles.noEnsIndicator}>
                      <Ionicons name="at" size={10} color={COLORS.textInverted} />
                    </View>
                  )
                )}
              </>
            )}
          </Pressable>
          <View style={styles.titleSection}>
            <Text style={styles.title}>Bump Wallet</Text>
            {!isEnsLoading && hasEnsName && ensNameDisplay && (
              <Pressable onPress={handleCopyEns} style={styles.ensNameRow}>
                <Text style={styles.ensName} numberOfLines={1}>
                  {ensNameDisplay}
                </Text>
                <Ionicons
                  name={copiedEns ? "checkmark" : "copy-outline"}
                  size={12}
                  color={copiedEns ? COLORS.success : COLORS.primaryBlue}
                  style={styles.copyIcon}
                />
              </Pressable>
            )}
          </View>
        </View>
        <View style={styles.notificationShadow}>
          <Pressable
            onPress={handleNotificationPress}
            onPressIn={() => setNotificationPressed(true)}
            onPressOut={() => setNotificationPressed(false)}
            style={[styles.notificationButton, notificationPressed && styles.buttonPressed]}
          >
            <Ionicons name="notifications" size={22} color={COLORS.textPrimary} />
          </Pressable>
        </View>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: COLORS.surface,
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: BORDER_THICK.width,
    borderColor: COLORS.border,
  },
  leftSection: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  avatarWrapper: {
    position: "relative",
  },
  avatarWrapperPressed: {
    opacity: 0.9,
  },
  // Outer black border/shadow
  avatarOuter: {
    width: 48,
    height: 48,
    backgroundColor: COLORS.border,
    borderRadius: 24,
    padding: 0,
  },
  // Inner white circle with content
  avatarInner: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: BORDER_THICK.width,
    borderColor: COLORS.border,
    backgroundColor: COLORS.surface,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    transform: [{ translateX: -4 }, { translateY: -4 }],
  },
  avatarPressed: {
    transform: [{ translateX: 0 }, { translateY: 0 }],
  },
  avatarImage: {
    width: "100%",
    height: "100%",
  },
  ensIndicator: {
    position: "absolute",
    bottom: -2,
    right: -6,
    width: 18,
    height: 18,
    backgroundColor: COLORS.success,
    borderWidth: BORDER_THIN.width,
    borderColor: COLORS.border,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 1,
  },
  noEnsIndicator: {
    position: "absolute",
    bottom: -2,
    right: -6,
    width: 18,
    height: 18,
    backgroundColor: COLORS.primaryBlue,
    borderWidth: BORDER_THIN.width,
    borderColor: COLORS.border,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 1,
  },
  titleSection: {
    gap: 2,
  },
  title: {
    fontSize: 20,
    fontWeight: "900",
    textTransform: "uppercase",
    letterSpacing: 0,
    fontStyle: "italic",
    color: COLORS.textPrimary,
  },
  ensNameRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  ensName: {
    fontSize: 11,
    fontWeight: "700",
    color: COLORS.primaryBlue,
    letterSpacing: 0.5,
  },
  copyIcon: {
    marginLeft: 4,
  },
  notificationShadow: {
    backgroundColor: COLORS.border,
  },
  notificationButton: {
    backgroundColor: COLORS.surface,
    padding: 10,
    borderWidth: BORDER_THICK.width,
    borderColor: COLORS.border,
    transform: [{ translateX: -4 }, { translateY: -4 }],
  },
  buttonPressed: {
    transform: [{ translateX: 0 }, { translateY: 0 }],
  },
});
