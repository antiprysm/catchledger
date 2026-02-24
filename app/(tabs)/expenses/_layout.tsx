import { Stack } from "expo-router";
import { useTranslation } from "react-i18next";

export default function ExpensesStackLayout() {
  const { t } = useTranslation();

  return (
    <Stack>
      <Stack.Screen name="index" options={{ title: t("expenses.title") }} />
      <Stack.Screen name="add" options={{ title: t("expenses.addExpense"), headerBackTitle: t("expenses.title") }} />
      <Stack.Screen name="[id]" options={{ title: t("expenses.editExpense"), headerBackTitle: t("expenses.title") }} />
    </Stack>
  );
}
