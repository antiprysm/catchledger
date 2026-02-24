import AsyncStorage from "@react-native-async-storage/async-storage";
import { I18nManager } from "react-native";
import i18n from "i18next";
import { initReactI18next } from "react-i18next";

import ar from "@/i18n/ar.json";
import en from "@/i18n/en.json";
import es from "@/i18n/es.json";
import hi from "@/i18n/hi.json";
import zh from "@/i18n/zh.json";

export type SupportedLanguage = "en" | "es" | "zh" | "hi" | "ar";

const RTL_NOTICE_KEY = "catchledger_rtl_notice_shown";
<<<<<<< codex/add-i18n-support-with-language-switching-ls18m7
let initialized = false;

export async function ensureI18nInitialized() {
  if (initialized) return i18n;

  await i18n.use(initReactI18next).init({
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
  });

  initialized = true;

  if (__DEV__) {
    console.log("[i18n] initialized language:", i18n.language);
  }

  return i18n;
}

void ensureI18nInitialized();

export async function applyLanguage(language: SupportedLanguage) {
  await ensureI18nInitialized();
  await i18n.changeLanguage(language);

  if (__DEV__) {
    console.log("[i18n] language after changeLanguage:", i18n.language);
  }

  const wantsRTL = language === "ar";
  const rtlChanged = I18nManager.isRTL !== wantsRTL;

=======

void i18n.use(initReactI18next).init({
  lng: "en",
  fallbackLng: "en",
  compatibilityJSON: "v4",
  interpolation: { escapeValue: false },
  resources: {
    en: { translation: en },
    es: { translation: es },
    zh: { translation: zh },
    hi: { translation: hi },
    ar: { translation: ar },
  },
});

export async function applyLanguage(language: SupportedLanguage) {
  await i18n.changeLanguage(language);

  const wantsRTL = language === "ar";
  const rtlChanged = I18nManager.isRTL !== wantsRTL;
>>>>>>> main
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
  return { shouldShowRtlRestartPrompt };
}

export default i18n;
