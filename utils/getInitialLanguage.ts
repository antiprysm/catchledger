import { getLocales } from "expo-localization";

const SUPPORTED_LANGUAGES = new Set(["ar", "en", "es", "hi", "zh"]);

export function getInitialLanguage(): string {
  const primaryLocale = getLocales()[0];
  const localeTag = primaryLocale?.languageTag ?? "";
  const languageCode = localeTag.split("-")[0]?.toLowerCase() ?? "";

  if (SUPPORTED_LANGUAGES.has(languageCode)) {
    return languageCode;
  }

  return "en";
}
