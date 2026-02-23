import { STORAGE_KEYS } from "@/constants/storageKeys";
import type { LicenseProfile } from "@/types/license";
import { DEFAULT_APP_SETTINGS, type AppSettings } from "@/types/settings";
import { loadJSON, saveJSON } from "@/utils/storage";

export const APP_SETTINGS_STORAGE_KEY =
  (STORAGE_KEYS as Record<string, string>).APP_SETTINGS ?? "catchledger_app_settings_v1";

export async function loadAppSettings(): Promise<AppSettings> {
  const stored = await loadJSON<AppSettings>(APP_SETTINGS_STORAGE_KEY, DEFAULT_APP_SETTINGS);
  return {
    ...DEFAULT_APP_SETTINGS,
    ...stored,
    companyProfile: { ...DEFAULT_APP_SETTINGS.companyProfile, ...stored.companyProfile },
  };
}

export async function saveAppSettings(settings: AppSettings) {
  await saveJSON(APP_SETTINGS_STORAGE_KEY, settings);
}

export function applyDateFormat(date: Date, format: AppSettings["dateFormat"]) {
  const dd = String(date.getDate()).padStart(2, "0");
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const yyyy = String(date.getFullYear());
  return format === "DD/MM/YYYY" ? `${dd}/${mm}/${yyyy}` : `${mm}/${dd}/${yyyy}`;
}

export function formatDateTime(iso: string, format: AppSettings["dateFormat"]) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const hh = d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  return `${applyDateFormat(d, format)} ${hh}`;
}

export function weightUnitLabel(baseUnit: string, pref: AppSettings["weightUnit"]) {
  if (baseUnit === "lb" || baseUnit === "kg") return pref;
  return baseUnit;
}

export function toLicenseProfileFallback(profile: AppSettings["companyProfile"]): LicenseProfile {
  return {
    legalName: profile.businessName || "",
    dbaName: profile.businessName || undefined,
    licenseNumber: profile.licenseNumber || "",
    state: "IL",
    phone: profile.phone || undefined,
    email: profile.email || undefined,
    homeBaseCity: profile.businessAddress || undefined,
    updatedAt: new Date().toISOString(),
  };
}
