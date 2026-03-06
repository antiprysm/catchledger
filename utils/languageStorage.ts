import AsyncStorage from "@react-native-async-storage/async-storage";

const LANGUAGE_KEY = "catchledger_language_v1";

export async function getSavedLanguage(): Promise<string | null> {
  return AsyncStorage.getItem(LANGUAGE_KEY);
}

export async function saveLanguage(language: string): Promise<void> {
  await AsyncStorage.setItem(LANGUAGE_KEY, language);
}

export async function clearLanguage(): Promise<void> {
  await AsyncStorage.removeItem(LANGUAGE_KEY);
}
