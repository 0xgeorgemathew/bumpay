import { View, Text, StyleSheet, ScrollView } from "react-native";
import { LogoBox } from "../../components/LogoBox";
import { COLORS, BORDER_THICK, SHADOW } from "../../constants/theme";

export default function HistoryScreen() {
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

        <View style={styles.placeholder}>
          <Text style={styles.text}>TRANSACTION HISTORY</Text>
          <Text style={styles.subtext}>Coming Soon</Text>
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
  },
});
