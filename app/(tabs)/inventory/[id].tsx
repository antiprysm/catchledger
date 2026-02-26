import DateTimePicker from "@react-native-community/datetimepicker";
import { router, useLocalSearchParams } from "expo-router";
import { useContext, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Alert,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { ThemeContext } from "@/theme/ThemeProvider";

import {
  DEFAULT_BEST_BEFORE_HOURS,
  QualityStatus,
  computeExpiresAt,
} from "@/constants/freshness";
import { STORAGE_KEYS } from "@/constants/storageKeys";
import { InventoryItem, UnitType } from "@/types/inventory";
import { loadJSON, saveJSON } from "@/utils/storage";

export default function EditInventoryScreen() {
  const { colors } = useContext(ThemeContext);
  const { t } = useTranslation();
  const { id } = useLocalSearchParams<{ id: string }>();

  const [item, setItem] = useState<InventoryItem | null>(null);

  const [speciesName, setSpeciesName] = useState("");
  const [unit, setUnit] = useState<UnitType>("lb");
  const [pricePerUnit, setPricePerUnit] = useState("");
  const [quantity, setQuantity] = useState("");
  const [quality, setQuality] = useState<QualityStatus>("FRESH");

  const [caughtAt, setCaughtAt] = useState<Date | null>(null);
  const [showPicker, setShowPicker] = useState(false);

  const [catchLocation, setCatchLocation] = useState("");
  const [catchMethod, setCatchMethod] = useState("");

  useEffect(() => {
    async function loadItem() {
      const items = await loadJSON<InventoryItem[]>(STORAGE_KEYS.INVENTORY, []);
      const found = items.find((i) => i.id === id);
      if (!found) return;

      setItem(found);
      setSpeciesName(found.speciesName);
      setUnit(found.unit);
      setPricePerUnit(String(found.pricePerUnit));
      setQuantity(found.quantity ? String(found.quantity) : "");
      setQuality(found.quality ?? "FRESH");
      setCaughtAt(found.caughtAt ? new Date(found.caughtAt) : null);
      setCatchLocation(found.catchLocation ?? "");
      setCatchMethod(found.catchMethod ?? "");
    }

    loadItem();
  }, [id]);

  const bestBeforeHours = DEFAULT_BEST_BEFORE_HOURS[quality];

  async function onSave() {
    if (!item) return;

    const price = Number(pricePerUnit);
    if (!speciesName.trim()) return Alert.alert(t("inventory.requiredTitle"), t("inventory.speciesRequiredMessage"));
    if (!Number.isFinite(price) || price <= 0) return Alert.alert(t("inventory.invalidPriceTitle"), t("inventory.invalidPriceMessage"));

    const qtyText = quantity.trim();
    const qty = qtyText === "" ? undefined : Number(qtyText);

    if (qtyText !== "" && (!Number.isFinite(qty) || (qty ?? 0) <= 0)) {
      Alert.alert(t("inventory.invalidQuantityTitle"), t("inventory.invalidQuantityMessage"));
      return;
    }

    if (!catchLocation.trim()) return Alert.alert(t("inventory.catchLocationRequiredTitle"), t("inventory.catchLocationRequiredMessage"));

    const items = await loadJSON<InventoryItem[]>(STORAGE_KEYS.INVENTORY, []);
    const caughtISO = caughtAt?.toISOString();

    const updatedItems = items.map((i) =>
      i.id === id
        ? {
            ...i,
            speciesName: speciesName.trim(),
            unit,
            pricePerUnit: price,
            quantity: qty,
            quality,
            caughtAt: caughtISO,
            bestBeforeHours,
            expiresAt: computeExpiresAt(caughtISO, bestBeforeHours),
            updatedAt: new Date().toISOString(),
            catchLocation: catchLocation.trim(),
            catchMethod: catchMethod.trim() ? catchMethod.trim() : undefined,
          }
        : i
    );

    await saveJSON(STORAGE_KEYS.INVENTORY, updatedItems);
    router.back();
  }

  async function onDelete() {
    Alert.alert(t("inventory.deleteItemTitle"), t("common.cannotBeUndone"), [
            { text: t("common.cancel"), style: "cancel" },
      {
        text: t("common.delete"),
        style: "destructive",
        onPress: async () => {
          const items = await loadJSON<InventoryItem[]>(STORAGE_KEYS.INVENTORY, []);
          const filtered = items.filter((i) => i.id !== id);
          await saveJSON(STORAGE_KEYS.INVENTORY, filtered);
          router.back();
        },
      },
    ]);
  }

  if (!item) {
    return (
      <View style={[styles.loading, { backgroundColor: colors.bg }]}>
        <Text style={{ color: colors.text }}>{t("common.loading")}</Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.bg }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        style={{ flex: 1, backgroundColor: colors.bg }}
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
      >
        <Pressable onPress={Keyboard.dismiss} style={{ gap: 10 }}>
          <Text style={[styles.title, { color: colors.text }]}>{t("inventory.editFish")}</Text>

          <Text style={[styles.label, { color: colors.text }]}>{t("inventory.species")}</Text>
          <TextInput
            value={speciesName}
            onChangeText={setSpeciesName}
            placeholder={t("inventory.speciesPlaceholder")}
            placeholderTextColor={colors.muted}
            style={[
              styles.input,
              {
                borderColor: colors.cardBorder,
                backgroundColor: colors.cardBg,
                color: colors.text,
              },
            ]}
          />

          <Text style={[styles.label, { color: colors.text }]}>{t("inventory.unit")}</Text>
          <View style={styles.row}>
            {(["lb", "kg", "fish", "dozen"] as UnitType[]).map((u) => {
              const on = unit === u;
              return (
                <Pressable
                  key={u}
                  onPress={() => setUnit(u)}
                  style={[
                    styles.chip,
                    { borderColor: colors.cardBorder, backgroundColor: colors.cardBg },
                    on && { backgroundColor: colors.primary, borderColor: colors.primary },
                  ]}
                >
                  <Text style={[{ color: colors.text }, on && styles.chipTextOn]}>{t(`inventory.units.${u}`)}</Text>
                </Pressable>
              );
            })}
          </View>

          <Text style={[styles.label, { color: colors.text }]}>{t("inventory.pricePerUnit")}</Text>
          <TextInput
            value={pricePerUnit}
            onChangeText={setPricePerUnit}
            keyboardType="decimal-pad"
            placeholder={t("inventory.pricePerUnitPlaceholder")}
            placeholderTextColor={colors.muted}
            style={[
              styles.input,
              {
                borderColor: colors.cardBorder,
                backgroundColor: colors.cardBg,
                color: colors.text,
              },
            ]}
          />

          <Text style={[styles.label, { color: colors.text }]}>{t("inventory.quantityOptional")}</Text>
          <TextInput
            value={quantity}
            onChangeText={setQuantity}
            keyboardType="number-pad"
            placeholder={t("inventory.quantityPlaceholder")}
            placeholderTextColor={colors.muted}
            style={[
              styles.input,
              {
                borderColor: colors.cardBorder,
                backgroundColor: colors.cardBg,
                color: colors.text,
              },
            ]}
          />

          <Text style={[styles.label, { color: colors.text }]}>{t("inventory.qualityLabel")}</Text>
          <View style={styles.row}>
            {(["LIVE", "FRESH", "FROZEN", "THAWED"] as QualityStatus[]).map((q) => {
              const on = quality === q;
              return (
                <Pressable
                  key={q}
                  onPress={() => setQuality(q)}
                  style={[
                    styles.chip,
                    { borderColor: colors.cardBorder, backgroundColor: colors.cardBg },
                    on && { backgroundColor: colors.primary, borderColor: colors.primary },
                  ]}
                >
                  <Text style={[{ color: colors.text }, on && styles.chipTextOn]}>{t(`inventory.quality.${q}`)}</Text>
                </Pressable>
              );
            })}
          </View>

          <Text style={[styles.label, { color: colors.text }]}>{t("inventory.catchLocation")}</Text>
          <TextInput
            value={catchLocation}
            onChangeText={setCatchLocation}
            placeholder={t("inventory.catchLocationPlaceholder")}
            placeholderTextColor={colors.muted}
            style={[
              styles.input,
              {
                borderColor: colors.cardBorder,
                backgroundColor: colors.cardBg,
                color: colors.text,
              },
            ]}
          />

          <Text style={[styles.label, { color: colors.text }]}>{t("inventory.catchMethodOptional")}</Text>
          <TextInput
            value={catchMethod}
            onChangeText={setCatchMethod}
            placeholder={t("inventory.catchMethodPlaceholder")}
            placeholderTextColor={colors.muted}
            style={[
              styles.input,
              {
                borderColor: colors.cardBorder,
                backgroundColor: colors.cardBg,
                color: colors.text,
              },
            ]}
          />

          <Text style={[styles.label, { color: colors.text }]}>{t("inventory.caughtTime")}</Text>
          <Pressable
            onPress={() => setShowPicker(true)}
            style={[
              styles.pickerBtn,
              { borderColor: colors.cardBorder, backgroundColor: colors.cardBg },
            ]}
          >
            <Text style={{ color: colors.text }}>
              {caughtAt ? caughtAt.toLocaleString() : t("inventory.notSet")}
            </Text>
            <Text style={{ color: colors.muted }}>
              {t("inventory.bestBeforeHours", { hours: bestBeforeHours })}
            </Text>
          </Pressable>

          {/* keep black */}
          <Pressable onPress={onSave} style={styles.saveBtn}>
            <Text style={styles.saveBtnText}>{t("inventory.save")}</Text>
          </Pressable>

          {/* keep red */}
          <Pressable onPress={onDelete} style={styles.deleteBtn}>
            <Text style={styles.deleteBtnText}>{t("common.delete")}</Text>
          </Pressable>
        </Pressable>

        <Modal
          visible={showPicker}
          transparent
          animationType="fade"
          onRequestClose={() => setShowPicker(false)}
        >
          <Pressable style={styles.backdrop} onPress={() => setShowPicker(false)}>
            <Pressable
              style={[
                styles.pickerCard,
                { backgroundColor: colors.cardBg, borderColor: colors.cardBorder },
              ]}
              onPress={() => {}}
            >
              <Text style={[styles.pickerTitle, { color: colors.text }]}>{t("inventory.caughtTime")}</Text>

              <DateTimePicker
                value={caughtAt ?? new Date()}
                mode="datetime"
                display={Platform.OS === "ios" ? "spinner" : "default"}
                onChange={(_, date) => {
                  if (Platform.OS !== "ios") setShowPicker(false);
                  if (date) setCaughtAt(date);
                }}
              />

              {Platform.OS === "ios" && (
                <Pressable style={styles.doneBtn} onPress={() => setShowPicker(false)}>
                  <Text style={styles.doneBtnText}>{t("inventory.done")}</Text>
                </Pressable>
              )}
            </Pressable>
          </Pressable>
        </Modal>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  loading: { flex: 1, alignItems: "center", justifyContent: "center" },

  container: { padding: 16, gap: 10, paddingBottom: 40 },
  title: { fontSize: 22, fontWeight: "900", marginBottom: 8 },
  label: { fontWeight: "800" },

  input: { borderWidth: 1, borderRadius: 10, padding: 12 },
  row: { flexDirection: "row", gap: 8, flexWrap: "wrap" },

  chip: { borderWidth: 1, borderRadius: 999, paddingVertical: 8, paddingHorizontal: 12 },
  chipTextOn: { color: "white", fontWeight: "900" },

  pickerBtn: { borderWidth: 1, borderRadius: 10, padding: 12, gap: 4 },

  // keep black
  saveBtn: { marginTop: 12, backgroundColor: "#111", padding: 14, borderRadius: 12, alignItems: "center" },
  saveBtnText: { color: "white", fontWeight: "900" },

  // keep red
  deleteBtn: { marginTop: 8, backgroundColor: "#c62828", padding: 14, borderRadius: 12, alignItems: "center" },
  deleteBtnText: { color: "white", fontWeight: "900" },

  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.35)", justifyContent: "flex-end" },

  pickerCard: {
    paddingTop: 12,
    paddingBottom: 18,
    paddingHorizontal: 16,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    borderWidth: 1,
  },
  pickerTitle: { fontSize: 16, fontWeight: "900", marginBottom: 8 },

  // keep black
  doneBtn: {
    marginTop: 8,
    alignSelf: "flex-end",
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 10,
    backgroundColor: "#111",
  },
  doneBtnText: { color: "white", fontWeight: "900" },
});
