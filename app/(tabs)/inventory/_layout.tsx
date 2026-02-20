import { Stack } from "expo-router";

export default function InventoryStackLayout() {
  return (
    <Stack>
      <Stack.Screen name="index" options={{ title: "Inventory" }} />
      <Stack.Screen
        name="add"
        options={{
          title: "Add Fish",
          headerBackTitle: "Inventory",
        }}
      />
      <Stack.Screen
        name="[id]"
        options={{
          title: "Edit Fish",
          headerBackTitle: "Inventory",
        }}
      />
    </Stack>
  );
}
