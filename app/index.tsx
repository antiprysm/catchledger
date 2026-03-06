import AsyncStorage from "@react-native-async-storage/async-storage";
import { Redirect } from "expo-router";
import { useEffect, useState } from "react";
import { I18nManager } from "react-native";

import i18n from "@/i18n";
import { getInitialLanguage } from "@/utils/getInitialLanguage";
import { getSavedLanguage, saveLanguage } from "@/utils/languageStorage";

const ONBOARDING_KEY = "catchledger_onboarding_done_v1";

export default function Index() {
  const [target, setTarget] = useState<string | null>(null);

  useEffect(() => {
    async function initializeApp() {
      const savedLanguage = await getSavedLanguage();

      if (savedLanguage) {
        await i18n.changeLanguage(savedLanguage);
      } else {
        const detectedLanguage = getInitialLanguage();

        if (detectedLanguage === "ar") {
          I18nManager.allowRTL(true);
          I18nManager.forceRTL(true);
        } else {
          I18nManager.allowRTL(false);
          I18nManager.forceRTL(false);
        }

        await i18n.changeLanguage(detectedLanguage);
        await saveLanguage(detectedLanguage);
      }

      const done = await AsyncStorage.getItem(ONBOARDING_KEY);
      setTarget(done ? "/(tabs)/dashboard" : "/onboarding");
    }

    initializeApp();
  }, []);

  if (!target) return null;

  return <Redirect href={target as any} />;
}
