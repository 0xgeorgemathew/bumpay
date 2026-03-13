import { useCallback, useState } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable, Linking, ActivityIndicator } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import * as Haptics from "expo-haptics";
import { LogoBox } from "../../components/LogoBox";
import { COLORS, BORDER_THICK, SHADOW } from "../../constants/theme";
import { useOperationalWallet } from "../../lib/wallet";
import { getExistingLedger, type FileverseDocument } from "../../lib/fileverse";

export default function HistoryScreen() {
  const { smartWalletAddress, isReady } = useOperationalWallet();
  const [isLoading, setIsLoading] = useState(false);
  const [ledger, setLedger] = useState<FileverseDocument | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadLedger = useCallback(async () => {
    if (!smartWalletAddress || !isReady) {
      setLedger(null);
      setError(null);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const document = await getExistingLedger(smartWalletAddress);
      setLedger(document);
    } catch (loadError) {
      setError(
        loadError instanceof Error ? loadError.message : "Failed to load Fileverse ledger",
      );
      setLedger(null);
    } finally {
      setIsLoading(false);
    }
  }, [isReady, smartWalletAddress]);

  useFocusEffect(
    useCallback(() => {
      loadLedger().catch(console.error);
    }, [loadLedger]),
  );

  const handleRefresh = async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    await loadLedger();
  };

  const handleOpenLedger = async () => {
    if (!ledger?.link) {
      return;
    }

    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    await Linking.openURL(ledger.link);
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

        <View style={styles.actionsRow}>
          <Pressable onPress={handleRefresh} style={styles.actionButton}>
            <Text style={styles.actionText}>REFRESH</Text>
          </Pressable>

          <Pressable
            onPress={handleOpenLedger}
            style={[styles.actionButton, !ledger?.link && styles.actionDisabled]}
            disabled={!ledger?.link}
          >
            <Text style={styles.actionText}>OPEN IN DDOCS</Text>
          </Pressable>
        </View>

        {!isReady || !smartWalletAddress ? (
          <View style={styles.placeholder}>
            <Text style={styles.text}>WALLET NOT READY</Text>
            <Text style={styles.subtext}>Finish wallet setup before loading your ledger.</Text>
          </View>
        ) : null}

        {isReady && smartWalletAddress && isLoading ? (
          <View style={styles.placeholder}>
            <ActivityIndicator size="small" color={COLORS.textPrimary} />
            <Text style={styles.text}>LOADING LEDGER</Text>
            <Text style={styles.subtext}>Fetching your private Fileverse document.</Text>
          </View>
        ) : null}

        {isReady && smartWalletAddress && !isLoading && error ? (
          <View style={styles.placeholder}>
            <Text style={styles.text}>LEDGER UNAVAILABLE</Text>
            <Text style={styles.subtext}>{error}</Text>
          </View>
        ) : null}

        {isReady && smartWalletAddress && !isLoading && !error && !ledger ? (
          <View style={styles.placeholder}>
            <Text style={styles.text}>NO LEDGER YET</Text>
            <Text style={styles.subtext}>
              Complete your first transaction to create a private Fileverse receipt book.
            </Text>
          </View>
        ) : null}

        {ledger ? (
          <View style={styles.ledgerCard}>
            <Text style={styles.title}>{ledger.title}</Text>
            <Text style={styles.meta}>STATUS: {ledger.syncStatus?.toUpperCase() ?? "UNKNOWN"}</Text>
            <Text style={styles.meta}>
              UPDATED: {ledger.updatedAt ? new Date(ledger.updatedAt).toLocaleString("en-IN") : "UNKNOWN"}
            </Text>
            <View style={styles.divider} />
            <Text style={styles.content}>{ledger.content}</Text>
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.backgroundLight,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 24,
    paddingTop: 60,
    paddingBottom: 40,
    flexGrow: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 32,
  },
  actionsRow: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 20,
  },
  actionButton: {
    flex: 1,
    backgroundColor: COLORS.surface,
    paddingVertical: 14,
    alignItems: "center",
    borderWidth: BORDER_THICK.width,
    borderColor: COLORS.border,
    shadowColor: COLORS.border,
    shadowOffset: SHADOW.sm.offset,
    shadowOpacity: SHADOW.sm.opacity,
    shadowRadius: SHADOW.sm.radius,
    elevation: SHADOW.sm.elevation,
  },
  actionDisabled: {
    opacity: 0.5,
  },
  actionText: {
    fontSize: 12,
    fontWeight: "900",
    color: COLORS.textPrimary,
    letterSpacing: 1,
  },
  placeholder: {
    backgroundColor: COLORS.surface,
    padding: 32,
    borderWidth: BORDER_THICK.width,
    borderColor: COLORS.border,
    shadowColor: COLORS.border,
    shadowOffset: SHADOW.md.offset,
    shadowOpacity: SHADOW.md.opacity,
    shadowRadius: SHADOW.md.radius,
    elevation: SHADOW.md.elevation,
    alignItems: "center",
    marginTop: 40,
  },
  text: {
    fontSize: 20,
    fontWeight: "900",
    color: COLORS.textPrimary,
    letterSpacing: 2,
    marginBottom: 8,
    textAlign: "center",
  },
  subtext: {
    fontSize: 14,
    fontWeight: "800",
    color: COLORS.textPrimary,
    opacity: 0.6,
    textAlign: "center",
    marginTop: 8,
  },
  ledgerCard: {
    backgroundColor: COLORS.surface,
    padding: 20,
    borderWidth: BORDER_THICK.width,
    borderColor: COLORS.border,
    shadowColor: COLORS.border,
    shadowOffset: SHADOW.md.offset,
    shadowOpacity: SHADOW.md.opacity,
    shadowRadius: SHADOW.md.radius,
    elevation: SHADOW.md.elevation,
    marginBottom: 24,
  },
  title: {
    fontSize: 20,
    fontWeight: "900",
    color: COLORS.textPrimary,
    marginBottom: 10,
  },
  meta: {
    fontSize: 12,
    fontWeight: "800",
    color: COLORS.textPrimary,
    opacity: 0.8,
    marginBottom: 4,
  },
  divider: {
    height: BORDER_THICK.width,
    backgroundColor: COLORS.border,
    marginVertical: 16,
  },
  content: {
    fontSize: 14,
    fontWeight: "700",
    color: COLORS.textPrimary,
    lineHeight: 22,
  },
});
