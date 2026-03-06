import { IconSymbol } from "@/components/ui/icon-symbol";
import { ThemeContext } from "@/theme/ThemeProvider";
import { Tabs } from "expo-router";
import React from "react";
import { useTranslation } from "react-i18next";
import { View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export default function TabLayout() {
  const { t } = useTranslation();
  const { colors } = React.useContext(ThemeContext);
  const insets = useSafeAreaInsets();

  const bottomInset = insets.bottom;
  const tabBarBaseHeight = 56;
  const lift = 6;

  const liftedIcon =
    (name: React.ComponentProps<typeof IconSymbol>["name"]) =>
    ({ color }: { color: string }) =>
      (
        <View style={{ transform: [{ translateY: -lift }] }}>
          <IconSymbol name={name} color={color} size={24} />
        </View>
      );

  return (
    <Tabs
      screenOptions={{
        headerShown: true,
        headerStyle: { backgroundColor: colors.surface },
        headerTintColor: colors.text,
        headerTitleStyle: { color: colors.text },

        tabBarActiveTintColor: colors.tabActive,
        tabBarInactiveTintColor: colors.tabInactive,

        tabBarStyle: {
          backgroundColor: colors.tabBarBg,
          borderTopColor: colors.border,
          shadowColor: colors.shadow,
          height: tabBarBaseHeight + bottomInset,
          paddingBottom: bottomInset,
          paddingTop: 4,
        },

        tabBarLabelStyle: {
          fontSize: 12,
          transform: [{ translateY: -lift }],
        },
      }}
    >
      <Tabs.Screen
        name="dashboard"
        options={{
          title: t("tabs.dashboard"),
          tabBarIcon: liftedIcon("ferry.fill"),
        }}
      />
      <Tabs.Screen
        name="inventory"
        options={{
          title: t("tabs.inventory"),
          headerShown: false,
          tabBarIcon: liftedIcon("fish.fill"),
        }}
      />
      <Tabs.Screen
        name="sales"
        options={{
          title: t("tabs.sales"),
          headerShown: false,
          tabBarIcon: liftedIcon("dollarsign.circle.fill"),
        }}
      />
      <Tabs.Screen
        name="expenses"
        options={{
          title: t("tabs.expenses"),
          headerShown: false,
          tabBarIcon: liftedIcon("doc.text.fill"),
        }}
      />
      <Tabs.Screen
        name="reports"
        options={{
          title: t("tabs.reports"),
          tabBarIcon: liftedIcon("scroll.fill"),
        }}
      />
      <Tabs.Screen
        name="compliance"
        options={{
          title: t("tabs.compliance"),
          headerShown: false,
          tabBarIcon: liftedIcon("checkmark.shield.fill"),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: t("tabs.settings"),
          tabBarIcon: liftedIcon("gearshape.fill"),
        }}
      />
    </Tabs>
  );
}