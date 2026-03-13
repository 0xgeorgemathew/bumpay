import { useMemo, useState, useEffect, useRef, useCallback } from "react";
import { Pressable, StyleSheet, Text, View, ActivityIndicator } from "react-native";
import { NeoButton, NeoInput } from "./index";
import { NeoSelect } from "./NeoSelect";
import { COLORS, BORDER_THICK, SHADOW } from "../constants/theme";
import {
  BUMP_MODE_OPTIONS,
  DEFAULT_BUMP_ENS_PROFILE,
  buildPreparedTextRecordUpdates,
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
import { useOperationalWallet } from "../lib/wallet";
import { P2P_TOKEN_OPTIONS } from "../lib/blockchain/select-options";
import * as Haptics from "expo-haptics";

type ClaimFlowStatus =
  | "unclaimed"
  | "checking"
  | "checking_availability"
  | "available"
  | "taken"
  | "claiming"
  | "claimed"
  | "saving"
  | "error";

type OnchainSyncStatus = "idle" | "saving" | "saved" | "error";

interface EnsPreferencesCardProps {
  readOnly?: boolean;
  title?: string;
  defaultExpanded?: boolean;
}

export function EnsPreferencesCard({
  readOnly = false,
  title = "ENS PREFERENCES",
  defaultExpanded = false,
}: EnsPreferencesCardProps) {
  const { draft, setDraft, resetDraft } = useBumpEnsDraft();
  const {
    sendContractTransaction,
    smartWalletAddress,
    status: walletStatus,
    error: walletError,
  } = useOperationalWallet();
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);
  const [showSaved, setShowSaved] = useState(false);
  const savedTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const recordPreview = useMemo(() => buildPreparedTextRecordUpdates(draft), [draft]);

  // Claim flow state
  const [claimFlowStatus, setClaimFlowStatus] = useState<ClaimFlowStatus>("unclaimed");
  const [usernameInput, setUsernameInput] = useState("");
  const [claimError, setClaimError] = useState<string | null>(null);
  const [onchainSyncStatus, setOnchainSyncStatus] = useState<OnchainSyncStatus>("idle");

  // Create wallet client wrapper for ENS writes
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
      return "Smart wallet is still provisioning. ENS writes are temporarily blocked.";
    }

    return walletError || "No wallet connected";
  }, [walletError, walletStatus]);

  const hydrateDraftFromEns = useCallback(
    async (label: string, fullName: string) => {
      const onchainProfile = await readEnsProfileByLabel(label);
      if (onchainProfile) {
        setDraft(onchainProfile);
        return;
      }

      setDraft({
        ...DEFAULT_BUMP_ENS_PROFILE,
        ensName: fullName,
      });
    },
    [setDraft],
  );

  const refreshClaimStatus = useCallback(async () => {
    if (!smartWalletAddress) {
      setClaimFlowStatus("unclaimed");
      resetDraft();
      return null;
    }

    setClaimFlowStatus("checking");

    try {
      const status = await getEnsClaimStatus(smartWalletAddress);
      if (status.hasClaim && status.fullName) {
        setClaimFlowStatus("claimed");
        if (status.label) {
          await hydrateDraftFromEns(status.label, status.fullName);
        } else {
          setDraft({
            ...DEFAULT_BUMP_ENS_PROFILE,
            ensName: status.fullName,
          });
        }
        return status;
      }

      setClaimFlowStatus("unclaimed");
      resetDraft();
      return status;
    } catch (error) {
      console.error("Failed to check ENS claim status:", error);
      setClaimFlowStatus("unclaimed");
      resetDraft();
      return null;
    }
  }, [hydrateDraftFromEns, resetDraft, setDraft, smartWalletAddress]);

  const waitForClaimStatus = useCallback(
    async (expectedFullName: string, maxAttempts = 12, delayMs = 2500) => {
      for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
        const status = await getEnsClaimStatus(smartWalletAddress as `0x${string}`);
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

  // Check claim status on wallet load
  useEffect(() => {
    refreshClaimStatus().catch(() => undefined);
  }, [refreshClaimStatus]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (savedTimeoutRef.current) {
        clearTimeout(savedTimeoutRef.current);
      }
    };
  }, []);

  // Check username availability
  const handleCheckAvailability = useCallback(async () => {
    const label = normalizeEnsLabel(usernameInput);
    const validationError = validateEnsLabel(label);

    if (validationError) {
      setClaimError(validationError);
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return;
    }

    setClaimFlowStatus("checking_availability");
    setClaimError(null);

    try {
      const isAvailable = await checkLabelAvailability(label);
      if (isAvailable) {
        setClaimFlowStatus("available");
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } else {
        setClaimFlowStatus("taken");
        setClaimError("Username is already taken");
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      }
    } catch (error) {
      setClaimFlowStatus("error");
      setClaimError("Failed to check availability");
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
  }, [usernameInput]);

  // Claim subdomain onchain
  const handleClaim = useCallback(async () => {
    if (!smartWalletAddress || !walletClient) {
      setClaimError(walletBlockedMessage);
      return;
    }

    const label = normalizeEnsLabel(usernameInput);
    setClaimFlowStatus("claiming");
    setClaimError(null);
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
      setClaimFlowStatus("claimed");
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (error) {
      setClaimFlowStatus("error");
      setClaimError(error instanceof Error ? error.message : "Failed to claim username");
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
  }, [smartWalletAddress, usernameInput, setDraft, waitForClaimStatus, walletBlockedMessage, walletClient]);

  // Save preferences to onchain
  const handleSaveToOnchain = useCallback(async () => {
    if (!draft.ensName || !walletClient) {
      setClaimError(walletBlockedMessage);
      return;
    }

    const label = normalizeEnsLabel(draft.ensName);
    if (!label) {
      setClaimError("Invalid ENS name");
      return;
    }

    setOnchainSyncStatus("saving");
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
      setOnchainSyncStatus("saved");
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

      setTimeout(() => setOnchainSyncStatus("idle"), 2000);
    } catch (error) {
      setOnchainSyncStatus("error");
      setClaimError(error instanceof Error ? error.message : "Failed to save to onchain");
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
  }, [draft, smartWalletAddress, waitForProfileSync, walletBlockedMessage, walletClient]);

  const showSavedIndicator = useCallback(() => {
    if (savedTimeoutRef.current) {
      clearTimeout(savedTimeoutRef.current);
    }
    setShowSaved(true);
    savedTimeoutRef.current = setTimeout(() => setShowSaved(false), 1500);
  }, []);

  const updateMode = useCallback((mode: BumpMode) => {
    setDraft((current) => ({ ...current, mode }));
    showSavedIndicator();
  }, [setDraft, showSavedIndicator]);

  const updateSettlementToken = useCallback((
    value: string,
  ) => {
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
    showSavedIndicator();
  }, [setDraft, showSavedIndicator]);

  // Render claim status badge
  const renderClaimStatusBadge = () => {
    switch (claimFlowStatus) {
      case "checking":
      case "checking_availability":
      case "claiming":
      case "saving":
        return <ActivityIndicator color={COLORS.textPrimary} size="small" />;
      case "available":
        return (
          <View style={styles.statusBadge}>
            <Text style={[styles.statusBadgeText, styles.statusAvailable]}>AVAILABLE</Text>
          </View>
        );
      case "taken":
        return (
          <View style={styles.statusBadge}>
            <Text style={[styles.statusBadgeText, styles.statusTaken]}>TAKEN</Text>
          </View>
        );
      case "claimed":
        return (
          <View style={styles.statusBadge}>
            <Text style={[styles.statusBadgeText, styles.statusClaimed]}>CLAIMED</Text>
          </View>
        );
      case "error":
        return (
          <View style={styles.statusBadge}>
            <Text style={[styles.statusBadgeText, styles.statusError]}>ERROR</Text>
          </View>
        );
      default:
        return (
          <View style={styles.statusBadge}>
            <Text style={styles.statusBadgeText}>CLAIM ENS NAME</Text>
          </View>
        );
    }
  };

  return (
    <View style={styles.shadow}>
      <View style={styles.card}>
        <Pressable
          onPress={() => setIsExpanded((current) => !current)}
          style={styles.header}
        >
          <View style={styles.headerText}>
            <Text style={styles.title}>{title}</Text>
            <Text style={styles.subtitle}>
              {draft.ensName || "no ens draft yet"} · {draft.mode.toUpperCase()}
            </Text>
          </View>
          <View style={styles.headerRight}>
            {onchainSyncStatus === "saved" && (
              <Text style={styles.syncedIndicator}>SYNCED TO ENS</Text>
            )}
            {showSaved && <Text style={styles.savedIndicator}>DRAFT SAVED</Text>}
            <Text style={styles.toggle}>{isExpanded ? "COLLAPSE" : "EXPAND"}</Text>
          </View>
        </Pressable>

        {isExpanded && (
          <View style={styles.body}>
            {walletStatus !== "ready" ? (
              <Text style={styles.hintText}>{walletBlockedMessage}</Text>
            ) : null}

            {readOnly ? (
              <>
                <Text style={styles.previewHeading}>TEXT RECORD PREVIEW</Text>
                {recordPreview.records.map((record, index) => (
                  <View key={`${record.key}-${index}`} style={styles.previewRow}>
                    <Text style={styles.previewKey}>{record.key}</Text>
                    <Text style={styles.previewValue}>{record.value || "(empty)"}</Text>
                  </View>
                ))}
              </>
            ) : claimFlowStatus !== "claimed" ? (
              // Claim flow UI
              <View style={styles.claimFlowContainer}>
                <Text style={styles.sectionLabel}>CHOOSE YOUR USERNAME</Text>
                <NeoInput
                  label={`Username.${ENS_PARENT_DOMAIN}`}
                  value={usernameInput}
                  onChangeText={(value) => {
                    setUsernameInput(normalizeEnsLabel(value));
                    setClaimError(null);
                  }}
                  autoCapitalize="none"
                  autoCorrect={false}
                  placeholder="alice"
                  editable={claimFlowStatus === "unclaimed" || claimFlowStatus === "taken" || claimFlowStatus === "error"}
                />

                {claimError && <Text style={styles.errorText}>{claimError}</Text>}

                <View style={styles.claimActionRow}>
                  <NeoButton
                    title="Check"
                    onPress={handleCheckAvailability}
                    variant="secondary"
                    size="small"
                    disabled={
                      claimFlowStatus === "checking_availability" ||
                      !usernameInput.trim()
                    }
                  />
                  {claimFlowStatus === "available" && (
                    <NeoButton
                      title="Claim Username"
                      onPress={handleClaim}
                      variant="primary"
                      size="small"
                      disabled={!walletClient}
                    />
                  )}
                </View>

                <Text style={styles.hintText}>
                  Your ENS name will resolve to your Bump wallet address automatically.
                </Text>
              </View>
            ) : (
              // Preferences editing UI (after claim)
              <>
                <NeoInput
                  label="ENS Name"
                  value={draft.ensName}
                  editable={false}
                  autoCapitalize="none"
                  autoCorrect={false}
                />

                <Text style={styles.sectionLabel}>MODE</Text>
                <View style={styles.modeRow}>
                  {BUMP_MODE_OPTIONS.map((mode) => (
                    <Pressable
                      key={mode}
                      onPress={() => updateMode(mode)}
                      style={[
                        styles.modeButton,
                        draft.mode === mode && styles.modeButtonActive,
                      ]}
                    >
                      <Text
                        style={[
                          styles.modeButtonText,
                          draft.mode === mode && styles.modeButtonTextActive,
                        ]}
                      >
                        {mode.toUpperCase()}
                      </Text>
                    </Pressable>
                  ))}
                </View>

                <Text style={styles.sectionLabel}>SETTLEMENT TOKEN</Text>
                <View style={styles.assetCard}>
                  <NeoSelect
                    label="Settlement Token"
                    options={P2P_TOKEN_OPTIONS}
                    value={draft.defaultAsset?.token ?? P2P_TOKEN_OPTIONS[0]?.value ?? ""}
                    onChange={updateSettlementToken}
                  />
                  <Text style={styles.hintText}>
                    This is the token other people should use for P2P settlement when they tap to
                    pay you.
                  </Text>
                </View>

                <View style={styles.saveRow}>
                  <NeoButton
                    title={
                      onchainSyncStatus === "saving"
                        ? "Saving..."
                        : onchainSyncStatus === "saved"
                          ? "Saved to ENS ✓"
                          : "Save to ENS"
                    }
                    onPress={handleSaveToOnchain}
                    variant="primary"
                    disabled={onchainSyncStatus === "saving" || !walletClient}
                  />
                </View>
              </>
            )}
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  shadow: {
    backgroundColor: COLORS.border,
  },
  card: {
    backgroundColor: COLORS.surface,
    borderWidth: BORDER_THICK.width,
    borderColor: COLORS.border,
    transform: [{ translateX: -8 }, { translateY: -8 }],
    shadowColor: COLORS.border,
    shadowOffset: SHADOW.md.offset,
    shadowOpacity: SHADOW.md.opacity,
    shadowRadius: SHADOW.md.radius,
    elevation: SHADOW.md.elevation,
  },
  header: {
    backgroundColor: COLORS.primaryBlue,
    borderBottomWidth: BORDER_THICK.width,
    borderBottomColor: COLORS.border,
    paddingHorizontal: 16,
    paddingVertical: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  headerText: {
    flex: 1,
  },
  title: {
    fontSize: 14,
    fontWeight: "900",
    letterSpacing: 2,
    color: COLORS.textInverted,
  },
  subtitle: {
    fontSize: 11,
    fontWeight: "800",
    color: COLORS.textInverted,
    opacity: 0.8,
    marginTop: 4,
  },
  toggle: {
    fontSize: 11,
    fontWeight: "900",
    color: COLORS.textInverted,
    letterSpacing: 1,
  },
  headerRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  savedIndicator: {
    fontSize: 9,
    fontWeight: "800",
    color: COLORS.success,
    letterSpacing: 1,
    backgroundColor: COLORS.background,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  syncedIndicator: {
    fontSize: 9,
    fontWeight: "800",
    color: COLORS.primaryBlue,
    letterSpacing: 1,
    backgroundColor: COLORS.yellow400,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  statusBadge: {
    backgroundColor: COLORS.yellow400,
    borderWidth: BORDER_THICK.width,
    borderColor: COLORS.border,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  statusBadgeText: {
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 1,
    color: COLORS.textPrimary,
  },
  statusAvailable: {
    color: COLORS.success,
  },
  statusTaken: {
    color: COLORS.error,
  },
  statusClaimed: {
    color: COLORS.success,
  },
  statusError: {
    color: COLORS.error,
  },
  body: {
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 2,
    color: COLORS.textPrimary,
    marginBottom: 12,
    marginTop: 8,
  },
  claimFlowContainer: {
    gap: 12,
  },
  errorText: {
    fontSize: 12,
    fontWeight: "800",
    color: COLORS.error,
    marginTop: 4,
  },
  hintText: {
    fontSize: 11,
    fontWeight: "700",
    color: COLORS.textMuted,
    marginTop: 8,
    lineHeight: 16,
  },
  claimActionRow: {
    flexDirection: "row",
    gap: 12,
    marginTop: 8,
  },
  modeRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 16,
  },
  modeButton: {
    flex: 1,
    borderWidth: BORDER_THICK.width,
    borderColor: COLORS.border,
    backgroundColor: COLORS.surface,
    paddingVertical: 12,
    alignItems: "center",
  },
  modeButtonActive: {
    backgroundColor: COLORS.green400,
  },
  modeButtonText: {
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 1,
    color: COLORS.textPrimary,
  },
  modeButtonTextActive: {
    color: COLORS.textPrimary,
  },
  assetCard: {
    marginBottom: 16,
    padding: 12,
    borderWidth: BORDER_THICK.width,
    borderColor: COLORS.border,
    backgroundColor: COLORS.backgroundLight,
  },
  saveRow: {
    marginTop: 8,
  },
  previewHeading: {
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 2,
    color: COLORS.textPrimary,
    marginBottom: 10,
    marginTop: 8,
  },
  previewRow: {
    padding: 12,
    borderWidth: BORDER_THICK.width,
    borderColor: COLORS.border,
    backgroundColor: COLORS.yellow400,
    marginBottom: 10,
  },
  previewKey: {
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 1,
    color: COLORS.textPrimary,
    marginBottom: 6,
  },
  previewValue: {
    fontSize: 12,
    fontWeight: "700",
    color: COLORS.textPrimary,
  },
});
