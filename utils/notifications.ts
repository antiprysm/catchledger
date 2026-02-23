import { STORAGE_KEYS } from "@/constants/storageKeys";
import type { InventoryItem } from "@/types/inventory";
import type { Sale } from "@/types/sales";
import { loadAppSettings } from "@/utils/appSettings";
import { loadJSON, saveJSON } from "@/utils/storage";
import { Alert } from "react-native";

const LAST_NOTICE_KEY = "catchledger_last_notice_day";

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
    const low = inventory.filter((i) => typeof i.quantity === "number" && i.quantity <= 5).length;
    if (low > 0) alerts.push(`${low} inventory item(s) are low (≤ 5).`);
  }

  if (settings.expiringProductAlerts) {
    const soon = inventory.filter((i: any) => {
      if (!i.expiresAt) return false;
      const ms = new Date(i.expiresAt).getTime() - Date.now();
      return ms > 0 && ms <= 1000 * 60 * 60 * 24;
    }).length;
    if (soon > 0) alerts.push(`${soon} product lot(s) expire within 24 hours.`);
  }

  if (alerts.length) {
    Alert.alert("CatchLedger notifications", alerts.join("\n"));
    await saveJSON(LAST_NOTICE_KEY, today);
  }
}
