import * as SecureStore from "expo-secure-store";

const PASSCODE_KEY = "catchledger_passcode";
const BIOMETRIC_TOKEN_KEY = "catchledger_biometric_token";

export async function setPasscode(passcode: string) {
  await SecureStore.setItemAsync(PASSCODE_KEY, passcode);
}

export async function getPasscode() {
  return SecureStore.getItemAsync(PASSCODE_KEY);
}

export async function clearPasscode() {
  await SecureStore.deleteItemAsync(PASSCODE_KEY);
}

export async function ensureBiometricToken() {
  const existing = await SecureStore.getItemAsync(BIOMETRIC_TOKEN_KEY);
  if (!existing) {
    await SecureStore.setItemAsync(BIOMETRIC_TOKEN_KEY, "ok", {
      requireAuthentication: true,
    });
  }
}

export async function unlockWithBiometric() {
  const token = await SecureStore.getItemAsync(BIOMETRIC_TOKEN_KEY, {
    requireAuthentication: true,
  });
  return token === "ok";
}
