import { View, Text, StyleSheet } from "react-native";
import { COLORS, BORDER_THICK, SHADOW } from "../constants/theme";

interface UserCardProps {
  email: string;
  privyId: string;
}

export function UserCard({ email, privyId }: UserCardProps) {
  const truncatedEmail = email.length > 28 ? email.slice(0, 25) + "..." : email;
  const truncatedId = privyId.slice(-6);

  return (
    <View style={styles.container}>
      <Text style={styles.label}>USER: </Text>
      <Text style={styles.value}>
        {truncatedEmail} ({truncatedId})
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.surface,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: BORDER_THICK.width,
    borderColor: COLORS.border,
    marginBottom: 12,
    shadowColor: COLORS.border,
    shadowOffset: SHADOW.sm.offset,
    shadowOpacity: SHADOW.sm.opacity,
    shadowRadius: SHADOW.sm.radius,
    elevation: SHADOW.sm.elevation,
  },
  label: {
    fontWeight: "900",
    fontSize: 12,
    color: COLORS.textPrimary,
    letterSpacing: 2,
  },
  value: {
    fontWeight: "700",
    fontSize: 12,
    color: COLORS.textPrimary,
  },
});
