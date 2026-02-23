import { STORAGE_KEYS } from "@/constants/storageKeys";
import type { InventoryItem } from "@/types/inventory";
import type { Sale } from "@/types/sales";
import type { AppSettings } from "@/types/settings";
import { loadAppSettings } from "@/utils/appSettings";
import { loadJSON, saveJSON } from "@/utils/storage";
import { Alert } from "react-native";
import * as Notifications from "expo-notifications";

const DELIVERY_IDENTIFIER = "delivery-daily-reminder";
const PAYMENT_IDENTIFIER_PREFIX = "payment-due-";
const LAST_ITEM_ALERT_KEY = "catchledger_last_item_alert_map";
const LAST_LOT_ALERT_KEY = "catchledger_last_lot_alert_map";

type LastAlertMap = Record<string, string>;

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

function parseHHMM(time: string) {
  const [h, m] = time.split(":").map(Number);
  const hour = Number.isFinite(h) ? Math.max(0, Math.min(23, h)) : 18;
  const minute = Number.isFinite(m) ? Math.max(0, Math.min(59, m)) : 0;
  return { hour, minute };
}

function paymentIdentifier(saleId: string) {
  return `${PAYMENT_IDENTIFIER_PREFIX}${saleId}`;
}

function isUnpaid(sale: Sale) {
  if (sale.isPaid === true) return false;
  return true;
}

function dateAtLocalHour(dateIso: string, hour: number) {
  const due = new Date(dateIso);
  if (Number.isNaN(due.getTime())) return null;
  due.setHours(hour, 0, 0, 0);
  return due;
}

export async function requestNotificationPermission() {
  const existing = await Notifications.getPermissionsAsync();
  if (existing.granted || existing.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL) {
    return true;
  }
  const asked = await Notifications.requestPermissionsAsync();
  return !!asked.granted;
}

export function computeLowInventoryItems(inventory: InventoryItem[], settings: AppSettings) {
  if (!settings.lowInventoryAlertsEnabled) return [];
  return inventory.filter(
    (i) => typeof i.quantity === "number" && Number.isFinite(i.quantity) && i.quantity <= settings.lowInventoryDefaultThreshold
  );
}

export function computeExpiringLots(inventory: InventoryItem[], settings: AppSettings) {
  if (!settings.expiringProductAlertsEnabled) return [];
  const now = Date.now();
  const maxMs = settings.expiringSoonDays * 24 * 60 * 60 * 1000;
  return inventory.filter((i) => {
    if (!i.expiresAt) return false;
    const ms = new Date(i.expiresAt).getTime() - now;
    return ms >= 0 && ms <= maxMs;
  });
}

export async function scheduleDeliveryReminderIfEnabled(settings: AppSettings, sales: Sale[]) {
  await Notifications.cancelScheduledNotificationAsync(DELIVERY_IDENTIFIER).catch(() => undefined);

  if (!settings.deliveryRemindersEnabled) return;

  const hasSaleToday = sales.some((s) => s.occurredAt.slice(0, 10) === todayKey());
  if (hasSaleToday) return;

  const { hour, minute } = parseHHMM(settings.deliveryReminderTime);
  await Notifications.scheduleNotificationAsync({
    identifier: DELIVERY_IDENTIFIER,
    content: {
      title: "Delivery reminder",
      body: "No sales logged today yet. Record your dock deliveries in CatchLedger.",
      sound: "default",
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DAILY,
      hour,
      minute,
    },
  });
}

export async function schedulePaymentDueNotifications(settings: AppSettings, sales: Sale[]) {
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  await Promise.all(
    scheduled
      .filter((n) => n.identifier.startsWith(PAYMENT_IDENTIFIER_PREFIX))
      .map((n) => Notifications.cancelScheduledNotificationAsync(n.identifier).catch(() => undefined))
  );

  if (!settings.paymentRemindersEnabled) return;

  const now = Date.now();
  const in30Days = now + 30 * 24 * 60 * 60 * 1000;

  for (const sale of sales) {
    if (!sale.dueDate || !isUnpaid(sale)) continue;
    const triggerDate = dateAtLocalHour(sale.dueDate, settings.paymentReminderHour);
    if (!triggerDate) continue;

    const t = triggerDate.getTime();
    if (t < now || t > in30Days) continue;

    await Notifications.scheduleNotificationAsync({
      identifier: paymentIdentifier(sale.id),
      content: {
        title: "Payment due reminder",
        body: `Payment due today for ${sale.buyerName || "customer"} (${Number(sale.total || 0).toFixed(2)}).`,
        sound: "default",
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: triggerDate,
      },
    });
  }
}

async function notifyNowWithDedupe(items: InventoryItem[], key: string, title: string, bodyFn: (item: InventoryItem) => string) {
  const today = todayKey();
  const seen = await loadJSON<LastAlertMap>(key, {});

  for (const item of items) {
    const id = item.batchId || item.id;
    if (seen[id] === today) continue;

    await Notifications.scheduleNotificationAsync({
      content: { title, body: bodyFn(item), sound: "default" },
      trigger: null,
    });

    seen[id] = today;
  }

  await saveJSON(key, seen);
}

export async function showInAppAlertsIfNeeded(inventory: InventoryItem[], settings: AppSettings) {
  const low = computeLowInventoryItems(inventory, settings);
  const expiring = computeExpiringLots(inventory, settings);

  const messages: string[] = [];
  if (low.length) messages.push(`${low.length} item(s) are at or below threshold (${settings.lowInventoryDefaultThreshold}).`);
  if (expiring.length) messages.push(`${expiring.length} lot(s) expire within ${settings.expiringSoonDays} day(s).`);

  if (messages.length) {
    Alert.alert("Inventory alerts", messages.join("\n"));
  }

  if (settings.lowInventoryAlertsEnabled && low.length) {
    await notifyNowWithDedupe(low, LAST_ITEM_ALERT_KEY, "Low inventory", (i) => `${i.speciesName}: ${i.quantity ?? 0} left.`);
  }

  if (settings.expiringProductAlertsEnabled && expiring.length) {
    await notifyNowWithDedupe(
      expiring,
      LAST_LOT_ALERT_KEY,
      "Expiring product",
      (i) => `${i.speciesName} batch ${i.batchId} expires soon.`
    );
  }

  return { low, expiring };
}

export async function initNotifications(opts?: { settings?: AppSettings; sales?: Sale[]; inventory?: InventoryItem[] }) {
  const settings = opts?.settings ?? (await loadAppSettings());
  const [sales, inventory] = await Promise.all([
    opts?.sales ? Promise.resolve(opts.sales) : loadJSON<Sale[]>(STORAGE_KEYS.SALES, []),
    opts?.inventory ? Promise.resolve(opts.inventory) : loadJSON<InventoryItem[]>(STORAGE_KEYS.INVENTORY, []),
  ]);

  const hasPermission = await requestNotificationPermission();
  if (!hasPermission) return { low: [], expiring: [] as InventoryItem[] };

  await scheduleDeliveryReminderIfEnabled(settings, sales);
  await schedulePaymentDueNotifications(settings, sales);
  const summary = await showInAppAlertsIfNeeded(inventory, settings);
  return summary;
}
