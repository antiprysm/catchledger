import { ThemeContext } from "@/theme/ThemeProvider";
import { Link, router, useFocusEffect } from "expo-router";
import { useCallback, useContext, useMemo, useState } from "react";
import { Alert, FlatList, Pressable, StyleSheet, Text, View } from "react-native";

import { STORAGE_KEYS } from "@/constants/storageKeys";
import { Sale } from "@/types/sales";
import { loadJSON, saveJSON } from "@/utils/storage";

function formatDate(iso: string) {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleString();
}

export default function SalesLogScreen() {
  const { colors } = useContext(ThemeContext);

  const [sales, setSales] = useState<Sale[]>([]);
  const [inspectionMode, setInspectionMode] = useState(false);

  const loadAll = useCallback(() => {
    let mounted = true;

    Promise.all([
      loadJSON<Sale[]>(STORAGE_KEYS.SALES, []),
      loadJSON<boolean>(STORAGE_KEYS.INSPECTION_MODE, false),
    ]).then(([data, mode]) => {
      if (!mounted) return;
      setSales(data);
      setInspectionMode(!!mode);
    });

    return () => {
      mounted = false;
    };
  }, []);

  useFocusEffect(loadAll);

  const total30 = useMemo(() => {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 29);
    const t = cutoff.getTime();
    return sales
      .filter((s) => new Date(s.occurredAt).getTime() >= t)
      .reduce((sum, s) => sum + (Number(s.total) || 0), 0);
  }, [sales]);

  return (
    <View style={[styles.container, { backgroundColor: colors.bg }]}>
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
        <Text style={[styles.title, { color: colors.text }]}>Sales</Text>

        {!inspectionMode && (
          <Link href="/(tabs)/sales/new" asChild>
            <Pressable style={styles.addBtn}>
              <Text style={styles.addBtnText}>New Sale</Text>
            </Pressable>
          </Link>
        )}
      </View>

      <Text style={[styles.sub, { color: colors.muted }]}>
        Last 30 days: ${total30.toFixed(2)}
      </Text>

      <FlatList
        data={sales}
        keyExtractor={(s) => s.id}
        ListEmptyComponent={
          <Text style={[styles.empty, { color: colors.muted }]}>
            No sales yet. Create one in “New Sale”.
          </Text>
        }
        renderItem={({ item }) => (
          <Pressable
            style={[
              styles.row,
              { borderColor: colors.cardBorder, backgroundColor: colors.cardBg },
            ]}
            onPress={() => {
              if (inspectionMode) return;
              router.push({
                pathname: "/(tabs)/sales/[id]",
                params: { id: item.id },
              });
            }}
          >
            <View style={{ flex: 1 }}>
              <Text style={[styles.bold, { color: colors.text }]}>
                ${Number(item.total || 0).toFixed(2)}
              </Text>

              <Text style={[styles.meta, { color: colors.muted }]}>
                {formatDate(item.occurredAt)}
              </Text>

              {item.buyerName ? (
                <Text style={[styles.meta2, { color: colors.muted }]}>
                  {item.buyerName}
                </Text>
              ) : null}
            </View>

            <View style={{ alignItems: "flex-end" }}>
              <Text style={[styles.meta2, { color: colors.muted }]}>
                {item.paymentMethod}
              </Text>

              {item.buyerType ? (
                <Text style={[styles.buyerType, { color: colors.muted }]}>
                  {item.buyerType}
                </Text>
              ) : null}
            </View>
          </Pressable>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, gap: 12 },

  bannerWrap: { gap: 10 },
  banner: { backgroundColor: "#111", padding: 10, borderRadius: 12 },
  bannerText: { color: "white", fontWeight: "900", textAlign: "center" },
  exitBtn: {
    backgroundColor: "#c62828",
    padding: 12,
    borderRadius: 12,
    alignItems: "center",
  },
  exitText: { color: "white", fontWeight: "900" },

  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  title: { fontSize: 22, fontWeight: "900" },
  sub: { marginTop: -6, fontWeight: "700" },

  addBtn: {
    backgroundColor: "#111",
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
  },
  addBtnText: { color: "white", fontWeight: "900" },

  empty: { fontWeight: "700" },

  row: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 10,
  },
  bold: { fontWeight: "900" },
  meta: { fontWeight: "700", marginTop: 2 },
  meta2: { fontWeight: "700", marginTop: 2 },
  buyerType: { fontWeight: "800", marginTop: 2 },
});
