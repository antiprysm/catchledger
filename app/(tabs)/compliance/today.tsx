import { ThemeContext } from "@/theme/ThemeProvider";
import { useFocusEffect } from "expo-router";
import { useCallback, useContext, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Alert, Pressable, ScrollView, StyleSheet, Switch, Text, View } from "react-native";

import { STORAGE_KEYS } from "@/constants/storageKeys";
import { Expense } from "@/types/expenses";
import { InventoryItem } from "@/types/inventory";
import { LicenseProfile } from "@/types/license";
import { Sale } from "@/types/sales";
import { loadAppSettings, toLicenseProfileFallback } from "@/utils/appSettings";
import { loadJSON, saveJSON } from "@/utils/storage";

function startOfDay(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0).getTime();
}

function fmtWhen(iso: string) {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleString();
}

export default function ComplianceToday() {
  const { colors, mode } = useContext(ThemeContext);
  const { t } = useTranslation();

  const [sales, setSales] = useState<Sale[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [profile, setProfile] = useState<LicenseProfile | null>(null);

  // NOTE: you already have STORAGE_KEYS.INSPECTION_MODE — prefer using that.
  const INSPECTION_MODE_KEY = STORAGE_KEYS.INSPECTION_MODE;

  const [inspectionMode, setInspectionMode] = useState(false);

  useFocusEffect(
    useCallback(() => {
      loadJSON<boolean>(STORAGE_KEYS.INSPECTION_MODE, false).then(setInspectionMode);
    }, [])
  );

  const load = useCallback(async () => {
    const [s, e, inv, p, settings, modeVal] = await Promise.all([
      loadJSON<Sale[]>(STORAGE_KEYS.SALES, []),
      loadJSON<Expense[]>(STORAGE_KEYS.EXPENSES, []),
      loadJSON<InventoryItem[]>(STORAGE_KEYS.INVENTORY, []),
      loadJSON<LicenseProfile | null>(STORAGE_KEYS.LICENSE_PROFILE, null),
      loadAppSettings(),
      loadJSON<boolean>(INSPECTION_MODE_KEY, false),
    ]);
    setSales(s);
    setExpenses(e);
    setInventory(inv);
    setProfile(p ?? toLicenseProfileFallback(settings.companyProfile));
    setInspectionMode(!!modeVal);
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const toggleInspectionMode = useCallback(async (value: boolean) => {
    setInspectionMode(value);
    await saveJSON(INSPECTION_MODE_KEY, value);
  }, []);

  const cutoff = useMemo(() => startOfDay(new Date()), []);

  const todaySales = useMemo(() => {
    return sales
      .filter((s) => new Date(s.occurredAt).getTime() >= cutoff)
      .sort((a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime());
  }, [sales, cutoff]);

  const todayExpenses = useMemo(() => {
    return expenses
      .filter((e) => new Date(e.occurredAt).getTime() >= cutoff)
      .sort((a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime());
  }, [expenses, cutoff]);

  const todayHarvest = useMemo(() => {
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

  const summary = useMemo(() => {
    const revenue = todaySales.reduce((sum, s) => sum + (Number(s.total) || 0), 0);
    const exp = todayExpenses.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
    return {
      revenue,
      exp,
      net: revenue - exp,
      saleCount: todaySales.length,
      expenseCount: todayExpenses.length,
    };
  }, [todaySales, todayExpenses]);

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
          <Text style={[styles.h1, { color: colors.text }]}>{t("compliance.today")}</Text>
          <Text style={[styles.sub, { color: colors.muted }]}>
            Inspection-ready summary (offline).
          </Text>
        </View>

        <Pressable style={styles.btn} onPress={load}>
          <Text style={styles.btnText}>Refresh</Text>
        </Pressable>
      </View>

      <View style={[styles.toggleRow, { borderColor: colors.cardBorder, backgroundColor: colors.cardBg }]}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.toggleTitle, { color: colors.text }]}>Inspection Mode</Text>
          <Text style={[styles.toggleSub, { color: colors.muted }]}>
            Hides business metrics. Shows only license + harvest + sales logs.
          </Text>
        </View>

        <Switch
          value={inspectionMode}
          onValueChange={toggleInspectionMode}
          trackColor={{ false: colors.cardBorder, true: colors.primary }}
          thumbColor={mode === "DARK" ? colors.cardBg : "#fff"}
        />
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
              <Text style={[styles.profileLine, { color: colors.muted }]}>
                Home base: {profile.homeBaseCity}
              </Text>
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

      {!inspectionMode ? (
        <>
          <View style={[styles.card, { borderColor: colors.cardBorder, backgroundColor: colors.cardBg }]}>
            <Text style={[styles.label, { color: colors.muted }]}>Revenue</Text>
            <Text style={[styles.value, { color: colors.text }]}>${summary.revenue.toFixed(2)}</Text>
            <Text style={[styles.small, { color: colors.muted }]}>{summary.saleCount} sale(s)</Text>
          </View>

          <View style={[styles.card, { borderColor: colors.cardBorder, backgroundColor: colors.cardBg }]}>
            <Text style={[styles.label, { color: colors.muted }]}>Expenses</Text>
            <Text style={[styles.value, { color: colors.text }]}>${summary.exp.toFixed(2)}</Text>
            <Text style={[styles.small, { color: colors.muted }]}>{summary.expenseCount} expense(s)</Text>
          </View>

          <View style={[styles.card, { borderColor: colors.cardBorder, backgroundColor: colors.cardBg }]}>
            <Text style={[styles.label, { color: colors.muted }]}>Net</Text>
            <Text style={[styles.value, { color: summary.net < 0 ? "#c62828" : colors.text }]}>
              ${summary.net.toFixed(2)}
            </Text>
            <Text style={[styles.small, { color: colors.muted }]}>Revenue − Expenses</Text>
          </View>
        </>
      ) : null}

      <Text style={[styles.sectionTitle, { color: colors.text }]}>Harvest log (today)</Text>

      {todayHarvest.length === 0 ? (
        <Text style={[styles.muted, { color: colors.muted }]}>No harvest logged today.</Text>
      ) : (
        todayHarvest.map((i) => (
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

      <Text style={[styles.sectionTitle, { marginTop: 10, color: colors.text }]}>Today’s sales</Text>

      {todaySales.length === 0 ? (
        <Text style={[styles.muted, { color: colors.muted }]}>No sales logged today.</Text>
      ) : (
        todaySales.map((s) => (
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
              {s.lines.map((ln) => (
                <View
                  key={`${s.id}-${ln.itemId}`}
                  style={[styles.lineBox, { borderColor: colors.cardBorder, backgroundColor: colors.bg }]}
                >
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

      <Text style={[styles.note, { color: colors.muted }]}>
        Next: add buyer license # (optional) + harvest log section + inspection export.
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, gap: 12, paddingBottom: 40 },

  headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  h1: { fontSize: 20, fontWeight: "900" },
  sub: { marginTop: 2 },

  card: { borderWidth: 1, borderRadius: 14, padding: 12, gap: 4 },
  label: { fontWeight: "800" },
  value: { fontSize: 20, fontWeight: "900" },
  small: {},

  // keep black button
  btn: { backgroundColor: "#111", paddingVertical: 10, paddingHorizontal: 12, borderRadius: 12 },
  btnText: { color: "white", fontWeight: "900" },

  sectionTitle: { fontWeight: "900", marginTop: 6 },
  muted: {},
  mutedInline: { fontWeight: "700" },

  saleCard: { borderWidth: 1, borderRadius: 14, padding: 12, gap: 4 },
  rowBetween: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 10 },
  saleTitle: { fontWeight: "900", flex: 1 },
  money: { fontWeight: "900" },

  lineBox: { borderWidth: 1, borderRadius: 12, padding: 10 },
  lineItem: { fontWeight: "800" },
  lineMeta: { marginTop: 2 },

  note: { marginTop: 8, lineHeight: 18 },

  harvestCard: { borderWidth: 1, borderRadius: 14, padding: 12, gap: 4 },
  harvestTitle: { fontWeight: "900", flex: 1 },
  harvestQty: { fontWeight: "900" },

  profileCard: { borderWidth: 1, borderRadius: 14, padding: 12, gap: 4 },
  profileTitle: { fontWeight: "900", fontSize: 16 },
  profileLine: {},
  profileUpdated: { marginTop: 4, fontSize: 12 },
  bold: { fontWeight: "900" },

  toggleRow: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  toggleTitle: { fontWeight: "900" },
  toggleSub: { marginTop: 2, fontSize: 12, lineHeight: 16 },

  bannerWrap: { gap: 10 },
  banner: { backgroundColor: "#111", padding: 10, borderRadius: 12 },
  bannerText: { color: "white", fontWeight: "900", textAlign: "center" },
  exitBtn: { backgroundColor: "#c62828", padding: 12, borderRadius: 12, alignItems: "center" },
  exitText: { color: "white", fontWeight: "900" },
});
