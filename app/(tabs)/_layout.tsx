import { IconSymbol } from "@/components/ui/icon-symbol";
import { ThemeContext } from "@/theme/ThemeProvider";
import { Tabs } from "expo-router";
import React from "react";
import { useTranslation } from "react-i18next";

export default function TabLayout() {
  const { t } = useTranslation();
  const { colors } = React.useContext(ThemeContext);

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
        },
      }}
    >
      <Tabs.Screen
        name="dashboard"
        options={{
          title: t("tabs.dashboard"),
          tabBarIcon: ({ color }) => <IconSymbol name="ferry.fill" color={color} size={24} />,
        }}
      />
      <Tabs.Screen
        name="inventory"
        options={{
          title: t("tabs.inventory"),
          headerShown: false,
          tabBarIcon: ({ color }) => <IconSymbol name="fish.fill" color={color} size={24} />,
        }}
      />
      <Tabs.Screen
        name="sales"
        options={{
          title: t("tabs.sales"),
          headerShown: false,
          tabBarIcon: ({ color }) => (
            <IconSymbol name="dollarsign.circle.fill" color={color} size={24} />
          ),
        }}
      />
      <Tabs.Screen
        name="expenses"
        options={{
          title: t("tabs.expenses"),
          headerShown: false,
          tabBarIcon: ({ color }) => (
            <IconSymbol name="doc.text.fill" color={color} size={24} />
          ),
        }}
      />
      <Tabs.Screen
        name="reports"
        options={{
          title: t("tabs.reports"),
          tabBarIcon: ({ color }) => <IconSymbol name="scroll.fill" color={color} size={24} />,
        }}
      />
      <Tabs.Screen
        name="compliance"
        options={{
          title: t("tabs.compliance"),
          headerShown: false,
          tabBarIcon: ({ color }) => (
            <IconSymbol name="checkmark.shield.fill" color={color} size={24} />
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: t("tabs.settings"),
          tabBarIcon: ({ color }) => (
            <IconSymbol name="gearshape.fill" color={color} size={24} />
          ),
        }}
      />
    </Tabs>
  );
}
