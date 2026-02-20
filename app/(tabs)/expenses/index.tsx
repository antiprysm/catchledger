import { STORAGE_KEYS } from "@/constants/storageKeys";
import { ThemeContext } from "@/theme/ThemeProvider";
import { Expense } from "@/types/expenses";
import { loadJSON } from "@/utils/storage";
import { Link, useFocusEffect, useRouter } from "expo-router";
import { useCallback, useContext, useMemo, useState } from "react";
import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";

function formatDate(iso: string) {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleString();
}

export default function ExpensesIndex() {
  const { colors } = useContext(ThemeContext);

  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [inspectionMode, setInspectionMode] = useState(false);
  const router = useRouter();

  useFocusEffect(
    useCallback(() => {
      Promise.all([
        loadJSON<Expense[]>(STORAGE_KEYS.EXPENSES, []),
        loadJSON<boolean>(STORAGE_KEYS.INSPECTION_MODE, false),
      ]).then(([data, mode]) => {
        setExpenses(data);
        setInspectionMode(mode);
      });
    }, [])
  );

  const total30 = useMemo(() => {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 29);
    const t = cutoff.getTime();
    return expenses
      .filter((e) => new Date(e.occurredAt).getTime() >= t)
      .reduce((sum, e) => sum + e.amount, 0);
  }, [expenses]);

  return (
    <View style={[styles.container, { backgroundColor: colors.bg }]}>
      <View style={styles.headerRow}>
        <Text style={[styles.title, { color: colors.text }]}>Expenses</Text>

        {!inspectionMode && (
          <Link href="/(tabs)/expenses/add" asChild>
            <Pressable style={styles.addBtn}>
              <Text style={styles.addBtnText}>Add Expense</Text>
            </Pressable>
          </Link>
        )}
      </View>

      <Text style={[styles.sub, { color: colors.muted }]}>
        Last 30 days: ${total30.toFixed(2)}
      </Text>

      <FlatList
        data={expenses}
        keyExtractor={(e) => e.id}
        contentContainerStyle={{ paddingBottom: 20 }}
        ListEmptyComponent={
          <Text style={{ color: colors.muted, marginTop: 8 }}>No expenses yet.</Text>
        }
        renderItem={({ item }) => (
          <Pressable
            style={[
              styles.row,
              {
                borderColor: colors.cardBorder,
                backgroundColor: colors.cardBg,
                opacity: inspectionMode ? 0.85 : 1,
              },
            ]}
            onPress={() => {
              if (inspectionMode) return;
              router.push({
                pathname: "/(tabs)/expenses/[id]",
                params: { id: item.id },
              });
            }}
          >
            <View style={{ flex: 1 }}>
              <Text style={[styles.bold, { color: colors.text }]}>
                ${item.amount.toFixed(2)}
              </Text>
              <Text style={{ color: colors.text, opacity: 0.85 }}>
                {item.category}
              </Text>
              {item.note ? (
                <Text style={{ color: colors.muted }}>{item.note}</Text>
              ) : null}
            </View>

            <Text style={{ color: colors.muted, marginLeft: 10 }}>
              {formatDate(item.occurredAt)}
            </Text>
          </Pressable>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, gap: 10 },
  headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  title: { fontSize: 22, fontWeight: "900" },
  sub: { marginTop: -6 },

  // keep black button
  addBtn: { backgroundColor: "#111", paddingVertical: 10, paddingHorizontal: 12, borderRadius: 10 },
  addBtnText: { color: "white", fontWeight: "900" },

  row: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
    gap: 6,
    flexDirection: "row",
    justifyContent: "space-between",
  },
  bold: { fontWeight: "900" },
});
