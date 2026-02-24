import { ThemeContext } from "@/theme/ThemeProvider";
import { useFocusEffect } from "expo-router";
import { useCallback, useContext, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";

import { STORAGE_KEYS } from "@/constants/storageKeys";
import { Expense } from "@/types/expenses";
import { Sale } from "@/types/sales";
import { loadAppSettings } from "@/utils/appSettings";
import { computeExpiringLots, computeLowInventoryItems } from "@/utils/notifications";
import type { InventoryItem } from "@/types/inventory";
import { loadJSON } from "@/utils/storage";

function startOfDay(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
}
function startOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), 1, 0, 0, 0, 0);
}
function daysAgo(n: number) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d;
}

type Bucket = { label: string; revenue: number; expenses: number; countSales: number; countExpenses: number };

export default function DashboardScreen() {
  const { colors } = useContext(ThemeContext);
  const { t, i18n } = useTranslation();

  const [sales, setSales] = useState<Sale[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [lowCount, setLowCount] = useState(0);
  const [expiringCount, setExpiringCount] = useState(0);

  const loadAll = useCallback(async () => {
    const [s, e, inventory, settings] = await Promise.all([
      loadJSON<Sale[]>(STORAGE_KEYS.SALES, []),
      loadJSON<Expense[]>(STORAGE_KEYS.EXPENSES, []),
      loadJSON<InventoryItem[]>(STORAGE_KEYS.INVENTORY, []),
      loadAppSettings(),
    ]);
    setSales(s);
    setExpenses(e);
    setLastUpdated(new Date());
    setLowCount(computeLowInventoryItems(inventory, settings).length);
    setExpiringCount(computeExpiringLots(inventory, settings).length);
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadAll();
    }, [loadAll])
  );

  const buckets = useMemo(() => {
    const now = new Date();
    const t0 = startOfDay(now).getTime();
    const w0 = startOfDay(daysAgo(6)).getTime(); // last 7 days incl today
    const m0 = startOfMonth(now).getTime();

    const init: { today: Bucket; last7: Bucket; thisMonth: Bucket } = {
      today: { label: t("dashboard.today"), revenue: 0, expenses: 0, countSales: 0, countExpenses: 0 },
      last7: { label: t("dashboard.last7Days"), revenue: 0, expenses: 0, countSales: 0, countExpenses: 0 },
      thisMonth: { label: t("dashboard.thisMonth"), revenue: 0, expenses: 0, countSales: 0, countExpenses: 0 },
    };

    for (const s of sales) {
      const ts = new Date(s.occurredAt).getTime();
      if (Number.isNaN(ts)) continue;

      if (ts >= t0) {
        init.today.revenue += s.total;
        init.today.countSales += 1;
      }
      if (ts >= w0) {
        init.last7.revenue += s.total;
        init.last7.countSales += 1;
      }
      if (ts >= m0) {
        init.thisMonth.revenue += s.total;
        init.thisMonth.countSales += 1;
      }
    }

    for (const e of expenses) {
      const te = new Date(e.occurredAt).getTime();
      if (Number.isNaN(te)) continue;

      if (te >= t0) {
        init.today.expenses += e.amount;
        init.today.countExpenses += 1;
      }
      if (te >= w0) {
        init.last7.expenses += e.amount;
        init.last7.countExpenses += 1;
      }
      if (te >= m0) {
        init.thisMonth.expenses += e.amount;
        init.thisMonth.countExpenses += 1;
      }
    }

    return init;
  }, [sales, expenses, t]);

  const allTimeRevenue = useMemo(() => sales.reduce((sum, s) => sum + s.total, 0), [sales]);
  const allTimeExpenses = useMemo(() => expenses.reduce((sum, e) => sum + e.amount, 0), [expenses]);

  const formatMoney = useMemo(() => {
    const formatter = new Intl.NumberFormat(i18n.language, {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 2,
    });
    return (amount: number) => formatter.format(amount);
  }, [i18n.language]);

  const topSpecies30 = useMemo(() => {
    const cutoff = startOfDay(daysAgo(29)).getTime(); // last 30 days incl today
    const bySpecies = new Map<string, number>();

    for (const s of sales) {
      const ts = new Date(s.occurredAt).getTime();
      if (Number.isNaN(ts) || ts < cutoff) continue;

      for (const line of s.lines) {
        const key = line.speciesName?.trim() || t("common.unknown");
        bySpecies.set(key, (bySpecies.get(key) ?? 0) + (line.subtotal ?? 0));
      }
    }

    return Array.from(bySpecies.entries())
      .map(([speciesName, revenue]) => ({ speciesName, revenue }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 8);
  }, [sales, t]);

  return (
    <FlatList
      style={{ flex: 1, backgroundColor: colors.bg }}
      contentContainerStyle={styles.container}
      data={topSpecies30}
      keyExtractor={(x) => x.speciesName}
      ListHeaderComponent={
        <>
          <View style={styles.headerRow}>
            <Text style={[styles.title, { color: colors.text }]}>{t("dashboard.title")}</Text>

            <View style={{ alignItems: "flex-end" }}>
              <Pressable
                onPress={loadAll}
                style={[
                  styles.refreshBtn,
                  { borderColor: colors.cardBorder, backgroundColor: colors.cardBg },
                ]}
              >
                <Text style={[styles.refreshText, { color: colors.text }]}>{t("common.refresh")}</Text>
              </Pressable>

              {lastUpdated ? (
                <Text style={[styles.updatedText, { color: colors.muted }]}>
                  {t("dashboard.updated", { time: lastUpdated.toLocaleTimeString(i18n.language) })}
                </Text>
              ) : null}
            </View>
          </View>

          {(lowCount > 0 || expiringCount > 0) ? (
            <View style={[styles.alertCard, { borderColor: colors.cardBorder, backgroundColor: colors.cardBg }]}>
              {lowCount > 0 ? <Text style={[styles.alertText, { color: colors.text }]}>{t("dashboard.lowInventoryItems", { count: lowCount })}</Text> : null}
              {expiringCount > 0 ? <Text style={[styles.alertText, { color: colors.text }]}>{t("dashboard.expiringLotsSoon", { count: expiringCount })}</Text> : null}
            </View>
          ) : null}

          <Text style={[styles.sectionTitle, { color: colors.text }]}>{t("dashboard.totals")}</Text>

          <View style={styles.cardsRow}>
            <MoneyCard
              colors={colors}
              label={t("dashboard.allTimeRevenue")}
              amount={allTimeRevenue}
              subtitle={t("dashboard.salesCount", { count: sales.length })}
              formatMoney={formatMoney}
            />
            <MoneyCard
              colors={colors}
              label={t("dashboard.allTimeExpenses")}
              amount={allTimeExpenses}
              subtitle={t("dashboard.expensesCount", { count: expenses.length })}
              formatMoney={formatMoney}
            />
          </View>

          <View style={styles.cardsRow}>
            <MoneyCard
              colors={colors}
              label={t("dashboard.allTimeNet")}
              amount={allTimeRevenue - allTimeExpenses}
              subtitle={t("dashboard.revenueMinusExpenses")}
              formatMoney={formatMoney}
              emphasize
            />
          </View>

          <Text style={[styles.sectionTitle, { color: colors.text }]}>{t("dashboard.thisPeriod")}</Text>
          <PeriodRow colors={colors} bucket={buckets.today} formatMoney={formatMoney} />
          <PeriodRow colors={colors} bucket={buckets.last7} formatMoney={formatMoney} />
          <PeriodRow colors={colors} bucket={buckets.thisMonth} formatMoney={formatMoney} />

          <Text style={[styles.sectionTitle, { marginTop: 10, color: colors.text }]}>
            {t("dashboard.topSpeciesLast30")}
          </Text>

          {topSpecies30.length === 0 ? (
            <Text style={{ color: colors.muted, marginTop: 6 }}>{t("dashboard.noSalesYet")}</Text>
          ) : null}
        </>
      }
      renderItem={({ item, index }) => (
        <View style={[styles.rankRow, { borderColor: colors.cardBorder }]}>
          <Text style={[styles.rankNum, { color: colors.muted }]}>{index + 1}</Text>
          <Text style={[styles.rankName, { color: colors.text }]}>{item.speciesName}</Text>
          <Text style={[styles.rankVal, { color: colors.text }]}>{formatMoney(item.revenue)}</Text>
        </View>
      )}
    />
  );
}

function MoneyCard({
  colors,
  label,
  amount,
  subtitle,
  formatMoney,
  emphasize,
}: {
  colors: any;
  label: string;
  amount: number;
  subtitle?: string;
  formatMoney: (amount: number) => string;
  emphasize?: boolean;
}) {
  const neg = amount < 0;
  return (
    <View
      style={[
        styles.card,
        { borderColor: colors.cardBorder, backgroundColor: colors.cardBg },
        emphasize && { borderColor: colors.text },
      ]}
    >
      <Text style={[styles.cardLabel, { color: colors.muted }]}>{label}</Text>
      <Text style={[styles.cardAmount, { color: colors.text }, neg && styles.negative]}>
        {formatMoney(amount)}
      </Text>
      {subtitle ? <Text style={[styles.cardSub, { color: colors.muted }]}>{subtitle}</Text> : null}
    </View>
  );
}

function PeriodRow({ bucket, colors, formatMoney }: { bucket: Bucket; colors: any; formatMoney: (amount: number) => string }) {
  const { t } = useTranslation();
  const net = bucket.revenue - bucket.expenses;

  return (
    <View style={[styles.periodRow, { borderColor: colors.cardBorder, backgroundColor: colors.cardBg }]}>
      <Text style={[styles.periodLabel, { color: colors.text }]}>{bucket.label}</Text>

      <View style={{ flex: 1 }}>
        <Text style={[styles.periodLine, { color: colors.text }]}>
          {t("dashboard.revenue")}: <Text style={styles.bold}>{formatMoney(bucket.revenue)}</Text>{" "}
          <Text style={[styles.muted, { color: colors.muted }]}>({bucket.countSales})</Text>
        </Text>

        <Text style={[styles.periodLine, { color: colors.text }]}>
          {t("dashboard.expenses")}: <Text style={styles.bold}>{formatMoney(bucket.expenses)}</Text>{" "}
          <Text style={[styles.muted, { color: colors.muted }]}>({bucket.countExpenses})</Text>
        </Text>

        <Text style={[styles.periodLine, { color: colors.text }]}>
          {t("dashboard.net")}:{" "}
          <Text style={[styles.bold, net < 0 && styles.negative]}>
            {formatMoney(net)}
          </Text>
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, gap: 12, paddingBottom: 40 },
  headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  title: { fontSize: 22, fontWeight: "800" },

  refreshBtn: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
  },
  refreshText: { fontWeight: "700" },
  updatedText: { fontSize: 12, marginTop: 4 },

  sectionTitle: { fontWeight: "900", paddingTop: 5 },

  cardsRow: { flexDirection: "row", gap: 10, marginTop: 5 },
  card: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 14,
    padding: 12,
    gap: 4,
  },
  cardLabel: { fontWeight: "700" },
  cardAmount: { fontSize: 20, fontWeight: "900" },
  cardSub: {},
  negative: { color: "#c62828" },

  periodRow: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 12,
    flexDirection: "row",
    gap: 12,
  },
  periodLabel: { width: 90, fontWeight: "900" },
  periodLine: { marginBottom: 2 },
  bold: { fontWeight: "900" },
  muted: { opacity: 1 }, // keep; actual muted color comes from theme

  rankRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  rankNum: { width: 24, fontWeight: "800" },
  rankName: { flex: 1, fontWeight: "700" },
  rankVal: { width: 100, textAlign: "right", fontWeight: "800" },
  alertCard: { borderWidth: 1, borderRadius: 12, padding: 10, marginTop: 8, gap: 4 },
  alertText: { fontWeight: "800" },
});
