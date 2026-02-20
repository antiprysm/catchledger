import { File, Paths } from "expo-file-system";
import * as Sharing from "expo-sharing";
import { useCallback, useContext, useMemo, useState } from "react";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";

import { ThemeContext } from "@/theme/ThemeProvider";

import { STORAGE_KEYS } from "@/constants/storageKeys";
import { Expense } from "@/types/expenses";
import { Sale } from "@/types/sales";
import { loadJSON } from "@/utils/storage";

function csvEscape(value: unknown) {
  const s = value == null ? "" : String(value);
  const needsQuotes = /[",\n\r]/.test(s);
  const escaped = s.replace(/"/g, '""');
  return needsQuotes ? `"${escaped}"` : escaped;
}

function formatISODate(iso: string) {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toISOString();
}

function stampForName() {
  return new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
}

async function shareTextFile(
  filename: string,
  mimeType: string,
  content: string,
  dialogTitle: string
) {
  const file = new File(Paths.cache, filename);
  try {
    file.create();
  } catch {}
  file.write(content);

  const canShare = await Sharing.isAvailableAsync();
  if (!canShare) {
    Alert.alert("Export complete", `Saved file to: ${file.uri}`);
    return;
  }

  await Sharing.shareAsync(file.uri, {
    mimeType,
    dialogTitle,
    UTI: mimeType === "text/csv" ? "public.comma-separated-values-text" : undefined,
  });
}

/** SALES CSV: line-level */
function buildSalesCSV(sales: Sale[]) {
  const headers = [
    "sale_id",
    "occurred_at_iso",
    "payment_method",
    "payment_note",
    "sale_total",
    "line_item_id",
    "species_name",
    "unit",
    "unit_price",
    "quantity",
    "line_subtotal",
  ];

  const rows: string[] = [];
  rows.push(headers.map(csvEscape).join(","));

  for (const s of sales) {
    for (const line of s.lines) {
      const row = [
        s.id,
        formatISODate(s.occurredAt),
        s.paymentMethod,
        s.paymentNote ?? "",
        Number(s.total).toFixed(2),
        line.itemId,
        line.speciesName,
        line.unit,
        Number(line.unitPrice).toFixed(2),
        String(line.quantity),
        Number(line.subtotal).toFixed(2),
      ];
      rows.push(row.map(csvEscape).join(","));
    }
  }

  return rows.join("\n");
}

/** EXPENSES CSV: one row per expense */
function buildExpensesCSV(expenses: Expense[]) {
  const headers = ["expense_id", "occurred_at_iso", "category", "amount", "note"];

  const rows: string[] = [];
  rows.push(headers.map(csvEscape).join(","));

  for (const e of expenses) {
    const row = [
      e.id,
      formatISODate(e.occurredAt),
      e.category,
      Number(e.amount).toFixed(2),
      e.note ?? "",
    ];
    rows.push(row.map(csvEscape).join(","));
  }

  return rows.join("\n");
}

/** PROFIT SUMMARY CSV: monthly rollups */
function buildProfitSummaryCSV(sales: Sale[], expenses: Expense[]) {
  type Rollup = {
    month: string;
    revenue: number;
    expenses: number;
    net: number;
    saleCount: number;
    expenseCount: number;
  };
  const map = new Map<string, Rollup>();

  const keyFor = (iso: string) => {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "Unknown";
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    return `${y}-${m}`;
  };

  for (const s of sales) {
    const k = keyFor(s.occurredAt);
    const cur =
      map.get(k) ?? { month: k, revenue: 0, expenses: 0, net: 0, saleCount: 0, expenseCount: 0 };
    cur.revenue += Number(s.total) || 0;
    cur.saleCount += 1;
    map.set(k, cur);
  }

  for (const e of expenses) {
    const k = keyFor(e.occurredAt);
    const cur =
      map.get(k) ?? { month: k, revenue: 0, expenses: 0, net: 0, saleCount: 0, expenseCount: 0 };
    cur.expenses += Number(e.amount) || 0;
    cur.expenseCount += 1;
    map.set(k, cur);
  }

  const rollups = Array.from(map.values())
    .map((r) => ({ ...r, net: r.revenue - r.expenses }))
    .sort((a, b) => (a.month < b.month ? 1 : -1));

  const headers = ["month", "revenue", "expenses", "net", "sales_count", "expenses_count"];
  const rows: string[] = [];
  rows.push(headers.map(csvEscape).join(","));

  for (const r of rollups) {
    rows.push(
      [r.month, r.revenue.toFixed(2), r.expenses.toFixed(2), r.net.toFixed(2), String(r.saleCount), String(r.expenseCount)]
        .map(csvEscape)
        .join(",")
    );
  }

  return rows.join("\n");
}

function buildProfitByCategoryCSV(sales: Sale[], expenses: Expense[]) {
  const monthKey = (iso: string) => {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "Unknown";
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    return `${y}-${m}`;
  };

  const categories = Array.from(new Set(expenses.map((e) => e.category))).sort();

  const revenueByMonth = new Map<string, number>();
  for (const s of sales) {
    const k = monthKey(s.occurredAt);
    revenueByMonth.set(k, (revenueByMonth.get(k) ?? 0) + (Number(s.total) || 0));
  }

  const expByMonthCat = new Map<string, Map<string, number>>();
  for (const e of expenses) {
    const k = monthKey(e.occurredAt);
    const cat = e.category || "OTHER";
    if (!expByMonthCat.has(k)) expByMonthCat.set(k, new Map());
    const m = expByMonthCat.get(k)!;
    m.set(cat, (m.get(cat) ?? 0) + (Number(e.amount) || 0));
  }

  const months = Array.from(new Set([...revenueByMonth.keys(), ...expByMonthCat.keys()])).sort((a, b) => (a < b ? 1 : -1));

  const headers = ["month", "revenue", ...categories.map((c) => `exp_${c.toLowerCase()}`), "total_expenses", "net"];

  const rows: string[] = [];
  rows.push(headers.map(csvEscape).join(","));

  for (const month of months) {
    const revenue = revenueByMonth.get(month) ?? 0;
    const catMap = expByMonthCat.get(month) ?? new Map<string, number>();

    const catVals = categories.map((c) => (catMap.get(c) ?? 0));
    const totalExpenses = catVals.reduce((sum, x) => sum + x, 0);
    const net = revenue - totalExpenses;

    const row = [month, revenue.toFixed(2), ...catVals.map((v) => v.toFixed(2)), totalExpenses.toFixed(2), net.toFixed(2)];
    rows.push(row.map(csvEscape).join(","));
  }

  return rows.join("\n");
}

function buildAllTimeCategoryCSV(expenses: Expense[]) {
  const byCat = new Map<string, number>();

  for (const e of expenses) {
    const cat = e.category || "OTHER";
    byCat.set(cat, (byCat.get(cat) ?? 0) + (Number(e.amount) || 0));
  }

  const total = Array.from(byCat.values()).reduce((s, v) => s + v, 0);

  const rows: string[] = [];
  rows.push(["category", "total_amount", "percent_of_total"].map(csvEscape).join(","));

  const sorted = Array.from(byCat.entries()).sort((a, b) => b[1] - a[1]);

  for (const [cat, amt] of sorted) {
    const pct = total > 0 ? (amt / total) * 100 : 0;
    rows.push([cat, amt.toFixed(2), pct.toFixed(2)].map(csvEscape).join(","));
  }

  rows.push(["TOTAL", total.toFixed(2), "100.00"].map(csvEscape).join(","));

  return rows.join("\n");
}

function buildQuarterlySummaryCSV(sales: Sale[], expenses: Expense[]) {
  const keyFor = (iso: string) => {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "Unknown";
    const y = d.getFullYear();
    const q = Math.floor(d.getMonth() / 3) + 1;
    return `${y}-Q${q}`;
  };

  type Roll = {
    period: string;
    revenue: number;
    expenses: number;
    net: number;
    salesCount: number;
    expensesCount: number;
  };

  const map = new Map<string, Roll>();

  for (const s of sales) {
    const k = keyFor(s.occurredAt);
    const cur = map.get(k) ?? { period: k, revenue: 0, expenses: 0, net: 0, salesCount: 0, expensesCount: 0 };
    cur.revenue += Number(s.total) || 0;
    cur.salesCount += 1;
    map.set(k, cur);
  }

  for (const e of expenses) {
    const k = keyFor(e.occurredAt);
    const cur = map.get(k) ?? { period: k, revenue: 0, expenses: 0, net: 0, salesCount: 0, expensesCount: 0 };
    cur.expenses += Number(e.amount) || 0;
    cur.expensesCount += 1;
    map.set(k, cur);
  }

  const rollups = Array.from(map.values())
    .map((r) => ({ ...r, net: r.revenue - r.expenses }))
    .sort((a, b) => (a.period < b.period ? 1 : -1));

  const headers = ["quarter", "revenue", "expenses", "net", "sales_count", "expenses_count"];
  const rows: string[] = [];
  rows.push(headers.map(csvEscape).join(","));

  for (const r of rollups) {
    rows.push(
      [r.period, r.revenue.toFixed(2), r.expenses.toFixed(2), r.net.toFixed(2), String(r.salesCount), String(r.expensesCount)]
        .map(csvEscape)
        .join(",")
    );
  }

  return rows.join("\n");
}

export default function ReportsScreen() {
  const { colors } = useContext(ThemeContext);

  const [busy, setBusy] = useState<null | "sales" | "expenses" | "profit" | "bycat" | "allcat" | "quarter">(null);

  const loadAll = useCallback(async () => {
    const [sales, expenses] = await Promise.all([
      loadJSON<Sale[]>(STORAGE_KEYS.SALES, []),
      loadJSON<Expense[]>(STORAGE_KEYS.EXPENSES, []),
    ]);
    return { sales, expenses };
  }, []);

  const exportSales = useCallback(async () => {
    if (busy) return;
    setBusy("sales");
    try {
      const { sales } = await loadAll();
      if (!sales.length) {
        Alert.alert("No sales", "There are no sales to export yet.");
        return;
      }
      const csv = buildSalesCSV(sales);
      const filename = `catchledger_sales_${stampForName()}.csv`;
      await shareTextFile(filename, "text/csv", csv, "Export Sales CSV");
    } catch (e: any) {
      Alert.alert("Export failed", e?.message ?? "Unknown error");
    } finally {
      setBusy(null);
    }
  }, [busy, loadAll]);

  const exportExpenses = useCallback(async () => {
    if (busy) return;
    setBusy("expenses");
    try {
      const { expenses } = await loadAll();
      if (!expenses.length) {
        Alert.alert("No expenses", "There are no expenses to export yet.");
        return;
      }
      const csv = buildExpensesCSV(expenses);
      const filename = `catchledger_expenses_${stampForName()}.csv`;
      await shareTextFile(filename, "text/csv", csv, "Export Expenses CSV");
    } catch (e: any) {
      Alert.alert("Export failed", e?.message ?? "Unknown error");
    } finally {
      setBusy(null);
    }
  }, [busy, loadAll]);

  const exportProfitSummary = useCallback(async () => {
    if (busy) return;
    setBusy("profit");
    try {
      const { sales, expenses } = await loadAll();
      if (!sales.length && !expenses.length) {
        Alert.alert("Nothing to export", "No sales or expenses found yet.");
        return;
      }
      const csv = buildProfitSummaryCSV(sales, expenses);
      const filename = `catchledger_profit_summary_${stampForName()}.csv`;
      await shareTextFile(filename, "text/csv", csv, "Export Profit Summary CSV");
    } catch (e: any) {
      Alert.alert("Export failed", e?.message ?? "Unknown error");
    } finally {
      setBusy(null);
    }
  }, [busy, loadAll]);

  const exportProfitByCategory = useCallback(async () => {
    if (busy) return;
    setBusy("bycat");
    try {
      const { sales, expenses } = await loadAll();
      if (!sales.length && !expenses.length) {
        Alert.alert("Nothing to export", "No sales or expenses found yet.");
        return;
      }
      if (!expenses.length) {
        Alert.alert("No expenses", "Add at least one expense category to export this report.");
        return;
      }

      const csv = buildProfitByCategoryCSV(sales, expenses);
      const filename = `catchledger_profit_by_category_${stampForName()}.csv`;
      await shareTextFile(filename, "text/csv", csv, "Export Profit by Category CSV");
    } catch (e: any) {
      Alert.alert("Export failed", e?.message ?? "Unknown error");
    } finally {
      setBusy(null);
    }
  }, [busy, loadAll]);

  const exportAllTimeByCategory = useCallback(async () => {
    if (busy) return;
    setBusy("allcat");
    try {
      const { expenses } = await loadAll();
      if (!expenses.length) {
        Alert.alert("No expenses", "There are no expenses to export yet.");
        return;
      }

      const csv = buildAllTimeCategoryCSV(expenses);
      const filename = `catchledger_expenses_by_category_${stampForName()}.csv`;
      await shareTextFile(filename, "text/csv", csv, "Export Expenses by Category (All-time)");
    } catch (e: any) {
      Alert.alert("Export failed", e?.message ?? "Unknown error");
    } finally {
      setBusy(null);
    }
  }, [busy, loadAll]);

  const exportQuarterlySummary = useCallback(async () => {
    if (busy) return;
    setBusy("quarter");
    try {
      const { sales, expenses } = await loadAll();
      if (!sales.length && !expenses.length) {
        Alert.alert("Nothing to export", "No sales or expenses found yet.");
        return;
      }

      const csv = buildQuarterlySummaryCSV(sales, expenses);
      const filename = `catchledger_quarterly_summary_${stampForName()}.csv`;
      await shareTextFile(filename, "text/csv", csv, "Export Quarterly Summary CSV");
    } catch (e: any) {
      Alert.alert("Export failed", e?.message ?? "Unknown error");
    } finally {
      setBusy(null);
    }
  }, [busy, loadAll]);

  const busyLabel = useMemo(() => {
    if (busy === "sales") return "Exporting sales...";
    if (busy === "expenses") return "Exporting expenses...";
    if (busy === "profit") return "Exporting summary...";
    if (busy === "bycat") return "Exporting by category...";
    if (busy === "allcat") return "Exporting all-time categories...";
    if (busy === "quarter") return "Exporting quarterly summary...";
    return null;
  }, [busy]);

  return (
    <View style={[styles.container, { backgroundColor: colors.bg }]}>
      <Text style={[styles.title, { color: colors.text }]}>Reports</Text>
      <Text style={[styles.subtitle, { color: colors.muted }]}>
        Export records for bookkeeping, taxes, or sharing with an accountant.
      </Text>

      <Pressable onPress={exportSales} style={[styles.btn, busy && styles.btnDisabled]}>
        <Text style={styles.btnText}>Export Sales CSV</Text>
      </Pressable>

      <Pressable onPress={exportExpenses} style={[styles.btn, busy && styles.btnDisabled]}>
        <Text style={styles.btnText}>Export Expenses CSV</Text>
      </Pressable>

      <Pressable onPress={exportProfitSummary} style={[styles.btn, busy && styles.btnDisabled]}>
        <Text style={styles.btnText}>Export Profit Summary CSV</Text>
      </Pressable>

      <Pressable onPress={exportProfitByCategory} style={[styles.btn, busy && styles.btnDisabled]}>
        <Text style={styles.btnText}>Export Profit by Category CSV</Text>
      </Pressable>

      <Pressable onPress={exportAllTimeByCategory} style={[styles.btn, busy && styles.btnDisabled]}>
        <Text style={styles.btnText}>Export Expenses by Category (All-time)</Text>
      </Pressable>

      <Pressable onPress={exportQuarterlySummary} style={[styles.btn, busy && styles.btnDisabled]}>
        <Text style={styles.btnText}>Export Quarterly Summary CSV</Text>
      </Pressable>

      {busyLabel ? <Text style={[styles.busy, { color: colors.muted }]}>{busyLabel}</Text> : null}

      <Text style={[styles.note, { color: colors.muted }]}>
        • Sales export is line-item level (best for spreadsheets).{"\n"}
        • Expenses export is one row per expense.{"\n"}
        • Profit Summary groups by month (YYYY-MM).{"\n"}
        • Profit by Category breaks monthly expenses into columns by category.{"\n"}
        • All-time Categories shows totals + percent share by expense category.{"\n"}
        • Quarterly Summary groups into YYYY-Q1..Q4 (useful for estimated taxes).{"\n"}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, gap: 12 },

  title: { fontSize: 22, fontWeight: "900" },
  subtitle: { marginTop: -4 },

  // keep black
  btn: {
    backgroundColor: "#111",
    padding: 14,
    borderRadius: 12,
    alignItems: "center",
    marginTop: 6,
  },
  btnDisabled: { opacity: 0.6 },
  btnText: { color: "white", fontWeight: "900" },

  busy: { marginTop: 6 },
  note: { marginTop: 6, lineHeight: 18 },
});
