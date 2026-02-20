import * as DocumentPicker from "expo-document-picker";
import { File, Paths } from "expo-file-system";
import * as Sharing from "expo-sharing";

import { STORAGE_KEYS } from "@/constants/storageKeys";
import { loadJSON, saveJSON } from "@/utils/storage";

export async function exportFullBackup() {
  const inventory = await loadJSON(STORAGE_KEYS.INVENTORY, []);
  const sales = await loadJSON(STORAGE_KEYS.SALES, []);
  const expenses = await loadJSON(STORAGE_KEYS.EXPENSES, []);

  const payload = {
    version: 1,
    exportedAt: new Date().toISOString(),
    inventory,
    sales,
    expenses,
  };

  const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const filename = `catchledger_backup_${stamp}.json`;

  const file = new File(Paths.cache, filename);
  try { file.create(); } catch {}
  file.write(JSON.stringify(payload, null, 2));

  await Sharing.shareAsync(file.uri, {
    mimeType: "application/json",
    dialogTitle: "Export CatchLedger Backup",
  });
}

export async function restoreFullBackup() {
  const result = await DocumentPicker.getDocumentAsync({
    type: "application/json",
    copyToCacheDirectory: true,
  });

  if (result.canceled || !result.assets?.length) return;

  const fileUri = result.assets[0].uri;

  const content = await fetch(fileUri).then(r => r.text());
  const data = JSON.parse(content);

  if (!data.inventory || !data.sales || !data.expenses) {
    throw new Error("Invalid backup file.");
  }

  await saveJSON(STORAGE_KEYS.INVENTORY, data.inventory);
  await saveJSON(STORAGE_KEYS.SALES, data.sales);
  await saveJSON(STORAGE_KEYS.EXPENSES, data.expenses);
}
