import { Tabs } from "expo-router";
import * as Haptics from "expo-haptics";
import { View, StyleSheet, Text, Pressable } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { COLORS, BORDER_THICK } from "../../constants/theme";
import { Fragment } from "react";

type TabBarProps = {
  state: any;
  descriptors: any;
  navigation: any;
};

function CustomTabBar({ state, descriptors, navigation }: TabBarProps) {
  const insets = useSafeAreaInsets();

  return (
    <View
      style={[
        styles.tabBar,
        {
          height: 90 + insets.bottom,
          paddingBottom: insets.bottom + 8,
          paddingTop: 8,
        },
      ]}
    >
      {state.routes.map((route: any, index: number) => {
        const { options } = descriptors[route.key];
        const label = options.title || route.name;
        const subLabel = route.name === "history" ? "privacy · bitgo" : null;
        const isFocused = state.index === index;

        const onPress = () => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
          const event = navigation.emit({
            type: "tabPress",
            target: route.key,
            canPreventDefault: true,
          });

          if (!isFocused && !event.defaultPrevented) {
            navigation.navigate(route.name);
          }
        };

        const icon = options.tabBarIcon?.({ focused: isFocused });

        return (
          <Fragment key={route.key}>
            {index > 0 && <View style={styles.separator} />}
            <Pressable
              onPress={onPress}
              style={styles.tabItem}
              accessibilityRole="button"
              accessibilityState={isFocused ? { selected: true } : {}}
            >
              {icon}
              <View style={styles.labelStack}>
                <Text
                  style={[
                    styles.tabLabel,
                    { color: isFocused ? COLORS.primaryBlue : COLORS.textMuted },
                  ]}
                >
                  {label}
                </Text>
                {subLabel ? (
                  <Text
                    style={[
                      styles.tabSubLabel,
                      { color: isFocused ? COLORS.primaryBlue : COLORS.textMuted },
                    ]}
                  >
                    {subLabel}
                  </Text>
                ) : null}
              </View>
            </Pressable>
          </Fragment>
        );
      })}
    </View>
  );
}

export default function TabLayout() {
  return (
    <Tabs
      tabBar={(props) => <CustomTabBar {...props} />}
      screenOptions={{
        headerShown: false,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Home",
          tabBarIcon: ({ focused }) => (
            <View style={focused ? styles.iconShadow : null}>
              <View style={[styles.iconContainer, focused && styles.iconContainerActive]}>
                <Ionicons
                  name="home"
                  size={24}
                  color={focused ? COLORS.textInverted : COLORS.textPrimary}
                />
              </View>
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="history"
        options={{
          title: "Merchant",
          tabBarIcon: ({ focused }) => (
            <View style={focused ? styles.iconShadow : null}>
              <View style={[styles.iconContainer, focused && styles.iconContainerActive]}>
                <Ionicons
                  name="time"
                  size={24}
                  color={focused ? COLORS.textInverted : COLORS.textPrimary}
                />
              </View>
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="merchant"
        options={{
          title: "Merchant",
          tabBarIcon: ({ focused }) => (
            <View style={focused ? styles.iconShadow : null}>
              <View style={[styles.iconContainer, focused && styles.iconContainerActive]}>
                <Ionicons
                  name="cart"
                  size={24}
                  color={focused ? COLORS.textInverted : COLORS.textPrimary}
                />
              </View>
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: "Settings",
          tabBarIcon: ({ focused }) => (
            <View style={focused ? styles.iconShadow : null}>
              <View style={[styles.iconContainer, focused && styles.iconContainerActive]}>
                <Ionicons
                  name="settings"
                  size={24}
                  color={focused ? COLORS.textInverted : COLORS.textPrimary}
                />
              </View>
            </View>
          ),
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    flexDirection: "row",
    backgroundColor: COLORS.surface,
    borderTopWidth: BORDER_THICK.width,
    borderColor: COLORS.border,
  },
  separator: {
    width: BORDER_THICK.width,
    backgroundColor: COLORS.border,
  },
  tabItem: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    gap: 8,
    paddingVertical: 4,
  },
  labelStack: {
    alignItems: "center",
    minHeight: 28,
  },
  tabLabel: {
    fontWeight: "900",
    fontSize: 10,
    letterSpacing: 1,
    textTransform: "uppercase",
    marginTop: 8,
  },
  tabSubLabel: {
    fontWeight: "800",
    fontSize: 8,
    letterSpacing: 0.5,
    textTransform: "none",
    marginTop: 2,
  },
  iconShadow: {
    backgroundColor: COLORS.border,
  },
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
    transform: [{ translateX: -4 }, { translateY: -4 }],
  },
});
