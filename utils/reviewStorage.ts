import AsyncStorage from "@react-native-async-storage/async-storage";

export const REVIEW_KEYS = {
  SUCCESS_COUNT: "@review_success_count",
  LAST_PROMPT: "@review_last_prompt",
  HAS_REVIEWED: "@review_has_reviewed",
};

export const getNumber = async (key: string): Promise<number> => {
  const val = await AsyncStorage.getItem(key);
  return val ? parseInt(val) : 0;
};

export const setNumber = async (key: string, value: number): Promise<void> => {
  await AsyncStorage.setItem(key, value.toString());
};

export const incrementNumber = async (key: string): Promise<number> => {
  const current = await getNumber(key);
  const next = current + 1;
  await setNumber(key, next);
  return next;
};