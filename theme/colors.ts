export const nauticalDay = {
  bg: "#F3F6FA",
  surface: "#FFFFFF",
  surface2: "#EAF0F7",
  text: "#10233A",
  mutedText: "#4B6278",
  primary: "#1E5A8A",
  primaryMuted: "#D5E4F1",
  border: "#C9D7E5",
  danger: "#B84747",
  success: "#2F7A58",
  warning: "#A8742A",
  shadow: "rgba(16, 35, 58, 0.12)",
  tabBarBg: "#F7FAFD",
  tabActive: "#1E5A8A",
  tabInactive: "#5F7287",
} as const;

export const nauticalNight = {
  bg: "#0F1B2D",
  surface: "#16263D",
  surface2: "#1D314B",
  text: "#E6EEF7",
  mutedText: "#9EB1C5",
  primary: "#7DB2E0",
  primaryMuted: "#2B4260",
  border: "#2C4360",
  danger: "#E08B89",
  success: "#7FC5A1",
  warning: "#D9B06A",
  shadow: "rgba(0, 0, 0, 0.4)",
  tabBarBg: "#132238",
  tabActive: "#A9CFF0",
  tabInactive: "#8198AF",
} as const;

// Backward-compatible aliases for existing usage.
export const LightColors = {
  ...nauticalDay,
  muted: nauticalDay.mutedText,
  cardBorder: nauticalDay.border,
  cardBg: nauticalDay.surface,
} as const;

export const DarkColors = {
  ...nauticalNight,
  muted: nauticalNight.mutedText,
  cardBorder: nauticalNight.border,
  cardBg: nauticalNight.surface,
} as const;

export type AppColors = typeof LightColors;
