import { ThemeProvider as AppThemeProvider, ThemeContext } from "@/theme/ThemeProvider";
import { DarkTheme, DefaultTheme, ThemeProvider as NavThemeProvider } from "@react-navigation/native";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import React from "react";
import "react-native-reanimated";

export const unstable_settings = {
  anchor: "(tabs)",
};

function NavThemeWrapper() {
  const { mode, colors } = React.useContext(ThemeContext);

  return (
    <NavThemeProvider value={mode === "DARK" ? DarkTheme : DefaultTheme}>
      <Stack
        screenOptions={{
          // THIS fixes the “all pages black / weird borders” feeling
          contentStyle: { backgroundColor: colors.bg },

          // Header styling (and removes that thin line)
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
