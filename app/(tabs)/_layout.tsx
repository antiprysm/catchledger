import { Tabs } from "expo-router";

export default function TabLayout() {
  return (
    <Tabs screenOptions={{ headerShown: true }}>
      <Tabs.Screen name="dashboard" options={{ title: "Dashboard" }} />
      <Tabs.Screen name="inventory" options={{ title: "Inventory", headerShown: false }} />

      {/* ✅ Sales stack (log + new + edit) */}
      <Tabs.Screen name="sales" options={{ title: "Sales", headerShown: false }} />

      <Tabs.Screen name="expenses" options={{ title: "Expenses", headerShown: false }} />
      <Tabs.Screen name="reports" options={{ title: "Reports" }} />

      {/* ✅ New */}
      <Tabs.Screen name="compliance" options={{ title: "Compliance", headerShown: false }} />

      <Tabs.Screen name="settings" options={{ title: "Settings" }} />
    </Tabs>
  );
}
