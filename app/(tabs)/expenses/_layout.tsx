import { Stack } from "expo-router";

export default function ExpensesStackLayout() {
  return (
    <Stack>
      <Stack.Screen name="index" options={{ title: "Expenses" }} />
      <Stack.Screen name="add" options={{ title: "Add Expense", headerBackTitle: "Expenses" }} />
      <Stack.Screen name="[id]" options={{ title: "Edit Expense", headerBackTitle: "Expenses" }} />
    </Stack>
  );
}
