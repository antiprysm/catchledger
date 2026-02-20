import { STORAGE_KEYS } from "@/constants/storageKeys";
import { loadJSON, saveJSON } from "@/utils/storage";
import React, { createContext, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Animated, Easing, Image, StyleSheet, View } from "react-native";
import ViewShot, { captureRef } from "react-native-view-shot";
import { AppColors, DarkColors, LightColors } from "./colors";

export type ThemeMode = "LIGHT" | "DARK";

type ThemeCtx = {
  mode: ThemeMode;
  colors: AppColors;
  setMode: (m: ThemeMode) => void;
  toggle: () => void;
};

export const ThemeContext = createContext<ThemeCtx>({
  mode: "LIGHT",
  colors: LightColors,
  setMode: () => {},
  toggle: () => {},
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [mode, setModeState] = useState<ThemeMode>("LIGHT");
  const colors = useMemo(() => (mode === "DARK" ? DarkColors : LightColors), [mode]);

  // IMPORTANT: captureRef wants a native view ref; simplest is View ref.
  const shotRef = useRef<View>(null);

  const [shotUri, setShotUri] = useState<string | null>(null);
  const fade = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    loadJSON<ThemeMode>(STORAGE_KEYS.THEME_MODE, "LIGHT").then(setModeState);
  }, []);

  const crossfadeOldUI = useCallback(async () => {
    try {
      if (!shotRef.current) return;

      // Snapshot what the user currently sees
      const uri = await captureRef(shotRef.current, {
        format: "png",
        quality: 0.9,
        result: "tmpfile",
      });

      if (!uri) return;

      setShotUri(uri);

      // Show snapshot on top, then fade it out (reveals new theme underneath)
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
    async (m: ThemeMode) => {
      if (m === mode) return;

      // 1) snapshot CURRENT UI
      await crossfadeOldUI();

      // 2) flip theme UNDER the snapshot
      setModeState(m);

      // 3) persist
      await saveJSON(STORAGE_KEYS.THEME_MODE, m);
    },
    [mode, crossfadeOldUI]
  );

  const toggle = useCallback(() => {
    setMode(mode === "LIGHT" ? "DARK" : "LIGHT");
  }, [mode, setMode]);

  const value = useMemo(() => ({ mode, colors, setMode, toggle }), [mode, colors, setMode, toggle]);

  return (
    <ThemeContext.Provider value={value}>
      {/* Put EVERYTHING inside the thing you capture */}
      <ViewShot ref={shotRef} style={[styles.root, { backgroundColor: colors.bg }]}>
        {children}

        {/* Overlay snapshot ABOVE the new theme */}
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
