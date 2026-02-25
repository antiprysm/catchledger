import * as SecureStore from "expo-secure-store";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";

const PASSCODE_KEY = "catchledger_passcode";
const BIOMETRIC_TOKEN_KEY = "catchledger_biometric_token";

const canUseSecureStore =
  Platform.OS !== "web"
  && typeof SecureStore.getItemAsync === "function"
  && typeof SecureStore.setItemAsync === "function"
  && typeof SecureStore.deleteItemAsync === "function";

export async function setPasscode(passcode: string) {
  if (canUseSecureStore) {
    try {
      await SecureStore.setItemAsync(PASSCODE_KEY, passcode);
      return;
    } catch {
      // Fall back to AsyncStorage in environments where SecureStore is unavailable.
    }
  }
  await AsyncStorage.setItem(PASSCODE_KEY, passcode);
}

export async function getPasscode() {
  if (canUseSecureStore) {
    try {
      return await SecureStore.getItemAsync(PASSCODE_KEY);
    } catch {
      // Fall back to AsyncStorage in environments where SecureStore is unavailable.
    }
  }
  return AsyncStorage.getItem(PASSCODE_KEY);
}

export async function clearPasscode() {
  if (canUseSecureStore) {
    try {
      await SecureStore.deleteItemAsync(PASSCODE_KEY);
      return;
    } catch {
      // Fall back to AsyncStorage in environments where SecureStore is unavailable.
    }
  }
  await AsyncStorage.removeItem(PASSCODE_KEY);
}

export async function ensureBiometricToken() {
  if (!canUseSecureStore) return;
  try {
    const existing = await SecureStore.getItemAsync(BIOMETRIC_TOKEN_KEY);
    if (!existing) {
      await SecureStore.setItemAsync(BIOMETRIC_TOKEN_KEY, "ok", {
        requireAuthentication: true,
      });
    }
  } catch {
    // Ignore when biometrics are not supported in this runtime.
  }
}

export async function unlockWithBiometric() {
  if (!canUseSecureStore) return false;
  try {
    const token = await SecureStore.getItemAsync(BIOMETRIC_TOKEN_KEY, {
      requireAuthentication: true,
    });
    return token === "ok";
  } catch {
    return false;
  }
}
