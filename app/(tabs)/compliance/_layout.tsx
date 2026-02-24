import { Stack } from "expo-router";
import { useTranslation } from "react-i18next";

export default function ComplianceStackLayout() {
  const { t } = useTranslation();

  return (
    <Stack>
        <Stack.Screen name="index" options={{ title: t("compliance.title") }} />
        <Stack.Screen name="today" options={{ title: t("compliance.today"), headerBackTitle: t("compliance.title") }} />
        <Stack.Screen name="range" options={{ title: t("compliance.dateRange"), headerBackTitle: t("compliance.title") }} />
        <Stack.Screen name="profile" options={{ title: t("compliance.licenseProfile") }} />
        <Stack.Screen name="inspection" options={{ title: t("compliance.inspectionControls"), headerBackTitle: t("compliance.title") }} />
        <Stack.Screen name="week" options={{ title: t("compliance.last7Days"), headerBackTitle: t("compliance.title") }} />
    </Stack>

  );
}
