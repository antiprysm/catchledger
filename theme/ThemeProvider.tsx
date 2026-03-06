import { STORAGE_KEYS } from "@/constants/storageKeys";
import { loadJSON, saveJSON } from "@/utils/storage";
import React, { createContext, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Animated, Appearance, Easing, Image, StyleSheet, View } from "react-native";
import ViewShot, { captureRef } from "react-native-view-shot";
import { AppColors, DarkColors, LightColors } from "./colors";

export type ThemeMode = "LIGHT" | "DARK";
export type ThemePreference = "SYSTEM" | "LIGHT" | "DARK";

type ThemeCtx = {
  mode: ThemeMode;
  preference: ThemePreference;
  colors: AppColors;
  setMode: (m: ThemePreference) => void;
  toggle: () => void;
};

function resolveThemeMode(preference: ThemePreference, systemScheme: "light" | "dark" | null): ThemeMode {
  if (preference === "LIGHT") return "LIGHT";
  if (preference === "DARK") return "DARK";
  return systemScheme === "dark" ? "DARK" : "LIGHT";
}

export const ThemeContext = createContext<ThemeCtx>({
  mode: "LIGHT",
  preference: "SYSTEM",
  colors: LightColors,
  setMode: () => {},
  toggle: () => {},
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [preference, setPreference] = useState<ThemePreference>("SYSTEM");
  const [systemScheme, setSystemScheme] = useState<"light" | "dark" | null>(
    Appearance.getColorScheme() ?? null
  );

  const mode = useMemo(
    () => resolveThemeMode(preference, systemScheme),
    [preference, systemScheme]
  );

  const colors = useMemo(() => (mode === "DARK" ? DarkColors : LightColors), [mode]);

  const shotRef = useRef<View>(null);
  const [shotUri, setShotUri] = useState<string | null>(null);
  const fade = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    loadJSON<ThemePreference>(STORAGE_KEYS.THEME_MODE, "SYSTEM").then((saved) => {
      setPreference(saved ?? "SYSTEM");
    });
  }, []);

  useEffect(() => {
    const subscription = Appearance.addChangeListener(({ colorScheme }) => {
      setSystemScheme(colorScheme ?? null);
    });
  
    return () => subscription.remove();
  }, []);

  const crossfadeOldUI = useCallback(async () => {
    try {
      if (!shotRef.current) return;

      const uri = await captureRef(shotRef.current, {
        format: "png",
        quality: 0.9,
        result: "tmpfile",
      });

      if (!uri) return;

      setShotUri(uri);

      fade.stopAnimation();
      fade.setValue(1);

      Animated.timing(fade, {
        toValue: 0,
        duration: 1260,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start(() => setShotUri(null));
    } catch {
      setShotUri(null);
    }
  }, [fade]);

  const setMode = useCallback(
    async (nextPreference: ThemePreference) => {
      if (nextPreference === preference) return;
  
      // capture current UI BEFORE theme change
      const uri = await captureRef(shotRef.current!, {
        format: "png",
        quality: 0.9,
        result: "tmpfile",
      });
  
      if (uri) {
        setShotUri(uri);
        fade.setValue(1);
      }
  
      // change theme immediately
      setPreference(nextPreference);
  
      // start fade animation
      if (uri) {
        Animated.timing(fade, {
          toValue: 0,
          duration: 1260,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }).start(() => setShotUri(null));
      }
  
      await saveJSON(STORAGE_KEYS.THEME_MODE, nextPreference);
    },
    [preference]
  );

  const toggle = useCallback(() => {
    const nextMode = mode === "LIGHT" ? "DARK" : "LIGHT";
    setMode(nextMode);
  }, [mode, setMode]);

  const value = useMemo(
    () => ({ mode, preference, colors, setMode, toggle }),
    [mode, preference, colors, setMode, toggle]
  );

  return (
    <ThemeContext.Provider value={value}>
      <ViewShot ref={shotRef} style={[styles.root, { backgroundColor: colors.bg }]}>
        {children}

        {shotUri ? (
          <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFillObject, { opacity: fade }]}>
            <Image source={{ uri: shotUri }} style={StyleSheet.absoluteFillObject} />
          </Animated.View>
        ) : null}
      </ViewShot>
    </ThemeContext.Provider>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
});