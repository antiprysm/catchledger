import AsyncStorage from "@react-native-async-storage/async-storage";
import { Redirect } from "expo-router";
import { useEffect, useState } from "react";
import { View } from "react-native";

import { applyLanguage, ensureI18nInitialized, type SupportedLanguage } from "@/i18n";
import { getInitialLanguage } from "@/utils/getInitialLanguage";
import { getSavedLanguage, saveLanguage } from "@/utils/languageStorage";

const ONBOARDING_KEY = "catchledger_onboarding_done_v1";

export default function Index() {
  const [target, setTarget] = useState<string | null>(null);

  useEffect(() => {
    async function initializeApp() {
      await ensureI18nInitialized();

      const savedLanguage = await getSavedLanguage();

      if (savedLanguage) {
        await applyLanguage(savedLanguage as SupportedLanguage);
      } else {
        const detectedLanguage = getInitialLanguage() as SupportedLanguage;
        await applyLanguage(detectedLanguage);
        await saveLanguage(detectedLanguage);
      }

      const done = await AsyncStorage.getItem(ONBOARDING_KEY);
      setTarget(done ? "/(tabs)/dashboard" : "/onboarding");
    }

    initializeApp();
  }, []);

  if (!target) {
    return <View style={{ flex: 1, backgroundColor: "#FFFFFF" }} />;
  }

  return <Redirect href={target as any} />;
}