import AsyncStorage from "@react-native-async-storage/async-storage";

export async function loadJSON<T>(key: string, fallback: T): Promise<T> {
  const raw = await AsyncStorage.getItem(key);
  return raw ? (JSON.parse(raw) as T) : fallback;
}

export async function saveJSON(key: string, value: unknown) {
  await AsyncStorage.setItem(key, JSON.stringify(value));
}
