import { File, Paths } from "expo-file-system";
import * as Sharing from "expo-sharing";
import { useCallback, useContext, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";

import { ThemeContext } from "@/theme/ThemeProvider";

import { STORAGE_KEYS } from "@/constants/storageKeys";
import { useReviewPrompt } from "@/hooks/useReviewPrompt";
import { Expense } from "@/types/expenses";
import { Sale } from "@/types/sales";
import type { AppSettings } from "@/types/settings";
import { loadAppSettings } from "@/utils/appSettings";
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

async function shareTextFile(
  filename: string,
  mimeType: string,
  content: string,
  dialogTitle: string,
  t: (key: string, options?: Record<string, unknown>) => string
) {
  const file = new File(Paths.cache, filename);
  try {
    file.create();
  } catch {}
  file.write(content);

  const canShare = await Sharing.isAvailableAsync();
  if (!canShare) {
    Alert.alert(t("reports.exportComplete"), t("reports.savedFile", { uri: file.uri }));
    return;
  }

  await Sharing.shareAsync(file.uri, {
    mimeType,
    dialogTitle,
    UTI: mimeType === "text/csv" ? "public.comma-separated-values-text" : undefined,
  });
}

/** SALES CSV: line-level */
function buildSalesCSV(sales: Sale[], settings: AppSettings, t: (key: string, options?: Record<string, unknown>) => string) {
  const headers = [
    t("reports.csv.sales.saleId"),
    t("reports.csv.sales.occurredAtIso"),
    t("reports.csv.sales.paymentMethod"),
    t("reports.csv.sales.paymentNote"),
    t("reports.csv.sales.requireSignature"),
    t("reports.csv.sales.requirePhoto"),
    t("reports.csv.sales.invoiceNumber"),
    t("reports.csv.sales.saleTotal"),
    t("reports.csv.sales.lineItemId"),
    t("reports.csv.sales.speciesName"),
    t("reports.csv.sales.unit"),
    t("reports.csv.sales.unitPrice"),
    t("reports.csv.sales.quantity"),
    t("reports.csv.sales.lineSubtotal"),
  ];

  const rows: string[] = [];
  rows.push([t("reports.csv.common.meta"), t("reports.csv.common.businessName"), settings.companyProfile.businessName ?? ""].map(csvEscape).join(","));
  rows.push([t("reports.csv.common.meta"), t("reports.csv.common.licenseNumber"), settings.companyProfile.licenseNumber ?? ""].map(csvEscape).join(","));
  rows.push([t("reports.csv.common.meta"), t("reports.csv.common.email"), settings.companyProfile.email ?? ""].map(csvEscape).join(","));
  rows.push("");
  rows.push(headers.map(csvEscape).join(","));

  for (const s of sales) {
    for (const line of s.lines) {
      const row = [
        s.id,
        formatISODate(s.occurredAt),
        translateEnumValue(t, "reports.paymentType", s.paymentMethod),
        s.paymentNote ?? "",
        s.requireSignature ? t("common.yes") : t("common.no"),
        s.requirePhoto ? t("common.yes") : t("common.no"),
        s.invoiceNumber ?? "",
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
function buildExpensesCSV(expenses: Expense[], settings: AppSettings, t: (key: string, options?: Record<string, unknown>) => string) {
  const headers = [
    t("reports.csv.expenses.expenseId"),
    t("reports.csv.expenses.occurredAtIso"),
    t("reports.csv.expenses.category"),
    t("reports.csv.expenses.amount"),
    t("reports.csv.expenses.note"),
  ];

  const rows: string[] = [];
  rows.push([t("reports.csv.common.meta"), t("reports.csv.common.businessName"), settings.companyProfile.businessName ?? ""].map(csvEscape).join(","));
  rows.push([t("reports.csv.common.meta"), t("reports.csv.common.licenseNumber"), settings.companyProfile.licenseNumber ?? ""].map(csvEscape).join(","));
  rows.push([t("reports.csv.common.meta"), t("reports.csv.common.email"), settings.companyProfile.email ?? ""].map(csvEscape).join(","));
  rows.push("");
  rows.push(headers.map(csvEscape).join(","));

  for (const e of expenses) {
    const row = [
      e.id,
      formatISODate(e.occurredAt),
      translateEnumValue(t, "reports.inventoryCategory", e.category),
      Number(e.amount).toFixed(2),
      e.note ?? "",
    ];
    rows.push(row.map(csvEscape).join(","));
  }

  return rows.join("\n");
}

/** PROFIT SUMMARY CSV: monthly rollups */
function buildProfitSummaryCSV(sales: Sale[], expenses: Expense[], settings: AppSettings, t: (key: string, options?: Record<string, unknown>) => string) {
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
    if (Number.isNaN(d.getTime())) return t("common.unknown");
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

  const headers = [
    t("reports.csv.profit.month"),
    t("reports.csv.profit.revenue"),
    t("reports.csv.profit.expenses"),
    t("reports.csv.profit.net"),
    t("reports.csv.profit.salesCount"),
    t("reports.csv.profit.expensesCount"),
  ];
  const rows: string[] = [];
  rows.push([t("reports.csv.common.meta"), t("reports.csv.common.businessName"), settings.companyProfile.businessName ?? ""].map(csvEscape).join(","));
  rows.push([t("reports.csv.common.meta"), t("reports.csv.common.licenseNumber"), settings.companyProfile.licenseNumber ?? ""].map(csvEscape).join(","));
  rows.push([t("reports.csv.common.meta"), t("reports.csv.common.email"), settings.companyProfile.email ?? ""].map(csvEscape).join(","));
  rows.push("");
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

function buildProfitByCategoryCSV(sales: Sale[], expenses: Expense[], settings: AppSettings, t: (key: string, options?: Record<string, unknown>) => string) {
  const monthKey = (iso: string) => {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return t("common.unknown");
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

  const headers = [
    t("reports.csv.profit.month"),
    t("reports.csv.profit.revenue"),
    ...categories.map((c) => t("reports.csv.profit.expByCategory", { category: translateEnumValue(t, "reports.inventoryCategory", c) })),
    t("reports.csv.profit.totalExpenses"),
    t("reports.csv.profit.net"),
  ];

  const rows: string[] = [];
  rows.push([t("reports.csv.common.meta"), t("reports.csv.common.businessName"), settings.companyProfile.businessName ?? ""].map(csvEscape).join(","));
  rows.push([t("reports.csv.common.meta"), t("reports.csv.common.licenseNumber"), settings.companyProfile.licenseNumber ?? ""].map(csvEscape).join(","));
  rows.push([t("reports.csv.common.meta"), t("reports.csv.common.email"), settings.companyProfile.email ?? ""].map(csvEscape).join(","));
  rows.push("");
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

function buildAllTimeCategoryCSV(expenses: Expense[], t: (key: string, options?: Record<string, unknown>) => string) {
  const byCat = new Map<string, number>();

  for (const e of expenses) {
    const cat = e.category || "OTHER";
    byCat.set(cat, (byCat.get(cat) ?? 0) + (Number(e.amount) || 0));
  }

  const total = Array.from(byCat.values()).reduce((s, v) => s + v, 0);

  const rows: string[] = [];
  rows.push([
    t("reports.csv.categories.category"),
    t("reports.csv.categories.totalAmount"),
    t("reports.csv.categories.percentOfTotal"),
  ].map(csvEscape).join(","));

  const sorted = Array.from(byCat.entries()).sort((a, b) => b[1] - a[1]);

  for (const [cat, amt] of sorted) {
    const pct = total > 0 ? (amt / total) * 100 : 0;
    rows.push([translateEnumValue(t, "reports.inventoryCategory", cat), amt.toFixed(2), pct.toFixed(2)].map(csvEscape).join(","));
  }

  rows.push([t("reports.csv.categories.total"), total.toFixed(2), "100.00"].map(csvEscape).join(","));

  return rows.join("\n");
}

function buildQuarterlySummaryCSV(sales: Sale[], expenses: Expense[], settings: AppSettings, t: (key: string, options?: Record<string, unknown>) => string) {
  const keyFor = (iso: string) => {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return t("common.unknown");
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

  const headers = [
    t("reports.csv.quarterly.quarter"),
    t("reports.csv.profit.revenue"),
    t("reports.csv.profit.expenses"),
    t("reports.csv.profit.net"),
    t("reports.csv.profit.salesCount"),
    t("reports.csv.profit.expensesCount"),
  ];
  const rows: string[] = [];
  rows.push([t("reports.csv.common.meta"), t("reports.csv.common.businessName"), settings.companyProfile.businessName ?? ""].map(csvEscape).join(","));
  rows.push([t("reports.csv.common.meta"), t("reports.csv.common.licenseNumber"), settings.companyProfile.licenseNumber ?? ""].map(csvEscape).join(","));
  rows.push([t("reports.csv.common.meta"), t("reports.csv.common.email"), settings.companyProfile.email ?? ""].map(csvEscape).join(","));
  rows.push("");
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
  const { t } = useTranslation();
  const { incrementSuccess } = useReviewPrompt();

  const [busy, setBusy] = useState<null | "sales" | "expenses" | "profit" | "bycat" | "allcat" | "quarter">(null);

  const loadAll = useCallback(async () => {
    const [sales, expenses, settings] = await Promise.all([
      loadJSON<Sale[]>(STORAGE_KEYS.SALES, []),
      loadJSON<Expense[]>(STORAGE_KEYS.EXPENSES, []),
      loadAppSettings(),
    ]);
    return { sales, expenses, settings };
  }, []);

  const exportSales = useCallback(async () => {
    if (busy) return;
    setBusy("sales");
    try {
      const { sales, settings } = await loadAll();
      if (!sales.length) {
        Alert.alert(t("reports.noSalesTitle"), t("reports.noSalesMessage"));
        return;
      }
      const csv = buildSalesCSV(sales, settings, t);
      const filename = `catchledger_sales_${stampForName()}.csv`;
      await shareTextFile(filename, "text/csv", csv, t("reports.exportSalesCsv"), t);
      await incrementSuccess();
    } catch (e: any) {
      Alert.alert(t("reports.exportFailed"), e?.message ?? t("reports.unknownError"));
    } finally {
      setBusy(null);
    }
  }, [busy, loadAll, incrementSuccess]);

  const exportExpenses = useCallback(async () => {
    if (busy) return;
    setBusy("expenses");
    try {
      const { expenses, settings } = await loadAll();
      if (!expenses.length) {
        Alert.alert(t("reports.noExpensesTitle"), t("reports.noExpensesMessage"));
        return;
      }
      const csv = buildExpensesCSV(expenses, settings, t);
      const filename = `catchledger_expenses_${stampForName()}.csv`;
      await shareTextFile(filename, "text/csv", csv, t("reports.exportExpensesCsv"), t);
      await incrementSuccess();
    } catch (e: any) {
      Alert.alert(t("reports.exportFailed"), e?.message ?? t("reports.unknownError"));
    } finally {
      setBusy(null);
    }
  }, [busy, loadAll, incrementSuccess]);

  const exportProfitSummary = useCallback(async () => {
    if (busy) return;
    setBusy("profit");
    try {
      const { sales, expenses, settings } = await loadAll();
      if (!sales.length && !expenses.length) {
        Alert.alert(t("reports.nothingToExportTitle"), t("reports.nothingToExportMessage"));
        return;
      }
      const csv = buildProfitSummaryCSV(sales, expenses, settings, t);
      const filename = `catchledger_profit_summary_${stampForName()}.csv`;
      await shareTextFile(filename, "text/csv", csv, t("reports.exportProfitSummaryCsv"), t);
      await incrementSuccess();
    } catch (e: any) {
      Alert.alert(t("reports.exportFailed"), e?.message ?? t("reports.unknownError"));
    } finally {
      setBusy(null);
    }
  }, [busy, loadAll, incrementSuccess]);

  const exportProfitByCategory = useCallback(async () => {
    if (busy) return;
    setBusy("bycat");
    try {
      const { sales, expenses, settings } = await loadAll();
      if (!sales.length && !expenses.length) {
        Alert.alert(t("reports.nothingToExportTitle"), t("reports.nothingToExportMessage"));
        return;
      }
      if (!expenses.length) {
        Alert.alert(t("reports.noExpensesTitle"), t("reports.noExpensesForCategory"));
        return;
      }

      const csv = buildProfitByCategoryCSV(sales, expenses, settings, t);
      const filename = `catchledger_profit_by_category_${stampForName()}.csv`;
      await shareTextFile(filename, "text/csv", csv, t("reports.exportProfitByCategoryCsv"), t);
      await incrementSuccess();
    } catch (e: any) {
      Alert.alert(t("reports.exportFailed"), e?.message ?? t("reports.unknownError"));
    } finally {
      setBusy(null);
    }
  }, [busy, loadAll, incrementSuccess]);

  const exportAllTimeByCategory = useCallback(async () => {
    if (busy) return;
    setBusy("allcat");
    try {
      const { expenses } = await loadAll();
      if (!expenses.length) {
        Alert.alert(t("reports.noExpensesTitle"), t("reports.noExpensesMessage"));
        return;
      }

      const csv = buildAllTimeCategoryCSV(expenses, t);
      const filename = `catchledger_expenses_by_category_${stampForName()}.csv`;
      await shareTextFile(filename, "text/csv", csv, t("reports.exportExpensesByCategoryAllTimeCsv"), t);
      await incrementSuccess();
    } catch (e: any) {
      Alert.alert(t("reports.exportFailed"), e?.message ?? t("reports.unknownError"));
    } finally {
      setBusy(null);
    }
  }, [busy, loadAll, incrementSuccess]);

  const exportQuarterlySummary = useCallback(async () => {
    if (busy) return;
    setBusy("quarter");
    try {
      const { sales, expenses, settings } = await loadAll();
      if (!sales.length && !expenses.length) {
        Alert.alert(t("reports.nothingToExportTitle"), t("reports.nothingToExportMessage"));
        return;
      }

      const csv = buildQuarterlySummaryCSV(sales, expenses, settings, t);
      const filename = `catchledger_quarterly_summary_${stampForName()}.csv`;
      await shareTextFile(filename, "text/csv", csv, t("reports.exportQuarterlySummaryCsv"), t);
      await incrementSuccess();
    } catch (e: any) {
      Alert.alert(t("reports.exportFailed"), e?.message ?? t("reports.unknownError"));
    } finally {
      setBusy(null);
    }
  }, [busy, loadAll, incrementSuccess]);

  const busyLabel = useMemo(() => {
    if (busy === "sales") return t("reports.exportingSales");
    if (busy === "expenses") return t("reports.exportingExpenses");
    if (busy === "profit") return t("reports.exportingSummary");
    if (busy === "bycat") return t("reports.exportingByCategory");
    if (busy === "allcat") return t("reports.exportingAllTimeCategories");
    if (busy === "quarter") return t("reports.exportingQuarterlySummary");
    return null;
  }, [busy]);

  return (
    <View style={[styles.container, { backgroundColor: colors.bg }]}>
      <Text style={[styles.title, { color: colors.text }]}>{t("reports.title")}</Text>
      <Text style={[styles.subtitle, { color: colors.muted }]}>
        {t("reports.subtitle")}
      </Text>

      <Pressable onPress={exportSales} style={[styles.btn, busy && styles.btnDisabled]}>
        <Text style={styles.btnText}>{t("reports.exportSalesCsv")}</Text>
      </Pressable>

      <Pressable onPress={exportExpenses} style={[styles.btn, busy && styles.btnDisabled]}>
        <Text style={styles.btnText}>{t("reports.exportExpensesCsv")}</Text>
      </Pressable>

      <Pressable onPress={exportProfitSummary} style={[styles.btn, busy && styles.btnDisabled]}>
        <Text style={styles.btnText}>{t("reports.exportProfitSummaryCsv")}</Text>
      </Pressable>

      <Pressable onPress={exportProfitByCategory} style={[styles.btn, busy && styles.btnDisabled]}>
        <Text style={styles.btnText}>{t("reports.exportProfitByCategoryCsv")}</Text>
      </Pressable>

      <Pressable onPress={exportAllTimeByCategory} style={[styles.btn, busy && styles.btnDisabled]}>
        <Text style={styles.btnText}>{t("reports.exportExpensesByCategoryAllTimeCsv")}</Text>
      </Pressable>

      <Pressable onPress={exportQuarterlySummary} style={[styles.btn, busy && styles.btnDisabled]}>
        <Text style={styles.btnText}>{t("reports.exportQuarterlySummaryCsv")}</Text>
      </Pressable>

      {busyLabel ? <Text style={[styles.busy, { color: colors.muted }]}>{busyLabel}</Text> : null}

      <Text style={[styles.note, { color: colors.muted }]}>
        {t("reports.notes.sales")}{"\n"}
        {t("reports.notes.expenses")}{"\n"}
        {t("reports.notes.profitSummary")}{"\n"}
        {t("reports.notes.profitByCategory")}{"\n"}
        {t("reports.notes.allTimeCategories")}{"\n"}
        {t("reports.notes.quarterlySummary")}{"\n"}
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
