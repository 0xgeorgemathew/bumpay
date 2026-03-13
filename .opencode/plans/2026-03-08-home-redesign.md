# Home Page Redesign Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Reimplement the home page to match the HTML design at `/Users/george/Downloads/Home/code.html` - a neobrutalist wallet dashboard with avatar header, blue balance card, action buttons, and recent activity section.

**Architecture:** Update theme colors (without affecting splash/login), create new components (HomeHeader, BalanceCard, TransactionList), update tab layout with icons, and completely redesign index.tsx.

**Tech Stack:** expo-router, @expo/vector-icons (Ionicons), expo-haptics, existing NeoButton component

---

## Shadow & Press State Reference

### HTML Shadow Mappings:
| CSS Class | Shadow | Theme Equivalent |
|-----------|--------|------------------|
| `.neo-shadow` | `4px 4px 0px #000` | `SHADOW.sm` |
| `.neo-shadow-lg` | `8px 8px 0px #000` | `SHADOW.md` |

### Element Shadow Assignments:
| Element | Shadow | Press State |
|---------|--------|-------------|
| Notification button | `SHADOW.sm` | Move 4px, remove shadow |
| Balance Card | `SHADOW.md` | N/A (not pressable) |
| Nested USDC card | `SHADOW.sm` | N/A (not pressable) |
| Details button | `SHADOW.sm` | Move 4px, remove shadow |
| PAY button | `SHADOW.md` | Move 8px, remove shadow |
| RECEIVE button | `SHADOW.md` | Move 8px, remove shadow |
| Transaction items | `SHADOW.sm` | N/A (placeholder) |
| Tab icons (active) | `SHADOW.sm` | N/A |

### Press State Implementation Pattern:
```tsx
// For SHADOW.sm (4px offset) elements:
buttonPressed: {
  transform: [
    { translateX: SHADOW.sm.offset.width },  // 4px
    { translateY: SHADOW.sm.offset.height }, // 4px
  ],
  shadowOffset: { width: 0, height: 0 },
  elevation: 0,
}

// For SHADOW.md (8px offset) elements:
buttonPressed: {
  transform: [
    { translateX: SHADOW.md.offset.width },  // 8px
    { translateY: SHADOW.md.offset.height }, // 8px
  ],
  shadowOffset: { width: 0, height: 0 },
  elevation: 0,
}
```

---

## Task 1: Update Theme Colors

**Files:**

- Modify: `constants/theme.ts`

**Step 1: Add new colors for home redesign**

Add these new colors to `COLORS` object in `constants/theme.ts`:

```typescript
export const COLORS = {
  // ... existing colors ...
  
  // New colors for home redesign
  backgroundLight: "#f5f6f8",   // Light gray background
  green400: "#4ade80",          // Pay button background
  yellow400: "#facc15",         // Details button
  pink400: "#f472b6",           // Transaction icon
  cyan400: "#22d3ee",           // Transaction icon
  red500: "#ef4444",            // Negative amount
  textMuted: "#64748b",         // Muted text color
};
```

**Step 2: Commit**

```bash
git add constants/theme.ts
git commit -m "feat: add new colors for home redesign"
```

---

## Task 2: Create HomeHeader Component

**Files:**

- Create: `components/HomeHeader.tsx`

**Step 1: Create the component with press state**

Create `components/HomeHeader.tsx`:

```tsx
import { useState } from "react";
import { View, Text, StyleSheet, Pressable, Image } from "react-native";
import * as Haptics from "expo-haptics";
import { Ionicons } from "@expo/vector-icons";
import { usePrivy } from "@privy-io/expo";
import { COLORS, BORDER_THICK, SHADOW } from "../constants/theme";

export function HomeHeader() {
  const { user } = usePrivy();
  const [notificationPressed, setNotificationPressed] = useState(false);

  const getAvatarUrl = () => {
    const googleAccount = user?.linked_accounts?.find(
      (account) => account.type === "google_oauth"
    );
    return (googleAccount as { profile_picture_url?: string })?.profile_picture_url;
  };

  const handleNotificationPress = async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    // Add notification logic here
  };

  const avatarUrl = getAvatarUrl();

  return (
    <View style={styles.container}>
      <View style={styles.leftSection}>
        <View style={styles.avatar}>
          {avatarUrl ? (
            <Image source={{ uri: avatarUrl }} style={styles.avatarImage} />
          ) : (
            <Ionicons name="person" size={24} color={COLORS.textPrimary} />
          )}
        </View>
        <Text style={styles.title}>Bump Wallet</Text>
      </View>
      <Pressable
        onPress={handleNotificationPress}
        onPressIn={() => setNotificationPressed(true)}
        onPressOut={() => setNotificationPressed(false)}
        style={[
          styles.notificationButton,
          notificationPressed && styles.buttonPressed,
        ]}
      >
        <Ionicons name="notifications" size={24} color={COLORS.textPrimary} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: COLORS.surface,
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderBottomWidth: BORDER_THICK.width,
    borderColor: COLORS.border,
  },
  leftSection: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: BORDER_THICK.width,
    borderColor: COLORS.border,
    backgroundColor: `${COLORS.primaryBlue}20`,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  avatarImage: {
    width: "100%",
    height: "100%",
  },
  title: {
    fontSize: 20,
    fontWeight: "900",
    textTransform: "uppercase",
    letterSpacing: 0,
    fontStyle: "italic",
    color: COLORS.textPrimary,
  },
  notificationButton: {
    backgroundColor: COLORS.surface,
    padding: 8,
    borderWidth: BORDER_THICK.width,
    borderColor: COLORS.border,
    shadowColor: COLORS.border,
    shadowOffset: SHADOW.sm.offset,
    shadowOpacity: SHADOW.sm.opacity,
    shadowRadius: SHADOW.sm.radius,
    elevation: SHADOW.sm.elevation,
  },
  buttonPressed: {
    transform: [
      { translateX: SHADOW.sm.offset.width },
      { translateY: SHADOW.sm.offset.height },
    ],
    shadowOffset: { width: 0, height: 0 },
    elevation: 0,
  },
});
```

**Step 2: Commit**

```bash
git add components/HomeHeader.tsx
git commit -m "feat: add HomeHeader component with avatar and notification button"
```

---

## Task 3: Create BalanceCard Component

**Files:**

- Create: `components/BalanceCard.tsx`

**Step 1: Create the component with Details button press state**

Create `components/BalanceCard.tsx`:

```tsx
import { useState } from "react";
import { View, Text, StyleSheet, Pressable } from "react-native";
import * as Haptics from "expo-haptics";
import { COLORS, BORDER_THICK, SHADOW } from "../constants/theme";
import { TOKEN_SYMBOL } from "../lib/blockchain/contracts";
import { fromTokenUnits } from "../lib/blockchain/token-mint";

interface BalanceCardProps {
  balance: bigint;
  onDetailsPress: () => void;
}

export function BalanceCard({ balance, onDetailsPress }: BalanceCardProps) {
  const [detailsPressed, setDetailsPressed] = useState(false);

  const handleDetailsPress = async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    onDetailsPress();
  };

  const tokenBalance = fromTokenUnits(balance).toFixed(2);

  return (
    <View style={styles.container}>
      <View style={styles.decorativeCircle} />
      <View style={styles.content}>
        <Text style={styles.label}>Total Balance</Text>
        <Text style={styles.balance}>$0.00</Text>
        <View style={styles.nestedCard}>
          <View style={styles.nestedContent}>
            <View>
              <Text style={styles.nestedLabel}>{TOKEN_SYMBOL} Balance</Text>
              <Text style={styles.nestedBalance}>{tokenBalance} {TOKEN_SYMBOL}</Text>
            </View>
            <Pressable
              onPress={handleDetailsPress}
              onPressIn={() => setDetailsPressed(true)}
              onPressOut={() => setDetailsPressed(false)}
              style={[
                styles.detailsButton,
                detailsPressed && styles.detailsButtonPressed,
              ]}
            >
              <Text style={styles.detailsButtonText}>Details</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: COLORS.primaryBlue,
    borderWidth: BORDER_THICK.width,
    borderColor: COLORS.border,
    padding: 24,
    shadowColor: COLORS.border,
    shadowOffset: SHADOW.md.offset,
    shadowOpacity: SHADOW.md.opacity,
    shadowRadius: SHADOW.md.radius,
    elevation: SHADOW.md.elevation,
    overflow: "hidden",
  },
  decorativeCircle: {
    position: "absolute",
    right: -16,
    top: -16,
    width: 96,
    height: 96,
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    borderRadius: 48,
  },
  content: {
    zIndex: 1,
    gap: 4,
  },
  label: {
    color: COLORS.textInverted,
    fontSize: 14,
    fontWeight: "900",
    textTransform: "uppercase",
    letterSpacing: 3,
  },
  balance: {
    color: COLORS.textInverted,
    fontSize: 48,
    fontWeight: "900",
    letterSpacing: -1,
  },
  nestedCard: {
    marginTop: 24,
    backgroundColor: COLORS.surface,
    borderWidth: BORDER_THICK.width,
    borderColor: COLORS.border,
    padding: 16,
    shadowColor: COLORS.border,
    shadowOffset: SHADOW.sm.offset,
    shadowOpacity: SHADOW.sm.opacity,
    shadowRadius: SHADOW.sm.radius,
    elevation: SHADOW.sm.elevation,
  },
  nestedContent: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  nestedLabel: {
    fontSize: 12,
    fontWeight: "900",
    textTransform: "uppercase",
    color: COLORS.textMuted,
  },
  nestedBalance: {
    fontSize: 24,
    fontWeight: "900",
    fontStyle: "italic",
    color: COLORS.textPrimary,
  },
  detailsButton: {
    backgroundColor: COLORS.yellow400,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderWidth: BORDER_THICK.width,
    borderColor: COLORS.border,
    shadowColor: COLORS.border,
    shadowOffset: SHADOW.sm.offset,
    shadowOpacity: SHADOW.sm.opacity,
    shadowRadius: SHADOW.sm.radius,
    elevation: SHADOW.sm.elevation,
  },
  detailsButtonPressed: {
    transform: [
      { translateX: SHADOW.sm.offset.width },
      { translateY: SHADOW.sm.offset.height },
    ],
    shadowOffset: { width: 0, height: 0 },
    elevation: 0,
  },
  detailsButtonText: {
    fontSize: 14,
    fontWeight: "900",
    textTransform: "uppercase",
    color: COLORS.textPrimary,
  },
});
```

**Step 2: Commit**

```bash
git add components/BalanceCard.tsx
git commit -m "feat: add BalanceCard component with nested USDC card"
```

---

## Task 4: Update ActionButtons Component

**Files:**

- Modify: `components/ActionButtons.tsx`

**Step 1: Update the component to match HTML design with correct shadows**

Replace content of `components/ActionButtons.tsx`:

```tsx
import { useState } from "react";
import { View, Text, StyleSheet, Pressable } from "react-native";
import * as Haptics from "expo-haptics";
import { Ionicons } from "@expo/vector-icons";
import { COLORS, BORDER_THICK, SHADOW } from "../constants/theme";

interface ActionButtonsProps {
  onPay: () => void;
  onReceive: () => void;
}

export function ActionButtons({ onPay, onReceive }: ActionButtonsProps) {
  const [payPressed, setPayPressed] = useState(false);
  const [receivePressed, setReceivePressed] = useState(false);

  const handlePay = async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    onPay();
  };

  const handleReceive = async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    onReceive();
  };

  return (
    <View style={styles.container}>
      <Pressable
        onPress={handlePay}
        onPressIn={() => setPayPressed(true)}
        onPressOut={() => setPayPressed(false)}
        style={[
          styles.button,
          styles.payButton,
          payPressed && styles.buttonPressed,
        ]}
      >
        <Ionicons name="wallet" size={40} color={COLORS.textPrimary} />
        <Text style={[styles.buttonText, styles.payButtonText]}>PAY</Text>
      </Pressable>
      <Pressable
        onPress={handleReceive}
        onPressIn={() => setReceivePressed(true)}
        onPressOut={() => setReceivePressed(false)}
        style={[
          styles.button,
          styles.receiveButton,
          receivePressed && styles.buttonPressed,
        ]}
      >
        <Ionicons name="download" size={40} color={COLORS.textInverted} />
        <Text style={[styles.buttonText, styles.receiveButtonText]}>RECEIVE</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    gap: 24,
  },
  button: {
    flex: 1,
    paddingVertical: 24,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderWidth: BORDER_THICK.width,
    borderColor: COLORS.border,
    shadowColor: COLORS.border,
    shadowOffset: SHADOW.md.offset,
    shadowOpacity: SHADOW.md.opacity,
    shadowRadius: SHADOW.md.radius,
    elevation: SHADOW.md.elevation,
  },
  payButton: {
    backgroundColor: COLORS.green400,
  },
  receiveButton: {
    backgroundColor: COLORS.primaryBlue,
  },
  buttonPressed: {
    transform: [
      { translateX: SHADOW.md.offset.width },
      { translateY: SHADOW.md.offset.height },
    ],
    shadowOffset: { width: 0, height: 0 },
    elevation: 0,
  },
  buttonText: {
    fontSize: 24,
    fontWeight: "900",
    textTransform: "uppercase",
    fontStyle: "italic",
  },
  payButtonText: {
    color: COLORS.textPrimary,
  },
  receiveButtonText: {
    color: COLORS.textInverted,
  },
});
```

**Step 2: Commit**

```bash
git add components/ActionButtons.tsx
git commit -m "feat: update ActionButtons with icons and correct shadow/press states"
```

---

## Task 5: Create TransactionList Component (Placeholder)

**Files:**

- Create: `components/TransactionList.tsx`

**Step 1: Create the component with View All press state**

Create `components/TransactionList.tsx`:

```tsx
import { useState } from "react";
import { View, Text, StyleSheet, Pressable } from "react-native";
import * as Haptics from "expo-haptics";
import { COLORS, BORDER_THICK, SHADOW } from "../constants/theme";

interface TransactionListProps {
  onViewAll?: () => void;
}

export function TransactionList({ onViewAll }: TransactionListProps) {
  const [viewAllPressed, setViewAllPressed] = useState(false);

  const handleViewAll = async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onViewAll?.();
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Recent Activity</Text>
        <Pressable
          onPress={handleViewAll}
          onPressIn={() => setViewAllPressed(true)}
          onPressOut={() => setViewAllPressed(false)}
          style={viewAllPressed && styles.viewAllPressed}
        >
          <Text style={styles.viewAll}>View All</Text>
        </Pressable>
      </View>
      <View style={styles.placeholderCard}>
        <Text style={styles.placeholderText}>No recent transactions</Text>
        <Text style={styles.placeholderSubtext}>Your transaction history will appear here</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 16,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
  },
  title: {
    fontSize: 20,
    fontWeight: "900",
    textTransform: "uppercase",
    fontStyle: "italic",
    color: COLORS.textPrimary,
  },
  viewAll: {
    fontSize: 14,
    fontWeight: "700",
    textDecorationLine: "underline",
    textDecorationColor: COLORS.primaryBlue,
    color: COLORS.textPrimary,
  },
  viewAllPressed: {
    opacity: 0.6,
  },
  placeholderCard: {
    backgroundColor: COLORS.surface,
    borderWidth: BORDER_THICK.width,
    borderColor: COLORS.border,
    padding: 32,
    alignItems: "center",
    shadowColor: COLORS.border,
    shadowOffset: SHADOW.sm.offset,
    shadowOpacity: SHADOW.sm.opacity,
    shadowRadius: SHADOW.sm.radius,
    elevation: SHADOW.sm.elevation,
  },
  placeholderText: {
    fontSize: 16,
    fontWeight: "900",
    color: COLORS.textPrimary,
    marginBottom: 8,
  },
  placeholderSubtext: {
    fontSize: 14,
    fontWeight: "600",
    color: COLORS.textMuted,
  },
});
```

**Step 2: Commit**

```bash
git add components/TransactionList.tsx
git commit -m "feat: add TransactionList placeholder component"
```

---

## Task 6: Update Tab Layout with Icons

**Files:**

- Modify: `app/(tabs)/_layout.tsx`

**Step 1: Update the tab layout to include icons with correct shadows**

Replace content of `app/(tabs)/_layout.tsx`:

```tsx
import { Tabs } from "expo-router";
import * as Haptics from "expo-haptics";
import { View, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { COLORS, BORDER_THICK, SHADOW } from "../../constants/theme";

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          position: "absolute",
          backgroundColor: COLORS.surface,
          borderTopWidth: BORDER_THICK.width,
          borderColor: COLORS.border,
          marginBottom: 0,
          height: 80,
          paddingBottom: 8,
          paddingTop: 8,
        },
        tabBarItemStyle: {
          justifyContent: "center",
          alignItems: "center",
          gap: 4,
        },
        tabBarActiveBackgroundColor: "transparent",
        tabBarInactiveBackgroundColor: "transparent",
        tabBarActiveTintColor: COLORS.primaryBlue,
        tabBarInactiveTintColor: COLORS.textMuted,
        tabBarLabelStyle: {
          fontWeight: "900",
          fontSize: 10,
          letterSpacing: 1,
          textTransform: "uppercase",
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Home",
          tabBarIcon: ({ focused }) => (
            <View
              style={[
                styles.iconContainer,
                focused && styles.iconContainerActive,
              ]}
            >
              <Ionicons
                name="home"
                size={24}
                color={focused ? COLORS.textInverted : COLORS.textPrimary}
              />
            </View>
          ),
        }}
        listeners={{
          tabPress: () => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
          },
        }}
      />
      <Tabs.Screen
        name="history"
        options={{
          title: "History",
          tabBarIcon: ({ focused }) => (
            <View
              style={[
                styles.iconContainer,
                focused && styles.iconContainerActive,
              ]}
            >
              <Ionicons
                name="time"
                size={24}
                color={focused ? COLORS.textInverted : COLORS.textPrimary}
              />
            </View>
          ),
        }}
        listeners={{
          tabPress: () => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
          },
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: "Settings",
          tabBarIcon: ({ focused }) => (
            <View
              style={[
                styles.iconContainer,
                focused && styles.iconContainerActive,
              ]}
            >
              <Ionicons
                name="settings"
                size={24}
                color={focused ? COLORS.textInverted : COLORS.textPrimary}
              />
            </View>
          ),
        }}
        listeners={{
          tabPress: () => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
          },
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  iconContainer: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: BORDER_THICK.width,
    borderColor: COLORS.border,
    backgroundColor: COLORS.surface,
  },
  iconContainerActive: {
    backgroundColor: COLORS.primaryBlue,
    shadowColor: COLORS.border,
    shadowOffset: SHADOW.sm.offset,
    shadowOpacity: SHADOW.sm.opacity,
    shadowRadius: SHADOW.sm.radius,
    elevation: SHADOW.sm.elevation,
  },
});
```

**Step 2: Commit**

```bash
git add app/(tabs)/_layout.tsx
git commit -m "feat: add icons to tab bar with neobrutalist styling"
```

---

## Task 7: Redesign Home Screen

**Files:**

- Modify: `app/(tabs)/index.tsx`

**Step 1: Completely redesign the home screen**

Replace content of `app/(tabs)/index.tsx`:

```tsx
import { useEffect, useRef } from "react";
import { View, Text, StyleSheet, ScrollView } from "react-native";
import { useRouter } from "expo-router";
import { usePrivy } from "@privy-io/expo";
import { HomeHeader } from "../../components/HomeHeader";
import { BalanceCard } from "../../components/BalanceCard";
import { ActionButtons } from "../../components/ActionButtons";
import { TransactionList } from "../../components/TransactionList";
import { COLORS } from "../../constants/theme";
import { useBalance } from "../../lib/balance-context";

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good Morning,";
  if (hour < 18) return "Good Afternoon,";
  return "Good Evening,";
}

export default function HomeScreen() {
  const router = useRouter();
  const { user, isReady } = usePrivy();
  const { state: balanceState, prefetchBalance } = useBalance();
  const hasInitialized = useRef(false);

  useEffect(() => {
    if (isReady && !user) {
      router.replace("/login");
    }
  }, [isReady, router, user]);

  useEffect(() => {
    if (user && !hasInitialized.current) {
      hasInitialized.current = true;
      prefetchBalance();
    }
  }, [user, prefetchBalance]);

  if (!isReady || !user) {
    return (
      <View style={styles.container}>
        <View style={styles.loadingBox}>
          <Text style={styles.loadingText}>LOADING...</Text>
        </View>
      </View>
    );
  }

  const handlePay = () => {
    router.push("/pay" as never);
  };

  const handleReceive = () => {
    router.push("/receive" as never);
  };

  const handleDetails = () => {
    router.push("/(tabs)/settings" as never);
  };

  const handleViewAll = () => {
    router.push("/(tabs)/history" as never);
  };

  return (
    <View style={styles.container}>
      <HomeHeader />
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.greetingSection}>
          <Text style={styles.greeting}>{getGreeting()}</Text>
          <Text style={styles.subtitle}>Ready to bump some USDC?</Text>
        </View>

        <BalanceCard
          balance={balanceState.balance}
          onDetailsPress={handleDetails}
        />

        <View style={styles.actionSection}>
          <ActionButtons onPay={handlePay} onReceive={handleReceive} />
        </View>

        <View style={styles.transactionSection}>
          <TransactionList onViewAll={handleViewAll} />
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
    paddingBottom: 100,
  },
  greetingSection: {
    marginBottom: 32,
  },
  greeting: {
    fontSize: 36,
    fontWeight: "900",
    textTransform: "uppercase",
    fontStyle: "italic",
    color: COLORS.primaryBlue,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 18,
    fontWeight: "700",
    color: COLORS.textPrimary,
    opacity: 0.7,
    marginTop: 4,
  },
  actionSection: {
    marginTop: 32,
  },
  transactionSection: {
    marginTop: 32,
  },
});
```

**Step 2: Commit**

```bash
git add app/(tabs)/index.tsx
git commit -m "feat: redesign home screen to match HTML design"
```

---

## Task 8: Update History and Settings Screens Background

**Files:**

- Modify: `app/(tabs)/history.tsx`
- Modify: `app/(tabs)/settings.tsx`

**Step 1: Update history.tsx background color**

In `app/(tabs)/history.tsx`, change the container backgroundColor:

```tsx
// In styles object, change:
container: {
  flex: 1,
  backgroundColor: COLORS.backgroundLight, // Changed from COLORS.background
  ...
},
```

**Step 2: Update settings.tsx background color**

In `app/(tabs)/settings.tsx`, change the container backgroundColor:

```tsx
// In styles object, change:
container: {
  flex: 1,
  backgroundColor: COLORS.backgroundLight, // Changed from COLORS.background
  ...
},
```

**Step 3: Commit**

```bash
git add app/(tabs)/history.tsx app/(tabs)/settings.tsx
git commit -m "feat: update tab screens background to light gray"
```

---

## Task 9: Final Verification

**Step 1: Start the development server**

```bash
npm start
```

**Step 2: Test the complete flow**

1. App loads → Splash screen (keep yellow background)
2. Login screen (keep yellow background)
3. After login → Home screen with light gray background
4. Verify header with avatar and notification button (press to check animation)
5. Verify greeting with time-based message
6. Verify balance card with blue background and 8px shadow
7. Verify nested USDC card with 4px shadow
8. Press Details button → should move 4px and shadow disappears
9. Press PAY button → should move 8px and shadow disappears
10. Press RECEIVE button → should move 8px and shadow disappears
11. Press View All → should navigate to History
12. Verify tab bar icons work correctly with 4px shadow on active
13. Navigate to History and Settings - verify light gray background

**Step 3: Final commit (if any fixes needed)**

```bash
git add -A
git commit -m "fix: final adjustments for home redesign"
```

---

## Summary

| Task | Description              | Files                                                      |
| ---- | ------------------------ | ---------------------------------------------------------- |
| 1    | Update theme colors      | `constants/theme.ts`                                       |
| 2    | Create HomeHeader        | `components/HomeHeader.tsx`                                |
| 3    | Create BalanceCard       | `components/BalanceCard.tsx`                               |
| 4    | Update ActionButtons     | `components/ActionButtons.tsx`                             |
| 5    | Create TransactionList   | `components/TransactionList.tsx`                           |
| 6    | Update tab layout icons  | `app/(tabs)/_layout.tsx`                                   |
| 7    | Redesign home screen     | `app/(tabs)/index.tsx`                                     |
| 8    | Update tab backgrounds   | `app/(tabs)/history.tsx`, `app/(tabs)/settings.tsx`        |
| 9    | Verification             | Test complete flow                                         |
