import { Link, router, useFocusEffect } from "expo-router";
import { useCallback, useContext, useState } from "react";
import { Alert, FlatList, Pressable, StyleSheet, Text, View } from "react-native";

import { ThemeContext } from "@/theme/ThemeProvider";

import { isExpired } from "@/constants/freshness";
import { STORAGE_KEYS } from "@/constants/storageKeys";
import { InventoryItem } from "@/types/inventory";
import { loadAppSettings, type AppSettings, weightUnitLabel } from "@/utils/appSettings";
import { loadJSON, saveJSON } from "@/utils/storage";

export default function InventoryScreen() {
  const { colors } = useContext(ThemeContext);

  const [items, setItems] = useState<InventoryItem[]>([]);
  const [inspectionMode, setInspectionMode] = useState(false);
  const [weightUnit, setWeightUnit] = useState<AppSettings["weightUnit"]>("lb");

  const loadAll = useCallback(async () => {
    const [data, mode, settings] = await Promise.all([
      loadJSON<InventoryItem[]>(STORAGE_KEYS.INVENTORY, []),
      loadJSON<boolean>(STORAGE_KEYS.INSPECTION_MODE, false),
      loadAppSettings(),
    ]);
    setItems(data);
    setInspectionMode(!!mode);
    setWeightUnit(settings.weightUnit);
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadAll();
    }, [loadAll])
  );

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
        <View>
          <Text style={[styles.title, { color: colors.text }]}>Inventory</Text>
          <Text style={[styles.sub, { color: colors.muted }]}>
            Tap an item to view or edit.
          </Text>
        </View>

        <Pressable
          style={[styles.refreshBtn, { borderColor: colors.cardBorder }]}
          onPress={loadAll}
        >
          <Text style={[styles.refreshText, { color: colors.text }]}>Refresh</Text>
        </Pressable>
      </View>

      <FlatList
        data={items}
        keyExtractor={(i) => i.id}
        ListEmptyComponent={
          <Text style={{ color: colors.muted }}>
            No inventory yet. Tap “Add Fish”.
          </Text>
        }
        renderItem={({ item }) => {
          const expired = isExpired(item.expiresAt);

          return (
            <Pressable
              style={[
                styles.row,
                {
                  borderColor: colors.cardBorder,
                  backgroundColor: colors.cardBg,
                },
                expired && styles.rowExpired,
              ]}
              onPress={() => {
                if (inspectionMode) return;
                router.push({
                  pathname: "/(tabs)/inventory/[id]",
                  params: { id: item.id },
                });
              }}
            >
              <View style={{ flex: 1 }}>
                <Text style={[styles.rowTitle, { color: colors.text }]}>
                  {item.speciesName}
                </Text>

                <Text style={{ color: colors.text }}>
                  ${item.pricePerUnit}/{weightUnitLabel(item.unit, weightUnit)}{" "}
                  <Text style={{ color: colors.muted }}>
                    {item.quantity != null ? `• Qty ${item.quantity}` : ""}
                  </Text>
                </Text>
              </View>

              <View style={{ alignItems: "flex-end" }}>
                <Text style={[styles.badge, { color: colors.text }]}>
                  {item.quality}
                </Text>
                {expired ? (
                  <Text style={[styles.expired, { color: colors.muted }]}>
                    Expired
                  </Text>
                ) : null}
              </View>
            </Pressable>
          );
        }}
        contentContainerStyle={{ paddingBottom: 90 }}
      />

      {!inspectionMode && (
        <Link href="/(tabs)/inventory/add" asChild>
          <Pressable style={styles.addBtn}>
            <Text style={styles.addBtnText}>Add Fish</Text>
          </Pressable>
        </Link>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, gap: 12 },

  // header
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 10,
  },
  title: { fontSize: 22, fontWeight: "900" },
  sub: { opacity: 0.9, marginTop: 2 },

  refreshBtn: {
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  refreshText: { fontWeight: "900" },

  // list rows
  row: {
    padding: 12,
    borderWidth: 1,
    borderRadius: 12,
    marginBottom: 10,
    flexDirection: "row",
    gap: 12,
    alignItems: "center",
  },
  rowExpired: { opacity: 0.5 },
  rowTitle: { fontSize: 16, fontWeight: "900" },
  badge: { fontWeight: "900" },
  expired: { marginTop: 4, fontSize: 12 },

  // inspection banner (matches compliance screens)
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

  // keep blue Add button
  addBtn: {
    position: "absolute",
    right: 16,
    bottom: 16,
    paddingVertical: 14,
    paddingHorizontal: 18,
    borderRadius: 999,
    backgroundColor: "#007AFF",
  },
  addBtnText: { color: "white", fontWeight: "900" },
});
