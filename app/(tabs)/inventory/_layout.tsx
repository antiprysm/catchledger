import { Stack } from "expo-router";
import { useTranslation } from "react-i18next";

export default function InventoryStackLayout() {
  const { t } = useTranslation();

  return (
    <Stack>
      <Stack.Screen name="index" options={{ title: t("inventory.title") }} />
      <Stack.Screen
        name="add"
        options={{
          title: t("inventory.addFish"),
          headerBackTitle: t("inventory.title"),
        }}
      />
      <Stack.Screen
        name="[id]"
        options={{
          title: t("inventory.editFish"),
          headerBackTitle: t("inventory.title"),
        }}
      />
    </Stack>
  );
}
