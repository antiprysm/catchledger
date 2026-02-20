import { Stack } from "expo-router";

export default function SalesStackLayout() {
  return (
    <Stack>
      <Stack.Screen name="index" options={{ title: "Sales" }} />
      <Stack.Screen name="new" options={{ title: "New Sale", headerBackTitle: "Sales" }} />
      <Stack.Screen name="[id]" options={{ title: "Edit Sale", headerBackTitle: "Sales" }} />
    </Stack>
  );
}
