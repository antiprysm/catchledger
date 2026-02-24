import { Stack } from "expo-router";
import { useTranslation } from "react-i18next";

export default function SalesStackLayout() {
  const { t } = useTranslation();

  return (
    <Stack>
      <Stack.Screen name="index" options={{ title: t("sales.title") }} />
      <Stack.Screen name="new" options={{ title: t("sales.newSale"), headerBackTitle: t("sales.title") }} />
      <Stack.Screen name="[id]" options={{ title: t("sales.editSale"), headerBackTitle: t("sales.title") }} />
    </Stack>
  );
}
