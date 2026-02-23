import { ThemeContext } from "@/theme/ThemeProvider";
import { useFocusEffect } from "expo-router";
import { useCallback, useContext, useMemo, useState } from "react";
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
      today: { label: "Today", revenue: 0, expenses: 0, countSales: 0, countExpenses: 0 },
      last7: { label: "Last 7 days", revenue: 0, expenses: 0, countSales: 0, countExpenses: 0 },
      thisMonth: { label: "This month", revenue: 0, expenses: 0, countSales: 0, countExpenses: 0 },
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
  }, [sales, expenses]);

  const allTimeRevenue = useMemo(() => sales.reduce((sum, s) => sum + s.total, 0), [sales]);
  const allTimeExpenses = useMemo(() => expenses.reduce((sum, e) => sum + e.amount, 0), [expenses]);

  const topSpecies30 = useMemo(() => {
    const cutoff = startOfDay(daysAgo(29)).getTime(); // last 30 days incl today
    const bySpecies = new Map<string, number>();

    for (const s of sales) {
      const ts = new Date(s.occurredAt).getTime();
      if (Number.isNaN(ts) || ts < cutoff) continue;

      for (const line of s.lines) {
        const key = line.speciesName?.trim() || "Unknown";
        bySpecies.set(key, (bySpecies.get(key) ?? 0) + (line.subtotal ?? 0));
      }
    }

    return Array.from(bySpecies.entries())
      .map(([speciesName, revenue]) => ({ speciesName, revenue }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 8);
  }, [sales]);

  return (
    <FlatList
      style={{ flex: 1, backgroundColor: colors.bg }}
      contentContainerStyle={styles.container}
      data={topSpecies30}
      keyExtractor={(x) => x.speciesName}
      ListHeaderComponent={
        <>
          <View style={styles.headerRow}>
            <Text style={[styles.title, { color: colors.text }]}>Dashboard</Text>

            <View style={{ alignItems: "flex-end" }}>
              <Pressable
                onPress={loadAll}
                style={[
                  styles.refreshBtn,
                  { borderColor: colors.cardBorder, backgroundColor: colors.cardBg },
                ]}
              >
                <Text style={[styles.refreshText, { color: colors.text }]}>Refresh</Text>
              </Pressable>

              {lastUpdated ? (
                <Text style={[styles.updatedText, { color: colors.muted }]}>
                  Updated {lastUpdated.toLocaleTimeString()}
                </Text>
              ) : null}
            </View>
          </View>

          {(lowCount > 0 || expiringCount > 0) ? (
            <View style={[styles.alertCard, { borderColor: colors.cardBorder, backgroundColor: colors.cardBg }]}>
              {lowCount > 0 ? <Text style={[styles.alertText, { color: colors.text }]}>Low inventory items: {lowCount}</Text> : null}
              {expiringCount > 0 ? <Text style={[styles.alertText, { color: colors.text }]}>Expiring lots soon: {expiringCount}</Text> : null}
            </View>
          ) : null}

          <Text style={[styles.sectionTitle, { color: colors.text }]}>Totals</Text>

          <View style={styles.cardsRow}>
            <MoneyCard
              colors={colors}
              label="All time revenue"
              amount={allTimeRevenue}
              subtitle={`${sales.length} sale${sales.length === 1 ? "" : "s"}`}
            />
            <MoneyCard
              colors={colors}
              label="All time expenses"
              amount={allTimeExpenses}
              subtitle={`${expenses.length} expense${expenses.length === 1 ? "" : "s"}`}
            />
          </View>

          <View style={styles.cardsRow}>
            <MoneyCard
              colors={colors}
              label="All time net"
              amount={allTimeRevenue - allTimeExpenses}
              subtitle="Revenue − Expenses"
              emphasize
            />
          </View>

          <Text style={[styles.sectionTitle, { color: colors.text }]}>This period</Text>
          <PeriodRow colors={colors} bucket={buckets.today} />
          <PeriodRow colors={colors} bucket={buckets.last7} />
          <PeriodRow colors={colors} bucket={buckets.thisMonth} />

          <Text style={[styles.sectionTitle, { marginTop: 10, color: colors.text }]}>
            Top species (last 30 days)
          </Text>

          {topSpecies30.length === 0 ? (
            <Text style={{ color: colors.muted, marginTop: 6 }}>No sales yet.</Text>
          ) : null}
        </>
      }
      renderItem={({ item, index }) => (
        <View style={[styles.rankRow, { borderColor: colors.cardBorder }]}>
          <Text style={[styles.rankNum, { color: colors.muted }]}>{index + 1}</Text>
          <Text style={[styles.rankName, { color: colors.text }]}>{item.speciesName}</Text>
          <Text style={[styles.rankVal, { color: colors.text }]}>${item.revenue.toFixed(2)}</Text>
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
  emphasize,
}: {
  colors: any;
  label: string;
  amount: number;
  subtitle?: string;
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
        ${amount.toFixed(2)}
      </Text>
      {subtitle ? <Text style={[styles.cardSub, { color: colors.muted }]}>{subtitle}</Text> : null}
    </View>
  );
}

function PeriodRow({ bucket, colors }: { bucket: Bucket; colors: any }) {
  const net = bucket.revenue - bucket.expenses;

  return (
    <View style={[styles.periodRow, { borderColor: colors.cardBorder, backgroundColor: colors.cardBg }]}>
      <Text style={[styles.periodLabel, { color: colors.text }]}>{bucket.label}</Text>

      <View style={{ flex: 1 }}>
        <Text style={[styles.periodLine, { color: colors.text }]}>
          Revenue: <Text style={styles.bold}>${bucket.revenue.toFixed(2)}</Text>{" "}
          <Text style={[styles.muted, { color: colors.muted }]}>({bucket.countSales})</Text>
        </Text>

        <Text style={[styles.periodLine, { color: colors.text }]}>
          Expenses: <Text style={styles.bold}>${bucket.expenses.toFixed(2)}</Text>{" "}
          <Text style={[styles.muted, { color: colors.muted }]}>({bucket.countExpenses})</Text>
        </Text>

        <Text style={[styles.periodLine, { color: colors.text }]}>
          Net:{" "}
          <Text style={[styles.bold, net < 0 && styles.negative]}>
            ${net.toFixed(2)}
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
