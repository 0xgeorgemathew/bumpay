import { useEffect, useMemo, useState } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable } from "react-native";
import { useRouter } from "expo-router";
import {
  usePrivy,
  type LinkedAccount,
} from "@privy-io/expo";
import * as Haptics from "expo-haptics";
import { LogoBox } from "../../components/LogoBox";
import { TokenApprovalsCard } from "../../components/TokenApprovalsCard";
import { UserCard } from "../../components/UserCard";
import { WalletSetupCard } from "../../components/WalletSetupCard";
import { COLORS, BORDER_THICK, SHADOW } from "../../constants/theme";

type EmailAccount = Extract<LinkedAccount, { type: "email" }>;

export default function SettingsScreen() {
  const router = useRouter();
  const { user, isReady, logout } = usePrivy();
  const [logoutPressed, setLogoutPressed] = useState(false);

  useEffect(() => {
    if (isReady && !user) {
      router.replace("/login");
    }
  }, [isReady, router, user]);

  const linkedAccounts = useMemo(() => user?.linked_accounts ?? [], [user]);

  const email = useMemo(() => {
    const emailAccount = linkedAccounts.find(
      (account): account is EmailAccount => account.type === "email",
    );
    return emailAccount?.address || "No email";
  }, [linkedAccounts]);

  const privyId = useMemo(() => user?.id || "", [user]);

  if (!isReady || !user) {
    return (
      <View style={styles.container}>
        <View style={styles.loadingBox}>
          <Text style={styles.loadingText}>LOADING...</Text>
        </View>
      </View>
    );
  }

  const handleLogout = async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    await logout();
    router.replace("/login");
  };

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <LogoBox size="small" />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>ACCOUNT</Text>
          <UserCard email={email} privyId={privyId} />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>WALLET SETUP</Text>
          <WalletSetupCard />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>LIMITS</Text>
          <TokenApprovalsCard />
        </View>

        <View style={styles.footer}>
          <Pressable
            onPress={handleLogout}
            onPressIn={() => setLogoutPressed(true)}
            onPressOut={() => setLogoutPressed(false)}
            style={[styles.logoutButton, logoutPressed && styles.logoutButtonPressed]}
          >
            <Text style={styles.logoutText}>LOGOUT</Text>
          </Pressable>
        </View>
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
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 24,
    paddingTop: 60,
    paddingBottom: 100,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 32,
  },
  section: {
    marginBottom: 32,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: "900",
    color: COLORS.textPrimary,
    letterSpacing: 2,
    marginBottom: 12,
    opacity: 0.7,
  },
  footer: {
    marginTop: 40,
    alignItems: "center",
  },
  logoutButton: {
    backgroundColor: COLORS.error,
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderWidth: BORDER_THICK.width,
    borderColor: COLORS.border,
    shadowColor: COLORS.border,
    shadowOffset: SHADOW.sm.offset,
    shadowOpacity: SHADOW.sm.opacity,
    shadowRadius: SHADOW.sm.radius,
    elevation: SHADOW.sm.elevation,
  },
  logoutButtonPressed: {
    transform: [
      { translateX: SHADOW.sm.offset.width },
      { translateY: SHADOW.sm.offset.height },
    ],
    shadowOffset: { width: 0, height: 0 },
    elevation: 0,
  },
  logoutText: {
    fontSize: 14,
    fontWeight: "900",
    color: COLORS.textInverted,
    letterSpacing: 2,
  },
});
