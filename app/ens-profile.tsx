import { useEffect } from "react";
import { View, StyleSheet, ScrollView, Pressable, Text } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { usePrivy } from "@privy-io/expo";
import { COLORS, BORDER_THICK, SHADOW } from "../constants/theme";
import { EnsPreferencesCard } from "../components/EnsPreferencesCard";

export default function EnsProfileScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user, isReady } = usePrivy();

  useEffect(() => {
    if (isReady && !user) {
      router.replace("/login");
    }
  }, [isReady, router, user]);

  const handleBack = async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    router.back();
  };

  if (!isReady || !user) {
    return (
      <View style={styles.container}>
        <View style={styles.loadingBox}>
          <Text style={styles.loadingText}>LOADING...</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Pressable onPress={handleBack} style={styles.backButton}>
          {({ pressed }) => (
            <View style={[styles.backButtonInner, pressed && styles.backButtonPressed]}>
              <Ionicons name="arrow-back" size={22} color={COLORS.textPrimary} />
            </View>
          )}
        </Pressable>
        <View style={styles.headerText}>
          <Text style={styles.headerTitle}>ENS PROFILE</Text>
        </View>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <EnsPreferencesCard defaultExpanded={true} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.backgroundLight,
  },
  loadingBox: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  loadingText: {
    fontSize: 24,
    fontWeight: "900",
    color: COLORS.textPrimary,
    letterSpacing: 4,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: COLORS.surface,
    borderBottomWidth: BORDER_THICK.width,
    borderColor: COLORS.border,
  },
  backButton: {
    shadowColor: COLORS.border,
    shadowOffset: SHADOW.sm.offset,
    shadowOpacity: SHADOW.sm.opacity,
    shadowRadius: SHADOW.sm.radius,
    elevation: SHADOW.sm.elevation,
  },
  backButtonInner: {
    width: 40,
    height: 40,
    backgroundColor: COLORS.surface,
    borderWidth: BORDER_THICK.width,
    borderColor: COLORS.border,
    alignItems: "center",
    justifyContent: "center",
  },
  backButtonPressed: {
    transform: [{ translateX: 2 }, { translateY: 2 }],
  },
  headerText: {
    flex: 1,
    alignItems: "center",
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: "900",
    textTransform: "uppercase",
    letterSpacing: 2,
    color: COLORS.textPrimary,
  },
  headerSpacer: {
    width: 40,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 24,
    paddingBottom: 100,
  },
});
