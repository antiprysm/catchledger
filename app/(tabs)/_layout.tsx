import { Tabs } from "expo-router";
import { useTranslation } from "react-i18next";

export default function TabLayout() {
  const { t } = useTranslation();

  return (
    <Tabs screenOptions={{ headerShown: true }}>
      <Tabs.Screen name="dashboard" options={{ title: t("tabs.dashboard") }} />
      <Tabs.Screen name="inventory" options={{ title: t("tabs.inventory"), headerShown: false }} />
      <Tabs.Screen name="sales" options={{ title: t("tabs.sales"), headerShown: false }} />
      <Tabs.Screen name="expenses" options={{ title: t("tabs.expenses"), headerShown: false }} />
      <Tabs.Screen name="reports" options={{ title: t("tabs.reports") }} />
      <Tabs.Screen name="compliance" options={{ title: t("tabs.compliance"), headerShown: false }} />
      <Tabs.Screen name="settings" options={{ title: t("tabs.settings") }} />
    </Tabs>
  );
}
