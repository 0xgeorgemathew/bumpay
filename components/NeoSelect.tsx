import { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Modal,
  ScrollView,
} from "react-native";
import * as Haptics from "expo-haptics";
import { Ionicons } from "@expo/vector-icons";
import { COLORS, BORDER_THICK } from "../constants/theme";
import { TokenIcon } from "./TokenIcon";
import type { SelectOption } from "../lib/blockchain/select-options";

interface NeoSelectProps {
  label: string;
  options: SelectOption[];
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}

export function NeoSelect({
  label,
  options,
  value,
  onChange,
  disabled = false,
}: NeoSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isPressed, setIsPressed] = useState(false);

  const selectedOption = options.find(
    (opt) => opt.value.toLowerCase() === value.toLowerCase()
  );

  const handleOpen = async () => {
    if (disabled) return;
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setIsOpen(true);
  };

  const handleClose = () => {
    setIsOpen(false);
  };

  const handleSelect = async (option: SelectOption) => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    onChange(option.value);
    setIsOpen(false);
  };

  return (
    <>
      <View style={styles.container}>
        <Text style={styles.label}>{label}</Text>
        <View style={styles.selectShadow}>
          <Pressable
            onPress={handleOpen}
            onPressIn={() => setIsPressed(true)}
            onPressOut={() => setIsPressed(false)}
            style={[
              styles.selectButton,
              isPressed && styles.selectButtonPressed,
              disabled && styles.selectButtonDisabled,
            ]}
            disabled={disabled}
          >
            {selectedOption ? (
              <View style={styles.selectedContent}>
                <TokenIcon
                  symbol={selectedOption.tokenSymbol}
                  size={24}
                  backgroundColor={selectedOption.color}
                />
                <View style={styles.selectedTextContainer}>
                  <Text style={styles.selectedLabel}>{selectedOption.label}</Text>
                  <Text style={styles.selectedSubtitle}>{selectedOption.subtitle}</Text>
                </View>
              </View>
            ) : (
              <Text style={styles.placeholder}>Select {label}...</Text>
            )}
            <Ionicons
              name="chevron-down"
              size={20}
              color={disabled ? COLORS.textMuted : COLORS.textPrimary}
            />
          </Pressable>
        </View>
      </View>

      <Modal
        animationType="none"
        transparent
        visible={isOpen}
        onRequestClose={handleClose}
      >
        <Pressable style={styles.modalOverlay} onPress={handleClose}>
          <Pressable
            style={styles.modalContent}
            onPress={(e) => e.stopPropagation()}
          >
            <View style={styles.modalShadow}>
              <View style={styles.modalCard}>
                <View style={styles.modalHeader}>
                  <Text style={styles.modalTitle}>SELECT {label}</Text>
                  <Pressable onPress={handleClose} style={styles.closeButton}>
                    <Text style={styles.closeButtonText}>X</Text>
                  </Pressable>
                </View>
                <ScrollView style={styles.optionsList}>
                  {options.map((option) => {
                    const isSelected =
                      option.value.toLowerCase() === value.toLowerCase();
                    return (
                      <Pressable
                        key={option.value}
                        onPress={() => handleSelect(option)}
                        style={[
                          styles.optionItem,
                          isSelected && styles.optionItemSelected,
                        ]}
                      >
                        <TokenIcon
                          symbol={option.tokenSymbol}
                          size={32}
                          backgroundColor={option.color}
                        />
                        <View style={styles.optionTextContainer}>
                          <Text style={styles.optionLabel}>{option.label}</Text>
                          <Text style={styles.optionSubtitle}>
                            {option.subtitle}
                          </Text>
                        </View>
                        {isSelected && (
                          <Ionicons
                            name="checkmark"
                            size={24}
                            color={COLORS.success}
                          />
                        )}
                      </Pressable>
                    );
                  })}
                </ScrollView>
              </View>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 8,
  },
  label: {
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 2,
    color: COLORS.textPrimary,
    textTransform: "uppercase",
  },
  selectShadow: {
    backgroundColor: COLORS.border,
  },
  selectButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: COLORS.surface,
    borderWidth: BORDER_THICK.width,
    borderColor: COLORS.border,
    paddingHorizontal: 12,
    paddingVertical: 10,
    transform: [{ translateX: -4 }, { translateY: -4 }],
  },
  selectButtonPressed: {
    transform: [{ translateX: 0 }, { translateY: 0 }],
  },
  selectButtonDisabled: {
    backgroundColor: COLORS.backgroundLight,
    opacity: 0.6,
  },
  selectedContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    flex: 1,
  },
  selectedTextContainer: {
    flex: 1,
  },
  selectedLabel: {
    fontSize: 14,
    fontWeight: "800",
    color: COLORS.textPrimary,
  },
  selectedSubtitle: {
    fontSize: 11,
    color: COLORS.textMuted,
    marginTop: 1,
  },
  placeholder: {
    fontSize: 14,
    color: COLORS.textMuted,
    flex: 1,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.6)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  modalContent: {
    width: "100%",
    maxWidth: 320,
  },
  modalShadow: {
    backgroundColor: COLORS.border,
  },
  modalCard: {
    backgroundColor: COLORS.surface,
    borderWidth: BORDER_THICK.width,
    borderColor: COLORS.border,
    transform: [{ translateX: -6 }, { translateY: -6 }],
  },
  modalHeader: {
    backgroundColor: COLORS.surfaceInverted,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderWidth: BORDER_THICK.width,
    borderColor: COLORS.border,
    borderBottomWidth: 0,
  },
  modalTitle: {
    color: COLORS.background,
    fontSize: 14,
    fontWeight: "900",
    letterSpacing: 2,
    textTransform: "uppercase",
  },
  closeButton: {
    backgroundColor: COLORS.error,
    width: 32,
    height: 32,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: BORDER_THICK.width,
    borderColor: COLORS.border,
  },
  closeButtonText: {
    color: COLORS.textInverted,
    fontSize: 16,
    fontWeight: "900",
  },
  optionsList: {
    maxHeight: 300,
  },
  optionItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    gap: 12,
    borderBottomWidth: BORDER_THICK.width,
    borderBottomColor: COLORS.border,
  },
  optionItemSelected: {
    backgroundColor: COLORS.yellow400,
  },
  optionTextContainer: {
    flex: 1,
  },
  optionLabel: {
    fontSize: 16,
    fontWeight: "800",
    color: COLORS.textPrimary,
  },
  optionSubtitle: {
    fontSize: 12,
    color: COLORS.textMuted,
    marginTop: 2,
  },
});
