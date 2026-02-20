import { ThemeContext } from "@/theme/ThemeProvider";
import DateTimePicker from "@react-native-community/datetimepicker";
import { useFocusEffect } from "expo-router";
import { useCallback, useContext, useMemo, useState } from "react";

import { Alert, Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { STORAGE_KEYS } from "@/constants/storageKeys";
import { InventoryItem } from "@/types/inventory";
import { LicenseProfile } from "@/types/license";
import { Sale } from "@/types/sales";
import { loadJSON, saveJSON } from "@/utils/storage";

import { File, Paths } from "expo-file-system";
import * as Sharing from "expo-sharing";




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
  
  async function shareTextFile(filename: string, mimeType: string, contents: string, dialogTitle: string) {
    const file = new File(Paths.cache, filename);
    try { file.create(); } catch {}
    file.write(contents);
  
    const canShare = await Sharing.isAvailableAsync();
    if (!canShare) throw new Error("Sharing not available on this device.");
    await Sharing.shareAsync(file.uri, {
      mimeType,
      dialogTitle,
      UTI: "public.comma-separated-values-text",
    });
  }

  function buildInspectionCSV(
    profile: LicenseProfile | null,
    harvest: InventoryItem[],
    sales: Sale[],
  ) {
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
        ].map(csvEscape).join(",")
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
      
              // origin snapshot captured at time of sale
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
  
  

function fmtWhen(iso: string) {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleString();
}

function startOfDay(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0).getTime();
}

function endOfDay(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999).getTime();
}

function startOfMonth(d: Date) {
    return new Date(d.getFullYear(), d.getMonth(), 1, 0, 0, 0, 0);
  }
  
  function daysAgo(n: number) {
    const d = new Date();
    d.setDate(d.getDate() - n);
    return d;
  }

  type PresetType = "TODAY" | "LAST_7" | "LAST_30" | "THIS_MONTH";
    type ActivePreset = PresetType | null;

    const PRESETS: { key: PresetType; label: string }[] = [
    { key: "TODAY", label: "Today" },
    { key: "LAST_7", label: "Last 7" },
    { key: "LAST_30", label: "Last 30" },
    { key: "THIS_MONTH", label: "This Month" },
    ];
  

export default function ComplianceRange() {
  const [sales, setSales] = useState<Sale[]>([]);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [profile, setProfile] = useState<LicenseProfile | null>(null);
  const [busy, setBusy] = useState(false);
  const [activePreset, setActivePreset] = useState<ActivePreset>("LAST_7");
  const { colors } = useContext(ThemeContext);


  const [startDate, setStartDate] = useState<Date>(() => daysAgo(6));
  const [endDate, setEndDate] = useState<Date>(() => new Date());

  const [showStart, setShowStart] = useState(false);
  const [showEnd, setShowEnd] = useState(false);
  const [inspectionMode, setInspectionMode] = useState(false);

        useFocusEffect(
        useCallback(() => {
            loadJSON<boolean>(STORAGE_KEYS.INSPECTION_MODE, false).then(setInspectionMode);
        }, [])
        );

  const range = useMemo(() => {
    const from = startOfDay(startDate);
    const to = endOfDay(endDate);
    return { from, to };
  }, [startDate, endDate]);

  const rangeSales = useMemo(() => {
    return sales
      .filter((s) => {
        const t = new Date(s.occurredAt).getTime();
        return t >= range.from && t <= range.to;
      })
      .sort((a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime());
  }, [sales, range]);

  const rangeHarvest = useMemo(() => {
    return inventory
      .filter((i) => {
        const iso = i.caughtAt ?? (i as any).createdAt;
        if (!iso) return false;
        const t = new Date(iso).getTime();
        return t >= range.from && t <= range.to;
      })
      .sort((a, b) => {
        const ta = a.caughtAt ? new Date(a.caughtAt).getTime() : 0;
        const tb = b.caughtAt ? new Date(b.caughtAt).getTime() : 0;
        return tb - ta;
      });
  }, [inventory, range]);

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

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const exportRangeCSV = useCallback(async () => {
    if (busy) return;
    setBusy(true);
    try {
      if (!rangeSales.length && !rangeHarvest.length) {
        Alert.alert("Nothing to export", "No harvest or sales in this date range.");
        return;
      }
  
      const filename = `catchledger_inspection_range_${stampForName()}.csv`;
      const csv = buildInspectionCSV(profile, rangeHarvest, rangeSales);
      await shareTextFile(filename, "text/csv", csv, "Export Inspection CSV (Range)");
    } catch (e: any) {
      Alert.alert("Export failed", e?.message ?? "Unknown error");
    } finally {
      setBusy(false);
    }
  }, [busy, profile, rangeHarvest, rangeSales]);  

  const applyPreset = useCallback((preset: PresetType) => {
    const now = new Date();
  
    if (preset === "TODAY") {
      setStartDate(now);
      setEndDate(now);
    } else if (preset === "LAST_7") {
      setStartDate(daysAgo(6));
      setEndDate(now);
    } else if (preset === "LAST_30") {
      setStartDate(daysAgo(29));
      setEndDate(now);
    } else if (preset === "THIS_MONTH") {
      setStartDate(startOfMonth(now));
      setEndDate(now);
    }
  
    setActivePreset(preset);
    setShowStart(false);
    setShowEnd(false);
  }, []);

  const revenue = useMemo(
    () => rangeSales.reduce((sum, s) => sum + (Number(s.total) || 0), 0),
    [rangeSales]
  );

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
        <Text style={[styles.h1, { color: colors.text }]}>Inspection — Date Range</Text>
        <Text style={[styles.sub, { color: colors.muted }]}>Select a range for harvest + sales logs.</Text>
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
            <Text style={[styles.profileTitle, {color: colors.text}]}>
              {profile.dbaName ? profile.dbaName : profile.legalName}
            </Text>
            <Text style={[styles.profileLine, { color: colors.muted }]}>
              {profile.state} License: <Text style={styles.bold}>{profile.licenseNumber}</Text>
            </Text>
            <Text style={[styles.profileLine, { color: colors.muted }]}>
              Legal: {profile.legalName}
              {profile.vehiclePlate ? ` • Plate: ${profile.vehiclePlate}` : ""}
            </Text>
          </>
        ) : (
          <>
            <Text style={[styles.profileTitle, {color: colors.text}]}>License profile not set</Text>
            <Text style={[styles.profileLine, { color: colors.muted }]}>Go to Compliance → License Profile to configure.</Text>
          </>
        )}
      </View>
      
      <View style={styles.presetRow}>
        {PRESETS.map((p) => {
            const isActive = activePreset === p.key;

            return (
            <Pressable
                key={p.key}
                onPress={() => applyPreset(p.key)}
                style={[
                  styles.presetChip,
                  { borderColor: colors.cardBorder, backgroundColor: colors.cardBg },
                  isActive && styles.presetChipActive,
                ]}                
            >
                <Text style={isActive ? styles.presetTextActive : [styles.presetText, { color: colors.text }]}>
                {p.label}
                </Text>
            </Pressable>
            );
        })}
        </View>




      <View style={styles.rangeRow}>
        <Pressable style={[styles.dateBtn, { borderColor: colors.cardBorder, backgroundColor: colors.cardBg }]} onPress={() => setShowStart(true)}>
          <Text style={[styles.dateBtnLabel, { color: colors.muted }]}>Start</Text>
          <Text style={[styles.dateBtnValue, { color: colors.text }]}>{startDate.toLocaleDateString()}</Text>
        </Pressable>

        <Pressable style={[styles.dateBtn, { borderColor: colors.cardBorder, backgroundColor: colors.cardBg }]} onPress={() => setShowEnd(true)}>
          <Text style={[styles.dateBtnLabel, { color: colors.muted }]}>End</Text>
          <Text style={[styles.dateBtnValue, { color: colors.text }]}>{endDate.toLocaleDateString()}</Text>
        </Pressable>
      </View>

      {showStart ? (
        <DateTimePicker
          value={startDate}
          mode="date"
          display={Platform.OS === "ios" ? "spinner" : "default"}
          onChange={(_, d) => {
            setShowStart(false);
            if (d) {
              setStartDate(d);
              setActivePreset(null);
            }
          }}          
        />
      ) : null}

      {showEnd ? (
        <DateTimePicker
          value={endDate}
          mode="date"
          display={Platform.OS === "ios" ? "spinner" : "default"}
          onChange={(_, d) => {
            setShowEnd(false);
            if (d) {
              setEndDate(d);
              setActivePreset(null);
            }
          }}          
        />
      ) : null}

        <View style={[styles.summaryCard, { borderColor: colors.cardBorder, backgroundColor: colors.cardBg }]}>
        <Text style={[styles.summaryLine, { color: colors.text }]}>
          Harvest entries: <Text style={styles.bold}>{rangeHarvest.length}</Text>
        </Text>
        <Text style={[styles.summaryLine, { color: colors.text }]}>
          Sales: <Text style={styles.bold}>{rangeSales.length}</Text>
        </Text>
        <Text style={[styles.summaryLine, { color: colors.text }]}>
          Revenue: <Text style={styles.bold}>${revenue.toFixed(2)}</Text>
        </Text>
      </View>
      
      <Pressable
        style={[styles.exportBtn, busy && { opacity: 0.6 }]}
        onPress={exportRangeCSV}
        disabled={busy}
        >
        <Text style={styles.exportBtnText}>
            {busy ? "Exporting..." : "Export Inspection CSV (range)"}
        </Text>
        </Pressable>


      <Text style={[styles.sectionTitle, { color: colors.text }]}>Harvest log</Text>
      {rangeHarvest.length === 0 ? (
        <Text style={[styles.muted, { color: colors.muted }]}>No harvest entries in this range.</Text>
      ) : (
        rangeHarvest.map((i) => (
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
            <Text style={[styles.muted, { color: colors.muted }]}>{i.catchLocation ? `Location: ${i.catchLocation}` : "Location: —"}</Text>
            <Text style={[styles.muted, { color: colors.muted }]}>{i.caughtAt ? `Caught: ${fmtWhen(i.caughtAt)}` : "Caught: —"}</Text>
            {i.catchMethod ? <Text style={[styles.muted, { color: colors.muted }]}>Method: {i.catchMethod}</Text> : null}
          </View>
        ))
      )}

      <Text style={[styles.sectionTitle, { marginTop: 10 }]}>Sales log</Text>
      {rangeSales.length === 0 ? (
        <Text style={[styles.muted, { color: colors.muted }]}>No sales in this range.</Text>
      ) : (
        rangeSales.map((s) => (
          <View key={s.id} style={[styles.saleCard, { borderColor: colors.cardBorder, backgroundColor: colors.cardBg }]}>
            <View style={styles.rowBetween}>
              <Text style={[styles.saleTitle, { color: colors.text }]}>
                {(s as any).buyerName || "Unknown buyer"}{" "}
                <Text style={[styles.mutedInline, { color: colors.muted }]}>({(s as any).buyerType || "OTHER"})</Text>
              </Text>
              <Text style={[styles.money, { color: colors.text }]}>${Number(s.total || 0).toFixed(2)}</Text>
            </View>

            <Text style={[styles.muted, { color: colors.muted }]}>{fmtWhen(s.occurredAt)}</Text>

            <View style={{ marginTop: 8, gap: 6 }}>
            {s.lines.map((ln) => (
              <View key={`${s.id}-${ln.itemId}`} style={[styles.lineBox, { borderColor: colors.cardBorder, backgroundColor: colors.bg }]}>
                <Text style={[styles.lineItem, { color: colors.text }]}>
                  • {ln.speciesName}: {ln.quantity} {ln.unit} @ ${Number(ln.unitPrice).toFixed(2)}
                </Text>

                <Text style={[styles.lineMeta, { color: colors.muted }]}>
                  {ln.originCatchLocation ? `Origin: ${ln.originCatchLocation}` : "Origin: —"}
                </Text>

                <Text style={[styles.lineMeta, { color: colors.muted }]}>
                  {ln.originCaughtAt ? `Caught: ${fmtWhen(ln.originCaughtAt)}` : "Caught: —"}
                </Text>

                {ln.originCatchMethod ? (
                  <Text style={[styles.lineMeta, { color: colors.muted }]}>Method: {ln.originCatchMethod}</Text>
                ) : null}
              </View>
            ))}

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
  sub: { opacity: 0.75, marginTop: 2 },

  refreshBtn: { borderWidth: 1, borderColor: "#ddd", borderRadius: 12, paddingVertical: 8, paddingHorizontal: 12 },
  refreshText: { fontWeight: "900" },

  profileCard: { borderWidth: 1, borderColor: "#ddd", borderRadius: 14, padding: 12, gap: 4 },
  profileTitle: { fontWeight: "900", fontSize: 16 },
  profileLine: { opacity: 0.85 },
  bold: { fontWeight: "900" },

  rangeRow: { flexDirection: "row", gap: 10 },
  dateBtn: { flex: 1, borderWidth: 1, borderColor: "#ddd", borderRadius: 14, padding: 12, gap: 4 },
  dateBtnLabel: { opacity: 0.7, fontWeight: "800", fontSize: 12 },
  dateBtnValue: { fontWeight: "900" },

  summaryCard: { borderWidth: 1, borderColor: "#ddd", borderRadius: 14, padding: 12, gap: 6 },
  summaryLine: { fontSize: 14 },

  sectionTitle: { fontWeight: "900", marginTop: 6 },
  muted: { opacity: 0.7 },
  mutedInline: { opacity: 0.7, fontWeight: "700" },

  rowBetween: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 10 },

  harvestCard: { borderWidth: 1, borderColor: "#eee", borderRadius: 14, padding: 12, gap: 4 },
  harvestTitle: { fontWeight: "900", flex: 1 },
  harvestQty: { fontWeight: "900" },

  saleCard: { borderWidth: 1, borderColor: "#eee", borderRadius: 14, padding: 12, gap: 4 },
  saleTitle: { fontWeight: "900", flex: 1 },
  money: { fontWeight: "900" },

  lineBox: { borderWidth: 1, borderColor: "#f0f0f0", borderRadius: 12, padding: 10 },
  lineItem: { fontWeight: "800" },
  lineMeta: { opacity: 0.75, marginTop: 2 },
  exportBtn: { backgroundColor: "#111", padding: 14, borderRadius: 12, alignItems: "center" },
  exportBtnText: { color: "white", fontWeight: "900" },
  presetRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
presetChip: {
  borderWidth: 1,
  borderColor: "#ddd",
  borderRadius: 999,
  paddingVertical: 8,
  paddingHorizontal: 12,
},
presetText: { fontWeight: "900", opacity: 0.85 },
presetChipActive: {
    backgroundColor: "#111",
    borderColor: "#111",
  },
  presetTextActive: {
    color: "white",
    fontWeight: "900",
  },
  bannerWrap: { gap: 10 },
  banner: { backgroundColor: "#111", padding: 10, borderRadius: 12 },
  bannerText: { color: "white", fontWeight: "900", textAlign: "center" },
  exitBtn: { backgroundColor: "#c62828", padding: 12, borderRadius: 12, alignItems: "center" },
  exitText: { color: "white", fontWeight: "900" },
});
