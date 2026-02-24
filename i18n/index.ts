import AsyncStorage from "@react-native-async-storage/async-storage";
import { I18nManager } from "react-native";
import { createInstance } from "i18next";
import { initReactI18next } from "react-i18next";

import ar from "@/i18n/ar.json";
import en from "@/i18n/en.json";
import es from "@/i18n/es.json";
import hi from "@/i18n/hi.json";
import zh from "@/i18n/zh.json";

export type SupportedLanguage = "en" | "es" | "zh" | "hi" | "ar";

const RTL_NOTICE_KEY = "catchledger_rtl_notice_shown";
const i18n = createInstance();
let initPromise: Promise<typeof i18n> | null = null;

export async function ensureI18nInitialized() {
  if (i18n.isInitialized) return i18n;
  if (initPromise) return initPromise;

  initPromise = i18n.use(initReactI18next).init({
      lng: "en",
      fallbackLng: false,
      compatibilityJSON: "v4",
      interpolation: { escapeValue: false },
      returnNull: false,
      resources: {
        en: { translation: en },
        es: { translation: es },
        zh: { translation: zh },
        hi: { translation: hi },
        ar: { translation: ar },
      },
    })
    .then(() => i18n)
    .catch((error) => {
      initPromise = null;
      throw error;
    });

  await initPromise;

  if (__DEV__) {
    console.log("[i18n] initialized language:", i18n.language);
  }

  return i18n;
}

void ensureI18nInitialized();

export async function applyLanguage(language: SupportedLanguage) {
  const instance = await ensureI18nInitialized();
  await instance.changeLanguage(language);

  if (__DEV__) {
    console.log("[i18n] language after changeLanguage:", i18n.language);
  }

  const wantsRTL = language === "ar";
  const rtlChanged = I18nManager.isRTL !== wantsRTL;

  if (rtlChanged) {
    I18nManager.allowRTL(wantsRTL);
    I18nManager.forceRTL(wantsRTL);
  }

  const hasShownNotice = (await AsyncStorage.getItem(RTL_NOTICE_KEY)) === "1";
  const shouldShowRtlRestartPrompt = rtlChanged && !hasShownNotice;

  if (shouldShowRtlRestartPrompt) {
    await AsyncStorage.setItem(RTL_NOTICE_KEY, "1");
  }

  return { shouldShowRtlRestartPrompt, rtlChanged };
}

export default i18n;
