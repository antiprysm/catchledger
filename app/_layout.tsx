import i18n from "@/i18n";
import { applyLanguage, ensureI18nInitialized } from "@/i18n";
import { ThemeProvider as AppThemeProvider, ThemeContext } from "@/theme/ThemeProvider";
import { loadAppSettings } from "@/utils/appSettings";
import { runNotificationChecks } from "@/utils/notifications";
import { getPasscode, unlockWithBiometric } from "@/utils/security";
import { ThemeProvider as NavThemeProvider } from "@react-navigation/native";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import React from "react";
import { I18nextProvider, useTranslation } from "react-i18next";
import { AppState, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import "react-native-reanimated";

export const unstable_settings = {
  anchor: "(tabs)",
};

function NavThemeWrapper() {
  const { t } = useTranslation();
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
    runNotificationChecks();

    const sub = AppState.addEventListener("change", async (state) => {
      const settings = settingsRef.current ?? (await loadAppSettings());
      settingsRef.current = settings;
      if (!settings.passcodeLockEnabled) return;

      if (state === "background" || state === "inactive") {
        backgroundAt.current = Date.now();
        return;
      }

      if (state === "active") {
        runNotificationChecks();
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
      setLockError(t("lock.errors.setPasscode"));
      return;
    }
    if (saved !== passcodeInput.trim()) {
      setLockError(t("lock.errors.incorrectPasscode"));
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
      setLockError(t("lock.errors.biometricFailed"));
    }
  }

  const navTheme = React.useMemo(() => {
    const baseTheme = mode === "DARK" ? DarkTheme : DefaultTheme;

    return {
      ...baseTheme,
      colors: {
        ...baseTheme.colors,
        primary: colors.primary,
        background: colors.bg,
        card: colors.surface,
        text: colors.text,
        border: colors.border,
        notification: colors.danger,
      },
    };
  }, [mode, colors]);

  if (locked) {
    return (
      <View style={[styles.lockWrap, { backgroundColor: colors.bg }]}> 
        <Text style={[styles.lockTitle, { color: colors.text }]}>{t("lock.title")}</Text>
        <TextInput
          value={passcodeInput}
          onChangeText={setPasscodeInput}
          placeholder={t("lock.enterPasscode")}
          placeholderTextColor={colors.muted}
          secureTextEntry
          keyboardType="number-pad"
          style={[
            styles.lockInput,
            { color: colors.text, borderColor: colors.cardBorder, backgroundColor: colors.surface },
          ]}
        />
        <Pressable style={[styles.lockBtn, { backgroundColor: colors.primary }]} onPress={unlockByPasscode}>
          <Text style={styles.lockBtnText}>{t("lock.unlock")}</Text>
        </Pressable>
        {settingsRef.current?.biometricsEnabled ? (
          <Pressable
            style={[styles.lockBtn, { backgroundColor: colors.surface2, borderColor: colors.border }]}
            onPress={unlockByBiometric}
          >
            <Text style={[styles.lockBtnText, { color: colors.text }]}>{t("lock.unlockBiometric")}</Text>
          </Pressable>
        ) : null}
        {!!lockError && <Text style={[styles.lockErr, { color: colors.danger }]}>{lockError}</Text>}
      </View>
    );
  }

  return (
    <NavThemeProvider value={navTheme}>
      <Stack
        screenOptions={{
          contentStyle: { backgroundColor: colors.bg },
          headerStyle: { backgroundColor: colors.surface },
          headerTintColor: colors.text,
          headerShadowVisible: false,
        }}
      >
        <Stack.Screen name="(auth)" options={{ headerShown: false }} />
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="modal" options={{ presentation: "modal", title: t("modal.title") }} />
      </Stack>

      <StatusBar style={mode === "DARK" ? "light" : "dark"} />
    </NavThemeProvider>
  );
}

export default function RootLayout() {
  const [ready, setReady] = React.useState(false);

  React.useEffect(() => {
    let mounted = true;
    (async () => {
      const settings = await loadAppSettings();
      await ensureI18nInitialized();
      await applyLanguage(settings.language ?? "en");
      if (mounted) setReady(true);
    })();
    return () => {
      mounted = false;
    };
  }, []);

  if (!ready) return null;

  return (
    <I18nextProvider i18n={i18n}>
      <AppThemeProvider>
        <NavThemeWrapper />
      </AppThemeProvider>
    </I18nextProvider>
  );
}

const styles = StyleSheet.create({
  lockWrap: { flex: 1, justifyContent: "center", padding: 20, gap: 10 },
  lockTitle: { fontSize: 24, fontWeight: "900", marginBottom: 6, textAlign: "center" },
  lockInput: { borderWidth: 1, borderRadius: 12, padding: 12 },
  lockBtn: { padding: 12, borderRadius: 10, alignItems: "center", borderWidth: 1, borderColor: "transparent" },
  lockBtnText: { color: "#F4F7FB", fontWeight: "900" },
  lockErr: { textAlign: "center", fontWeight: "700", marginTop: 4 },
});
