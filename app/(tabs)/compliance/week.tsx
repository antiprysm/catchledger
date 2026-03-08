import { ThemeContext } from "@/theme/ThemeProvider";
import { useFocusEffect } from "expo-router";
import { useTranslation } from "react-i18next";
import { useCallback, useContext, useMemo, useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { STORAGE_KEYS } from "@/constants/storageKeys";
import { InventoryItem } from "@/types/inventory";
import { LicenseProfile } from "@/types/license";
import { Sale } from "@/types/sales";
import { loadAppSettings, toLicenseProfileFallback } from "@/utils/appSettings";
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


function translateEnumValue(
  t: (key: string, options?: Record<string, unknown>) => string,
  baseKey: string,
  value: string | null | undefined
) {
  if (!value) return "";
  const key = `${baseKey}.${String(value).toLowerCase()}`;
  const translated = t(key);
  return translated === key ? value : translated;
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

function buildInspectionCSV(
  profile: LicenseProfile | null,
  harvest: InventoryItem[],
  sales: Sale[],
  t: (key: string, options?: Record<string, unknown>) => string
) {
  const lines: string[] = [];

  lines.push([t("compliance.csv.section"), t("compliance.csv.field"), t("compliance.csv.value")].map(csvEscape).join(","));
  lines.push([t("compliance.csv.profileSection"), t("compliance.csv.profile.state"), profile?.state ?? ""].map(csvEscape).join(","));
  lines.push([t("compliance.csv.profileSection"), t("compliance.csv.profile.licenseNumber"), profile?.licenseNumber ?? ""].map(csvEscape).join(","));
  lines.push([t("compliance.csv.profileSection"), t("compliance.csv.profile.legalName"), profile?.legalName ?? ""].map(csvEscape).join(","));
  lines.push([t("compliance.csv.profileSection"), t("compliance.csv.profile.dbaName"), profile?.dbaName ?? ""].map(csvEscape).join(","));
  lines.push([t("compliance.csv.profileSection"), t("compliance.csv.profile.phone"), profile?.phone ?? ""].map(csvEscape).join(","));
  lines.push([t("compliance.csv.profileSection"), t("compliance.csv.profile.email"), profile?.email ?? ""].map(csvEscape).join(","));
  lines.push([t("compliance.csv.profileSection"), t("compliance.csv.profile.vehiclePlate"), profile?.vehiclePlate ?? ""].map(csvEscape).join(","));
  lines.push([t("compliance.csv.profileSection"), t("compliance.csv.profile.homeBaseCity"), profile?.homeBaseCity ?? ""].map(csvEscape).join(","));
  lines.push([t("compliance.csv.profileSection"), t("compliance.csv.profile.updatedAt"), profile?.updatedAt ?? ""].map(csvEscape).join(","));

  lines.push("");

  lines.push([
    t("compliance.csv.section"),
    t("compliance.csv.harvest.inventoryId"),
    t("compliance.csv.harvest.batchId"),
    t("compliance.csv.harvest.species"),
    t("compliance.csv.harvest.quantity"),
    t("compliance.csv.harvest.unit"),
    t("compliance.csv.harvest.catchLocation"),
    t("compliance.csv.harvest.caughtAtIso"),
    t("compliance.csv.harvest.catchMethod"),
  ].map(csvEscape).join(","));
  for (const i of harvest) {
    lines.push(
      [
        t("compliance.csv.harvestSection"),
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

  lines.push([
    t("compliance.csv.section"),
    t("compliance.csv.sales.saleId"),
    t("compliance.csv.sales.occurredAtIso"),
    t("compliance.csv.sales.buyerName"),
    t("compliance.csv.sales.buyerType"),
    t("compliance.csv.sales.buyerContact"),
    t("compliance.csv.sales.paymentMethod"),
    t("compliance.csv.sales.paymentNote"),
    t("compliance.csv.sales.saleTotal"),
    t("compliance.csv.sales.lineItemId"),
    t("compliance.csv.sales.species"),
    t("compliance.csv.sales.quantity"),
    t("compliance.csv.sales.unit"),
    t("compliance.csv.sales.unitPrice"),
    t("compliance.csv.sales.lineSubtotal"),
    t("compliance.csv.sales.originBatchId"),
    t("compliance.csv.sales.originLocation"),
    t("compliance.csv.sales.originCaughtAtIso"),
    t("compliance.csv.sales.originMethod"),
  ].map(csvEscape).join(","));

  for (const s of sales) {
    for (const ln of s.lines) {
      lines.push(
        [
          t("compliance.csv.saleSection"),
          s.id,
          s.occurredAt,
          s.buyerName ?? "",
          translateEnumValue(t, "reports.saleType", s.buyerType),
          s.buyerContact ?? "",
          translateEnumValue(t, "reports.paymentType", s.paymentMethod),
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
  const { t } = useTranslation();

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
    const [s, inv, p, settings] = await Promise.all([
      loadJSON<Sale[]>(STORAGE_KEYS.SALES, []),
      loadJSON<InventoryItem[]>(STORAGE_KEYS.INVENTORY, []),
      loadJSON<LicenseProfile | null>(STORAGE_KEYS.LICENSE_PROFILE, null),
      loadAppSettings(),
    ]);
    setSales(s);
    setInventory(inv);
    setProfile(p ?? toLicenseProfileFallback(settings.companyProfile));
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
      const csv = buildInspectionCSV(profile, weekHarvest, weekSales, t);
      await shareTextFile(filename, "text/csv", csv, t("compliance.exportInspectionCsv7Days"));
    } catch (e: any) {
      Alert.alert(t("reports.exportFailed"), e?.message ?? t("reports.unknownError"));
    } finally {
      setBusy(false);
    }
  }, [busy, profile, t, weekHarvest, weekSales]);

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.bg }}
      contentContainerStyle={styles.container}
    >
      {inspectionMode ? (
        <View style={styles.bannerWrap}>
          <View style={styles.banner}>
            <Text style={styles.bannerText}>{t("compliance.inspectionReadOnly")}</Text>
          </View>

          <Pressable
            style={styles.exitBtn}
            onPress={async () => {
              await saveJSON(STORAGE_KEYS.INSPECTION_MODE, false);
              setInspectionMode(false);
              Alert.alert(t("compliance.inspectionOff"));
            }}
          >
            <Text style={styles.exitText}>{t("compliance.exitInspectionMode")}</Text>
          </Pressable>
        </View>
      ) : null}

      <View style={styles.headerRow}>
        <View style={styles.headerMain}>
          <Text style={[styles.h1, { color: colors.text }]}>{t("compliance.inspectionLast7Days")}</Text>
          <Text style={[styles.sub, { color: colors.muted }]}>{t("compliance.licenseHarvestSalesLog")}</Text>
        </View>

        <Pressable
          style={[styles.refreshBtn, { borderColor: colors.cardBorder, backgroundColor: colors.cardBg }]}
          onPress={load}
        >
          <Text style={[styles.refreshText, { color: colors.text }]}>{t("common.refresh")}</Text>
        </Pressable>
      </View>

      <View style={[styles.profileCard, { borderColor: colors.cardBorder, backgroundColor: colors.cardBg }]}>
        {profile ? (
          <>
            <Text style={[styles.profileTitle, { color: colors.text }]}>
              {profile.dbaName ? profile.dbaName : profile.legalName}
            </Text>

            <Text style={[styles.profileLine, { color: colors.muted }]}>
              {t("compliance.aquaticLifeDistributorLicense", { state: profile.state })}{" "}
              <Text style={[styles.bold, { color: colors.text }]}>{profile.licenseNumber}</Text>
            </Text>

            <Text style={[styles.profileLine, { color: colors.muted }]}>
              {t("compliance.legalValue", { value: profile.legalName })}
              {profile.vehiclePlate ? ` • ${t("compliance.plateValue", { value: profile.vehiclePlate })}` : ""}
            </Text>

            <Text style={[styles.profileLine, { color: colors.muted }]}>
              {profile.phone ? profile.phone : ""}
              {profile.phone && profile.email ? " • " : ""}
              {profile.email ? profile.email : ""}
            </Text>

            {profile.homeBaseCity ? (
              <Text style={[styles.profileLine, { color: colors.muted }]}>{t("compliance.homeBaseValue", { value: profile.homeBaseCity })}</Text>
            ) : null}

            <Text style={[styles.profileUpdated, { color: colors.muted }]}>
              {t("compliance.updatedValue", { value: new Date(profile.updatedAt).toLocaleString() })}
            </Text>
          </>
        ) : (
          <>
            <Text style={[styles.profileTitle, { color: colors.text }]}>{t("compliance.licenseProfileNotSet")}</Text>
            <Text style={[styles.profileLine, { color: colors.muted }]}>
              {t("compliance.goToLicenseProfileToConfigure")}
            </Text>
          </>
        )}
      </View>

      <View style={[styles.summaryCard, { borderColor: colors.cardBorder, backgroundColor: colors.cardBg }]}>
        <Text style={[styles.summaryLine, { color: colors.text }]}>
          {t("compliance.salesCount", { count: weekSales.length })}: <Text style={styles.bold}>{weekSales.length}</Text>
        </Text>
        <Text style={[styles.summaryLine, { color: colors.text }]}>
          {t("compliance.revenue")}: <Text style={styles.bold}>${revenue.toFixed(2)}</Text>
        </Text>
        <Text style={[styles.summaryLine, { color: colors.text }]}>
          {t("compliance.harvestEntries")}: <Text style={styles.bold}>{weekHarvest.length}</Text>
        </Text>
      </View>

      <Pressable
        style={[styles.exportBtn, busy && { opacity: 0.6 }]}
        onPress={exportInspectionCSV}
        disabled={busy}
      >
        <Text style={styles.exportBtnText}>
          {busy ? t("compliance.exporting") : t("compliance.exportInspectionCsv7Days")}
        </Text>
      </Pressable>

      <Text style={[styles.sectionTitle, { color: colors.text }]}>{t("compliance.harvestLogLast7Days")}</Text>
      {weekHarvest.length === 0 ? (
        <Text style={[styles.muted, { color: colors.muted }]}>{t("compliance.noHarvestLast7Days")}</Text>
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
              {i.catchLocation ? t("compliance.locationValue", { value: i.catchLocation }) : t("compliance.locationEmpty")}
            </Text>
            <Text style={[styles.muted, { color: colors.muted }]}>
              {i.caughtAt ? t("compliance.caughtValue", { value: fmtWhen(i.caughtAt) }) : t("compliance.caughtEmpty")}
            </Text>
            {i.catchMethod ? (
              <Text style={[styles.muted, { color: colors.muted }]}>{t("compliance.methodValue", { value: i.catchMethod })}</Text>
            ) : null}
          </View>
        ))
      )}

      <Text style={[styles.sectionTitle, { marginTop: 10, color: colors.text }]}>
        {t("compliance.salesLogLast7Days")}
      </Text>
      {weekSales.length === 0 ? (
        <Text style={[styles.muted, { color: colors.muted }]}>{t("compliance.noSalesLast7Days")}</Text>
      ) : (
        weekSales.map((s) => (
          <View
            key={s.id}
            style={[styles.saleCard, { borderColor: colors.cardBorder, backgroundColor: colors.cardBg }]}
          >
            <View style={styles.rowBetween}>
              <Text style={[styles.saleTitle, { color: colors.text }]}>
                {(s.buyerName || t("compliance.unknownBuyer")) + " "}
                <Text style={[styles.mutedInline, { color: colors.muted }]}>({s.buyerType || t("compliance.other")})</Text>
              </Text>
              <Text style={[styles.money, { color: colors.text }]}>${Number(s.total || 0).toFixed(2)}</Text>
            </View>

            <Text style={[styles.muted, { color: colors.muted }]}>{fmtWhen(s.occurredAt)}</Text>

            {s.buyerContact ? (
              <Text style={[styles.muted, { color: colors.muted }]}>{t("compliance.contactValue", { value: s.buyerContact })}</Text>
            ) : null}

            <Text style={[styles.muted, { color: colors.muted }]}>
              {t("compliance.paymentValue", { value: s.paymentMethod })}
              {s.paymentNote ? ` • ${s.paymentNote}` : ""}
            </Text>

            <View style={{ marginTop: 8, gap: 6 }}>
              {s.lines.map((ln) => {
                const origin = ln.originCatchLocation ? t("compliance.originValue", { value: ln.originCatchLocation }) : t("compliance.originEmpty");
                const caught = ln.originCaughtAt ? t("compliance.caughtValue", { value: fmtWhen(ln.originCaughtAt) }) : t("compliance.caughtEmpty");
                const method = ln.originCatchMethod ? t("compliance.methodValue", { value: ln.originCatchMethod }) : null;
                const batch = (ln as any).originBatchId ? t("compliance.batchValue", { value: (ln as any).originBatchId }) : null;

                return (
                  <View
                    key={`${s.id}-${ln.itemId}`}
                    style={[styles.lineBox, { borderColor: colors.cardBorder, backgroundColor: colors.bg }]}
                  >
                    <Text style={[styles.lineItem, { color: colors.text }]}>
                      • {ln.speciesName}: {ln.quantity} {ln.unit} {t("compliance.atPrice", { price: Number(ln.unitPrice).toFixed(2) })}
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

  headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", gap: 10 },
  headerMain: { flex: 1, minWidth: 0 },
  h1: { fontSize: 20, fontWeight: "900" },
  sub: { marginTop: 2 },

  refreshBtn: { borderWidth: 1, borderRadius: 12, paddingVertical: 8, paddingHorizontal: 12, alignSelf: "flex-start" },
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
