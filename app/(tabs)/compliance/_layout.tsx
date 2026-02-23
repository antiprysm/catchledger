import { Stack } from "expo-router";

export default function ComplianceStackLayout() {
  return (
    <Stack>
        <Stack.Screen name="index" options={{ title: "Compliance" }} />
        <Stack.Screen name="today" options={{ title: "Today", headerBackTitle: "Compliance" }} />
        <Stack.Screen name="range" options={{ title: "Date Range", headerBackTitle: "Compliance" }} />
        <Stack.Screen name="profile" options={{ title: "License Profile" }} />
        <Stack.Screen name="inspection" options={{ title: "Inspection Controls", headerBackTitle: "Compliance" }} />
        <Stack.Screen name="week" options={{ title: "Last 7 Days", headerBackTitle: "Compliance" }} />
    </Stack>

  );
}
