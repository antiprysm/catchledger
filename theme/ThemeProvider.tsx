import { STORAGE_KEYS } from "@/constants/storageKeys";
import { loadJSON, saveJSON } from "@/utils/storage";
import React, { createContext, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Animated, AppState, Appearance, Easing, Image, StyleSheet, View } from "react-native";
import ViewShot, { captureRef } from "react-native-view-shot";
import { AppColors, DarkColors, LightColors } from "./colors";

export type ThemeMode = "LIGHT" | "DARK";

type ThemeCtx = {
  mode: ThemeMode;
  colors: AppColors;
  setMode: (m: ThemeMode) => void;
  toggle: () => void;
};

function resolveSystemTheme(): ThemeMode {
  return Appearance.getColorScheme() === "dark" ? "DARK" : "LIGHT";
}

export const ThemeContext = createContext<ThemeCtx>({
  mode: "LIGHT",
  colors: LightColors,
  setMode: () => {},
  toggle: () => {},
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [mode, setModeState] = useState<ThemeMode>(resolveSystemTheme());
  const colors = useMemo<AppColors>(() => (mode === "DARK" ? DarkColors : LightColors), [mode]);
  const isThemeTransitioningRef = useRef(false);
  const shotRef = useRef<View>(null);
  const [shotUri, setShotUri] = useState<string | null>(null);
  const fade = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    loadJSON<ThemeMode>(STORAGE_KEYS.THEME_MODE, resolveSystemTheme()).then((saved) => {
      setModeState(saved ?? resolveSystemTheme());
    });
  }, []);

  const animateThemeChange = useCallback(async (nextMode: ThemeMode) => {
    if (nextMode === mode || isThemeTransitioningRef.current) return;
  
    isThemeTransitioningRef.current = true;
  
    try {
      const uri =
        shotRef.current
          ? await captureRef(shotRef.current, {
              format: "png",
              quality: 0.9,
              result: "tmpfile",
            })
          : null;
  
      if (uri) {
        setShotUri(uri);
        fade.stopAnimation();
        fade.setValue(1);
      }
  
      setModeState(nextMode);
  
      if (uri) {
        Animated.timing(fade, {
          toValue: 0,
          duration: 1260,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }).start(() => {
          setShotUri(null);
          isThemeTransitioningRef.current = false;
        });
      } else {
        setShotUri(null);
        isThemeTransitioningRef.current = false;
      }
  
      await saveJSON(STORAGE_KEYS.THEME_MODE, nextMode);
    } catch {
      setShotUri(null);
      setModeState(nextMode);
      await saveJSON(STORAGE_KEYS.THEME_MODE, nextMode);
      isThemeTransitioningRef.current = false;
    }
  }, [fade, mode]);

  const syncWithSystemTheme = useCallback(() => {
    if (isThemeTransitioningRef.current) return;
  
    const systemMode = resolveSystemTheme();
    if (systemMode !== mode) {
      void animateThemeChange(systemMode);
    }
  }, [mode, animateThemeChange]);

  useEffect(() => {
    const appearanceSub = Appearance.addChangeListener(() => {
      syncWithSystemTheme();
    });
  
    const appStateSub = AppState.addEventListener("change", (state) => {
      if (state === "active") {
        syncWithSystemTheme();
      }
    });
  
    return () => {
      appearanceSub.remove();
      appStateSub.remove();
    };
  }, [syncWithSystemTheme]);

  const setMode = useCallback((nextMode: ThemeMode) => {
    void animateThemeChange(nextMode);
  }, [animateThemeChange]);

  const toggle = useCallback(() => {
    setMode(mode === "LIGHT" ? "DARK" : "LIGHT");
  }, [mode, setMode]);

  const value = useMemo(
    () => ({ mode, colors, setMode, toggle }),
    [mode, colors, setMode, toggle]
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