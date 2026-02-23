import { STORAGE_KEYS } from "@/constants/storageKeys";
import type { InventoryItem } from "@/types/inventory";
import type { Sale } from "@/types/sales";
import type { AppSettings } from "@/types/settings";
import { loadAppSettings } from "@/utils/appSettings";
import { loadJSON, saveJSON } from "@/utils/storage";
import { Alert } from "react-native";

const LAST_NOTICE_KEY = "catchledger_last_notice_day";
const LOW_INVENTORY_THRESHOLD = 5;
const EXPIRING_WINDOW_MS = 1000 * 60 * 60 * 24;

function toTimestamp(iso?: string) {
  if (!iso) return Number.NaN;
  return new Date(iso).getTime();
}

export function computeLowInventoryItems(
  inventory: InventoryItem[],
  settings: Pick<AppSettings, "lowInventoryAlerts">
) {
  if (!settings.lowInventoryAlerts) return [];
  return inventory.filter((item) => {
    if (typeof item.quantity !== "number") return false;
    return item.quantity <= LOW_INVENTORY_THRESHOLD;
  });
}

export function computeExpiringLots(
  inventory: InventoryItem[],
  settings: Pick<AppSettings, "expiringProductAlerts">,
  now = Date.now()
) {
  if (!settings.expiringProductAlerts) return [];
  return inventory.filter((item) => {
    const expiresAtMs = toTimestamp(item.expiresAt);
    if (Number.isNaN(expiresAtMs)) return false;
    const msUntilExpiry = expiresAtMs - now;
    return msUntilExpiry > 0 && msUntilExpiry <= EXPIRING_WINDOW_MS;
  });
}

export async function runNotificationChecks() {
  const settings = await loadAppSettings();
  const today = new Date().toISOString().slice(0, 10);
  const last = await loadJSON<string>(LAST_NOTICE_KEY, "");
  if (last === today) return;

  const [inventory, sales] = await Promise.all([
    loadJSON<InventoryItem[]>(STORAGE_KEYS.INVENTORY, []),
    loadJSON<Sale[]>(STORAGE_KEYS.SALES, []),
  ]);

  const alerts: string[] = [];

  if (settings.deliveryReminders) {
    alerts.push("Delivery reminders are enabled.");
  }

  if (settings.paymentReminders) {
    const unpaidCount = sales.filter((s) => s.paymentMethod === "OTHER").length;
    if (unpaidCount > 0) alerts.push(`You have ${unpaidCount} sale(s) with manual payment method to review.`);
  }

  if (settings.lowInventoryAlerts) {
    const low = computeLowInventoryItems(inventory, settings).length;
    if (low > 0) alerts.push(`${low} inventory item(s) are low (≤ 5).`);
  }

  if (settings.expiringProductAlerts) {
    const soon = computeExpiringLots(inventory, settings).length;
    if (soon > 0) alerts.push(`${soon} product lot(s) expire within 24 hours.`);
  }

  if (alerts.length) {
    Alert.alert("CatchLedger notifications", alerts.join("\n"));
    await saveJSON(LAST_NOTICE_KEY, today);
  }
}

export async function initNotifications() {
  return runNotificationChecks();
}
