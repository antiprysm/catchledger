import { ThemeProvider as AppThemeProvider, ThemeContext } from "@/theme/ThemeProvider";
import { loadAppSettings } from "@/utils/appSettings";
import { initNotifications } from "@/utils/notifications";
import { getPasscode, unlockWithBiometric } from "@/utils/security";
import { DarkTheme, DefaultTheme, ThemeProvider as NavThemeProvider } from "@react-navigation/native";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import React from "react";
import { AppState, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import "react-native-reanimated";

export const unstable_settings = {
  anchor: "(tabs)",
};

function NavThemeWrapper() {
  const { mode, colors } = React.useContext(ThemeContext);
  const [locked, setLocked] = React.useState(false);
  const [passcodeInput, setPasscodeInput] = React.useState("");
  const [lockError, setLockError] = React.useState("");
  const settingsRef = React.useRef<any>(null);
  const backgroundAt = React.useRef<number | null>(null);

  React.useEffect(() => {
    loadAppSettings().then((settings) => {
      settingsRef.current = settings;
      if (settings.passcodeLockEnabled) setLocked(true);
    });
    initNotifications().catch(() => undefined);

    const sub = AppState.addEventListener("change", async (state) => {
      const settings = settingsRef.current ?? (await loadAppSettings());
      settingsRef.current = settings;
      if (!settings.passcodeLockEnabled) return;

      if (state === "background" || state === "inactive") {
        backgroundAt.current = Date.now();
        return;
      }

      if (state === "active") {
        initNotifications().catch(() => undefined);
        const bg = backgroundAt.current;
        if (!bg) {
          setLocked(true);
          return;
        }
        const mins = (Date.now() - bg) / 60000;
        if (mins >= settings.autoLockTimerMinutes || mins >= settings.sessionTimeoutMinutes) {
          setLocked(true);
        }
      }
    });

    return () => sub.remove();
  }, []);

  async function unlockByPasscode() {
    const saved = await getPasscode();
    if (!saved) {
      setLockError("Set a passcode in Settings > Security first.");
      return;
    }
    if (saved !== passcodeInput.trim()) {
      setLockError("Incorrect passcode.");
      return;
    }
    setPasscodeInput("");
    setLockError("");
    setLocked(false);
  }

  async function unlockByBiometric() {
    const ok = await unlockWithBiometric();
    if (ok) {
      setPasscodeInput("");
      setLockError("");
      setLocked(false);
    } else {
      setLockError("Biometric unlock failed.");
    }
  }

  if (locked) {
    return (
      <View style={[styles.lockWrap, { backgroundColor: colors.bg }]}>
        <Text style={[styles.lockTitle, { color: colors.text }]}>CatchLedger Locked</Text>
        <TextInput
          value={passcodeInput}
          onChangeText={setPasscodeInput}
          placeholder="Enter passcode"
          placeholderTextColor={colors.muted}
          secureTextEntry
          keyboardType="number-pad"
          style={[styles.lockInput, { color: colors.text, borderColor: colors.cardBorder }]}
        />
        <Pressable style={styles.lockBtn} onPress={unlockByPasscode}>
          <Text style={styles.lockBtnText}>Unlock</Text>
        </Pressable>
        {(settingsRef.current?.biometricsEnabled ?? false) ? (
          <Pressable style={[styles.lockBtn, { backgroundColor: "#3b3b3b" }]} onPress={unlockByBiometric}>
            <Text style={styles.lockBtnText}>Unlock with FaceID / TouchID</Text>
          </Pressable>
        ) : null}
        {!!lockError && <Text style={[styles.lockErr, { color: "#d32f2f" }]}>{lockError}</Text>}
      </View>
    );
  }

  return (
    <NavThemeProvider value={mode === "DARK" ? DarkTheme : DefaultTheme}>
      <Stack
        screenOptions={{
          contentStyle: { backgroundColor: colors.bg },
          headerStyle: { backgroundColor: colors.bg },
          headerTintColor: colors.text,
          headerShadowVisible: false,
        }}
      >
        <Stack.Screen name="(auth)" options={{ headerShown: false }} />
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="modal" options={{ presentation: "modal", title: "Modal" }} />
      </Stack>

      <StatusBar style={mode === "DARK" ? "light" : "dark"} />
    </NavThemeProvider>
  );
}

export default function RootLayout() {
  return (
    <AppThemeProvider>
      <NavThemeWrapper />
    </AppThemeProvider>
  );
}

const styles = StyleSheet.create({
  lockWrap: { flex: 1, justifyContent: "center", padding: 20, gap: 10 },
  lockTitle: { fontSize: 24, fontWeight: "900", marginBottom: 6, textAlign: "center" },
  lockInput: { borderWidth: 1, borderRadius: 12, padding: 12 },
  lockBtn: { backgroundColor: "#111", padding: 12, borderRadius: 10, alignItems: "center" },
  lockBtnText: { color: "white", fontWeight: "900" },
  lockErr: { textAlign: "center", fontWeight: "700", marginTop: 4 },
});
