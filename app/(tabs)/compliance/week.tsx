import { ThemeContext } from "@/theme/ThemeProvider";
import { useFocusEffect } from "expo-router";
import { useCallback, useContext, useMemo, useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { STORAGE_KEYS } from "@/constants/storageKeys";
import { InventoryItem } from "@/types/inventory";
import { LicenseProfile } from "@/types/license";
import { Sale } from "@/types/sales";
import { loadJSON, saveJSON } from "@/utils/storage";

import { File, Paths } from "expo-file-system";
import * as Sharing from "expo-sharing";

function fmtWhen(iso: string) {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleString();
}

function daysAgoStart(n: number) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0).getTime();
}

function csvEscape(value: unknown) {
  const s = value == null ? "" : String(value);
  const needsQuotes = /[",\n\r]/.test(s);
  const escaped = s.replace(/"/g, '""');
  return needsQuotes ? `"${escaped}"` : escaped;
}

function stampForName() {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    d.getFullYear() +
    "-" +
    pad(d.getMonth() + 1) +
    "-" +
    pad(d.getDate()) +
    "_" +
    pad(d.getHours()) +
    pad(d.getMinutes())
  );
}

function buildInspectionCSV(profile: LicenseProfile | null, harvest: InventoryItem[], sales: Sale[]) {
  const lines: string[] = [];

  lines.push("SECTION,FIELD,VALUE");
  lines.push(["PROFILE", "state", profile?.state ?? ""].map(csvEscape).join(","));
  lines.push(["PROFILE", "license_number", profile?.licenseNumber ?? ""].map(csvEscape).join(","));
  lines.push(["PROFILE", "legal_name", profile?.legalName ?? ""].map(csvEscape).join(","));
  lines.push(["PROFILE", "dba_name", profile?.dbaName ?? ""].map(csvEscape).join(","));
  lines.push(["PROFILE", "phone", profile?.phone ?? ""].map(csvEscape).join(","));
  lines.push(["PROFILE", "email", profile?.email ?? ""].map(csvEscape).join(","));
  lines.push(["PROFILE", "vehicle_plate", profile?.vehiclePlate ?? ""].map(csvEscape).join(","));
  lines.push(["PROFILE", "home_base_city", profile?.homeBaseCity ?? ""].map(csvEscape).join(","));
  lines.push(["PROFILE", "updated_at", profile?.updatedAt ?? ""].map(csvEscape).join(","));

  lines.push("");

  lines.push("SECTION,inventory_id,batch_id,species,quantity,unit,catch_location,caught_at_iso,catch_method");
  for (const i of harvest) {
    lines.push(
      [
        "HARVEST",
        i.id,
        i.batchId ?? "",
        i.speciesName,
        typeof i.quantity === "number" ? String(i.quantity) : "",
        i.unit,
        i.catchLocation ?? "",
        i.caughtAt ?? "",
        i.catchMethod ?? "",
      ]
        .map(csvEscape)
        .join(",")
    );
  }

  lines.push("");

  lines.push(
    "SECTION,sale_id,occurred_at_iso,buyer_name,buyer_type,buyer_contact,payment_method,payment_note,sale_total,line_item_id,species,quantity,unit,unit_price,line_subtotal,origin_batch_id,origin_location,origin_caught_at_iso,origin_method"
  );

  for (const s of sales) {
    for (const ln of s.lines) {
      lines.push(
        [
          "SALE",
          s.id,
          s.occurredAt,
          s.buyerName ?? "",
          s.buyerType ?? "",
          s.buyerContact ?? "",
          s.paymentMethod,
          s.paymentNote ?? "",
          Number(s.total || 0).toFixed(2),

          ln.itemId,
          ln.speciesName,
          String(ln.quantity),
          ln.unit,
          Number(ln.unitPrice).toFixed(2),
          Number(ln.subtotal).toFixed(2),

          ln.originBatchId ?? "",
          ln.originCatchLocation ?? "",
          ln.originCaughtAt ?? "",
          ln.originCatchMethod ?? "",
        ]
          .map(csvEscape)
          .join(",")
      );
    }
  }

  return lines.join("\n");
}

async function shareTextFile(filename: string, mimeType: string, contents: string, dialogTitle: string) {
  const file = new File(Paths.cache, filename);
  try {
    file.create();
  } catch {}
  file.write(contents);

  const canShare = await Sharing.isAvailableAsync();
  if (!canShare) throw new Error("Sharing not available on this device.");
  await Sharing.shareAsync(file.uri, {
    mimeType,
    dialogTitle,
    UTI: "public.comma-separated-values-text",
  });
}

export default function ComplianceWeek() {
  const { colors } = useContext(ThemeContext);

  const [sales, setSales] = useState<Sale[]>([]);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [profile, setProfile] = useState<LicenseProfile | null>(null);
  const [busy, setBusy] = useState(false);
  const [inspectionMode, setInspectionMode] = useState(false);

  useFocusEffect(
    useCallback(() => {
      loadJSON<boolean>(STORAGE_KEYS.INSPECTION_MODE, false).then(setInspectionMode);
    }, [])
  );

  const load = useCallback(async () => {
    const [s, inv, p] = await Promise.all([
      loadJSON<Sale[]>(STORAGE_KEYS.SALES, []),
      loadJSON<InventoryItem[]>(STORAGE_KEYS.INVENTORY, []),
      loadJSON<LicenseProfile | null>(STORAGE_KEYS.LICENSE_PROFILE, null),
    ]);
    setSales(s);
    setInventory(inv);
    setProfile(p);
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const cutoff = useMemo(() => daysAgoStart(6), []); // today + 6 previous = 7 days

  const weekSales = useMemo(() => {
    return sales
      .filter((s) => new Date(s.occurredAt).getTime() >= cutoff)
      .sort((a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime());
  }, [sales, cutoff]);

  const weekHarvest = useMemo(() => {
    return inventory
      .filter((i) => {
        if (i.caughtAt) return new Date(i.caughtAt).getTime() >= cutoff;
        // @ts-ignore
        if ((i as any).createdAt) return new Date((i as any).createdAt).getTime() >= cutoff;
        return false;
      })
      .sort((a, b) => {
        const ta = a.caughtAt ? new Date(a.caughtAt).getTime() : 0;
        const tb = b.caughtAt ? new Date(b.caughtAt).getTime() : 0;
        return tb - ta;
      });
  }, [inventory, cutoff]);

  const revenue = useMemo(
    () => weekSales.reduce((sum, s) => sum + (Number(s.total) || 0), 0),
    [weekSales]
  );

  const exportInspectionCSV = useCallback(async () => {
    if (busy) return;
    setBusy(true);
    try {
      const filename = `catchledger_inspection_7days_${stampForName()}.csv`;
      const csv = buildInspectionCSV(profile, weekHarvest, weekSales);
      await shareTextFile(filename, "text/csv", csv, "Export Inspection CSV (7 Days)");
    } catch (e: any) {
      Alert.alert("Export failed", e?.message ?? "Unknown error");
    } finally {
      setBusy(false);
    }
  }, [busy, profile, weekHarvest, weekSales]);

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.bg }}
      contentContainerStyle={styles.container}
    >
      {inspectionMode ? (
        <View style={styles.bannerWrap}>
          <View style={styles.banner}>
            <Text style={styles.bannerText}>INSPECTION MODE — READ ONLY</Text>
          </View>

          <Pressable
            style={styles.exitBtn}
            onPress={async () => {
              await saveJSON(STORAGE_KEYS.INSPECTION_MODE, false);
              setInspectionMode(false);
              Alert.alert("Inspection mode off");
            }}
          >
            <Text style={styles.exitText}>Exit Inspection Mode</Text>
          </Pressable>
        </View>
      ) : null}

      <View style={styles.headerRow}>
        <View>
          <Text style={[styles.h1, { color: colors.text }]}>Inspection — Last 7 Days</Text>
          <Text style={[styles.sub, { color: colors.muted }]}>License + harvest log + sales log.</Text>
        </View>

        <Pressable
          style={[styles.refreshBtn, { borderColor: colors.cardBorder, backgroundColor: colors.cardBg }]}
          onPress={load}
        >
          <Text style={[styles.refreshText, { color: colors.text }]}>Refresh</Text>
        </Pressable>
      </View>

      <View style={[styles.profileCard, { borderColor: colors.cardBorder, backgroundColor: colors.cardBg }]}>
        {profile ? (
          <>
            <Text style={[styles.profileTitle, { color: colors.text }]}>
              {profile.dbaName ? profile.dbaName : profile.legalName}
            </Text>

            <Text style={[styles.profileLine, { color: colors.muted }]}>
              {profile.state} Aquatic Life Distributor License:{" "}
              <Text style={[styles.bold, { color: colors.text }]}>{profile.licenseNumber}</Text>
            </Text>

            <Text style={[styles.profileLine, { color: colors.muted }]}>
              Legal: {profile.legalName}
              {profile.vehiclePlate ? ` • Plate: ${profile.vehiclePlate}` : ""}
            </Text>

            <Text style={[styles.profileLine, { color: colors.muted }]}>
              {profile.phone ? profile.phone : ""}
              {profile.phone && profile.email ? " • " : ""}
              {profile.email ? profile.email : ""}
            </Text>

            {profile.homeBaseCity ? (
              <Text style={[styles.profileLine, { color: colors.muted }]}>Home base: {profile.homeBaseCity}</Text>
            ) : null}

            <Text style={[styles.profileUpdated, { color: colors.muted }]}>
              Updated: {new Date(profile.updatedAt).toLocaleString()}
            </Text>
          </>
        ) : (
          <>
            <Text style={[styles.profileTitle, { color: colors.text }]}>License profile not set</Text>
            <Text style={[styles.profileLine, { color: colors.muted }]}>
              Go to Compliance → License Profile to configure.
            </Text>
          </>
        )}
      </View>

      <View style={[styles.summaryCard, { borderColor: colors.cardBorder, backgroundColor: colors.cardBg }]}>
        <Text style={[styles.summaryLine, { color: colors.text }]}>
          Sales: <Text style={styles.bold}>{weekSales.length}</Text>
        </Text>
        <Text style={[styles.summaryLine, { color: colors.text }]}>
          Revenue: <Text style={styles.bold}>${revenue.toFixed(2)}</Text>
        </Text>
        <Text style={[styles.summaryLine, { color: colors.text }]}>
          Harvest entries: <Text style={styles.bold}>{weekHarvest.length}</Text>
        </Text>
      </View>

      <Pressable
        style={[styles.exportBtn, busy && { opacity: 0.6 }]}
        onPress={exportInspectionCSV}
        disabled={busy}
      >
        <Text style={styles.exportBtnText}>
          {busy ? "Exporting..." : "Export Inspection CSV (7 days)"}
        </Text>
      </Pressable>

      <Text style={[styles.sectionTitle, { color: colors.text }]}>Harvest log (last 7 days)</Text>
      {weekHarvest.length === 0 ? (
        <Text style={[styles.muted, { color: colors.muted }]}>No harvest logged in the last 7 days.</Text>
      ) : (
        weekHarvest.map((i) => (
          <View
            key={i.id}
            style={[styles.harvestCard, { borderColor: colors.cardBorder, backgroundColor: colors.cardBg }]}
          >
            <View style={styles.rowBetween}>
              <Text style={[styles.harvestTitle, { color: colors.text }]}>{i.speciesName}</Text>
              <Text style={[styles.harvestQty, { color: colors.text }]}>
                {typeof i.quantity === "number" ? `${i.quantity} ${i.unit}` : `— ${i.unit}`}
              </Text>
            </View>

            <Text style={[styles.muted, { color: colors.muted }]}>
              {i.catchLocation ? `Location: ${i.catchLocation}` : "Location: —"}
            </Text>
            <Text style={[styles.muted, { color: colors.muted }]}>
              {i.caughtAt ? `Caught: ${fmtWhen(i.caughtAt)}` : "Caught: —"}
            </Text>
            {i.catchMethod ? (
              <Text style={[styles.muted, { color: colors.muted }]}>Method: {i.catchMethod}</Text>
            ) : null}
          </View>
        ))
      )}

      <Text style={[styles.sectionTitle, { marginTop: 10, color: colors.text }]}>
        Sales log (last 7 days)
      </Text>
      {weekSales.length === 0 ? (
        <Text style={[styles.muted, { color: colors.muted }]}>No sales logged in the last 7 days.</Text>
      ) : (
        weekSales.map((s) => (
          <View
            key={s.id}
            style={[styles.saleCard, { borderColor: colors.cardBorder, backgroundColor: colors.cardBg }]}
          >
            <View style={styles.rowBetween}>
              <Text style={[styles.saleTitle, { color: colors.text }]}>
                {(s.buyerName || "Unknown buyer") + " "}
                <Text style={[styles.mutedInline, { color: colors.muted }]}>({s.buyerType || "OTHER"})</Text>
              </Text>
              <Text style={[styles.money, { color: colors.text }]}>${Number(s.total || 0).toFixed(2)}</Text>
            </View>

            <Text style={[styles.muted, { color: colors.muted }]}>{fmtWhen(s.occurredAt)}</Text>

            {s.buyerContact ? (
              <Text style={[styles.muted, { color: colors.muted }]}>Contact: {s.buyerContact}</Text>
            ) : null}

            <Text style={[styles.muted, { color: colors.muted }]}>
              Payment: {s.paymentMethod}
              {s.paymentNote ? ` • ${s.paymentNote}` : ""}
            </Text>

            <View style={{ marginTop: 8, gap: 6 }}>
              {s.lines.map((ln) => {
                const origin = ln.originCatchLocation ? `Origin: ${ln.originCatchLocation}` : "Origin: —";
                const caught = ln.originCaughtAt ? `Caught: ${fmtWhen(ln.originCaughtAt)}` : "Caught: —";
                const method = ln.originCatchMethod ? `Method: ${ln.originCatchMethod}` : null;
                const batch = (ln as any).originBatchId ? `Batch: ${(ln as any).originBatchId}` : null;

                return (
                  <View
                    key={`${s.id}-${ln.itemId}`}
                    style={[styles.lineBox, { borderColor: colors.cardBorder, backgroundColor: colors.bg }]}
                  >
                    <Text style={[styles.lineItem, { color: colors.text }]}>
                      • {ln.speciesName}: {ln.quantity} {ln.unit} @ ${Number(ln.unitPrice).toFixed(2)}
                    </Text>

                    {batch ? <Text style={[styles.lineMeta, { color: colors.muted }]}>{batch}</Text> : null}
                    <Text style={[styles.lineMeta, { color: colors.muted }]}>{origin}</Text>
                    <Text style={[styles.lineMeta, { color: colors.muted }]}>{caught}</Text>
                    {method ? <Text style={[styles.lineMeta, { color: colors.muted }]}>{method}</Text> : null}
                  </View>
                );
              })}
            </View>
          </View>
        ))
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, gap: 12, paddingBottom: 40 },

  headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  h1: { fontSize: 20, fontWeight: "900" },
  sub: { marginTop: 2 },

  refreshBtn: { borderWidth: 1, borderRadius: 12, paddingVertical: 8, paddingHorizontal: 12 },
  refreshText: { fontWeight: "900" },

  profileCard: { borderWidth: 1, borderRadius: 14, padding: 12, gap: 4 },
  profileTitle: { fontWeight: "900", fontSize: 16 },
  profileLine: {},
  profileUpdated: { marginTop: 4, fontSize: 12 },
  bold: { fontWeight: "900" },

  summaryCard: { borderWidth: 1, borderRadius: 14, padding: 12, gap: 6 },
  summaryLine: { fontSize: 14 },

  sectionTitle: { fontWeight: "900", marginTop: 6 },
  muted: {},
  mutedInline: { fontWeight: "700" },

  harvestCard: { borderWidth: 1, borderRadius: 14, padding: 12, gap: 4 },
  harvestTitle: { fontWeight: "900", flex: 1 },
  harvestQty: { fontWeight: "900" },
  rowBetween: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 10 },

  saleCard: { borderWidth: 1, borderRadius: 14, padding: 12, gap: 4 },
  saleTitle: { fontWeight: "900", flex: 1 },
  money: { fontWeight: "900" },

  lineBox: { borderWidth: 1, borderRadius: 12, padding: 10 },
  lineItem: { fontWeight: "800" },
  lineMeta: { marginTop: 2 },

  // keep black button
  exportBtn: { backgroundColor: "#111", padding: 14, borderRadius: 12, alignItems: "center" },
  exportBtnText: { color: "white", fontWeight: "900" },

  // inspection banner + exit (keep)
  bannerWrap: { gap: 10 },
  banner: { backgroundColor: "#111", paddingVertical: 10, paddingHorizontal: 12, borderRadius: 12 },
  bannerText: { color: "white", fontWeight: "900", textAlign: "center", letterSpacing: 0.3 },
  exitBtn: { backgroundColor: "#c62828", padding: 12, borderRadius: 12, alignItems: "center" },
  exitText: { color: "white", fontWeight: "900" },
});
