import DateTimePicker from "@react-native-community/datetimepicker";
import { router } from "expo-router";
import { useContext, useEffect, useState } from "react";
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
import { generateBatchId } from "@/utils/batchId";
import { applyDateFormat, loadAppSettings } from "@/utils/appSettings";
import { loadJSON, saveJSON } from "@/utils/storage";

function uid() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

export default function AddInventoryScreen() {
  const { colors } = useContext(ThemeContext);

  const [speciesName, setSpeciesName] = useState("");
  const [unit, setUnit] = useState<UnitType>("lb");
  const [pricePerUnit, setPricePerUnit] = useState("");
  const [quantity, setQuantity] = useState("");
  const [quality, setQuality] = useState<QualityStatus>("FRESH");
  const [catchLocation, setCatchLocation] = useState("");
  const [catchMethod, setCatchMethod] = useState("");
  const [batchId, setBatchId] = useState("");

  const [caughtAt, setCaughtAt] = useState<Date | null>(new Date());
  const [showPicker, setShowPicker] = useState(false);
  const [dateFormat, setDateFormat] = useState<"MM/DD/YYYY" | "DD/MM/YYYY">("MM/DD/YYYY");

  useEffect(() => {
    loadAppSettings().then((s) => {
      setDateFormat(s.dateFormat);
      if (s.weightUnit === "kg") setUnit("kg");
    });
  }, []);

  const bestBeforeHours = DEFAULT_BEST_BEFORE_HOURS[quality];

  useEffect(() => {
    // only auto-fill if user hasn't set it yet
    if (!batchId && speciesName.trim().length >= 2) {
      setBatchId(generateBatchId(speciesName, caughtAt ?? new Date()));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [speciesName]);

  async function onSave() {
    const price = Number(pricePerUnit);

    if (!speciesName.trim()) {
      Alert.alert("Required", "Species name is required.");
      return;
    }
    if (!Number.isFinite(price) || price <= 0) {
      Alert.alert("Invalid price", "Enter a valid price.");
      return;
    }
    if (!batchId.trim()) {
      Alert.alert("Required", "Batch ID required.");
      return;
    }

    const qtyText = quantity.trim();
    const qty = qtyText === "" ? undefined : Number(qtyText);

    if (qtyText !== "" && (!Number.isFinite(qty) || qty <= 0)) {
      Alert.alert("Invalid quantity", "Quantity must be greater than 0 (or leave it blank).");
      return;
    }

    if (!catchLocation.trim()) {
      Alert.alert("Catch location required", "Enter the water body / area for compliance records.");
      return;
    }

    const nowISO = new Date().toISOString();
    const caughtISO = caughtAt ? caughtAt.toISOString() : undefined;

    const item: InventoryItem = {
      id: uid(),
      speciesName: speciesName.trim(),
      unit,
      pricePerUnit: price,
      quantity: qty,
      quality,
      caughtAt: caughtISO,
      bestBeforeHours,
      expiresAt: computeExpiresAt(caughtISO, bestBeforeHours),
      createdAt: nowISO,
      updatedAt: nowISO,
      catchLocation: catchLocation.trim(),
      catchMethod: catchMethod.trim() ? catchMethod.trim() : undefined,
      batchId: batchId.trim(),
    };

    // Clear fields (optional: you already do this)
    setCatchLocation("");
    setCatchMethod("");

    // Ensure existing items have batchId
    const items = await loadJSON<InventoryItem[]>(STORAGE_KEYS.INVENTORY, []);
    const fixed = items.map((i) => ({
      ...i,
      batchId:
        i.batchId ||
        generateBatchId(
          i.speciesName,
          i.caughtAt ? new Date(i.caughtAt) : new Date()
        ),
    }));
    await saveJSON(STORAGE_KEYS.INVENTORY, fixed);

    // Add new item
    const existing = await loadJSON<InventoryItem[]>(STORAGE_KEYS.INVENTORY, []);
    await saveJSON(STORAGE_KEYS.INVENTORY, [item, ...existing]);

    router.back();
  }

  const inputStyle = [
    styles.input,
    { borderColor: colors.cardBorder, backgroundColor: colors.cardBg, color: colors.text },
  ] as const;

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
        {/* Tap-to-dismiss wrapper that DOES NOT include the picker */}
        <Pressable onPress={Keyboard.dismiss} style={{ gap: 10 }}>
          <Text style={[styles.title, { color: colors.text }]}>Add Fish</Text>

          <Text style={[styles.label, { color: colors.text }]}>Species</Text>
          <TextInput
            value={speciesName}
            onChangeText={setSpeciesName}
            style={inputStyle}
            placeholder="Walleye"
            placeholderTextColor={colors.muted}
          />

          <Text style={[styles.label, { color: colors.text }]}>Batch ID</Text>
          <TextInput
            value={batchId}
            onChangeText={setBatchId}
            style={inputStyle}
            placeholder="20260215-WALLEYE-A1F3"
            placeholderTextColor={colors.muted}
            autoCapitalize="characters"
          />
          <Text style={{ opacity: 0.75, color: colors.muted, fontSize: 12, marginTop: -6 }}>
            Used for inspection traceability (harvest → sale).
          </Text>

          <Text style={[styles.label, { color: colors.text }]}>Unit</Text>
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
                  <Text style={[{ color: colors.text }, on && styles.chipTextOn]}>{u}</Text>
                </Pressable>
              );
            })}
          </View>

          <Text style={[styles.label, { color: colors.text }]}>Price per unit</Text>
          <TextInput
            value={pricePerUnit}
            onChangeText={setPricePerUnit}
            style={inputStyle}
            placeholder="12.00"
            placeholderTextColor={colors.muted}
            keyboardType="decimal-pad"
          />

          <Text style={[styles.label, { color: colors.text }]}>Quantity (optional)</Text>
          <TextInput
            value={quantity}
            onChangeText={setQuantity}
            style={inputStyle}
            placeholder="10"
            placeholderTextColor={colors.muted}
            keyboardType="number-pad"
          />

          <Text style={[styles.label, { color: colors.text }]}>Quality</Text>
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
                  <Text style={[{ color: colors.text }, on && styles.chipTextOn]}>{q}</Text>
                </Pressable>
              );
            })}
          </View>

          <Text style={[styles.label, { color: colors.text }]}>Catch location (water body)</Text>
          <TextInput
            value={catchLocation}
            onChangeText={setCatchLocation}
            style={inputStyle}
            placeholder="Lake Michigan — Waukegan Harbor"
            placeholderTextColor={colors.muted}
          />

          <Text style={[styles.label, { color: colors.text }]}>Catch method (optional)</Text>
          <TextInput
            value={catchMethod}
            onChangeText={setCatchMethod}
            style={inputStyle}
            placeholder="Rod & reel / Net / Trap"
            placeholderTextColor={colors.muted}
          />

          <Text style={[styles.label, { color: colors.text }]}>Caught time</Text>
          <Pressable
            onPress={() => setShowPicker(true)}
            style={[
              styles.pickerBtn,
              { borderColor: colors.cardBorder, backgroundColor: colors.cardBg },
            ]}
          >
            <Text style={{ color: colors.text }}>
              {caughtAt ? `${applyDateFormat(caughtAt, dateFormat)} ${caughtAt.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}` : "Not set"}
            </Text>
            <Text style={{ color: colors.muted }}>Best before: {bestBeforeHours}h</Text>
          </Pressable>

          {/* keep black */}
          <Pressable onPress={onSave} style={styles.saveBtn}>
            <Text style={styles.saveBtnText}>Save</Text>
          </Pressable>
        </Pressable>

        {/* Picker OUTSIDE the dismiss wrapper so wheel doesn't get canceled */}
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
              <Text style={[styles.pickerTitle, { color: colors.text }]}>Caught time</Text>

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
                  <Text style={styles.doneBtnText}>Done</Text>
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
  container: { padding: 16, gap: 10, paddingBottom: 40 },
  title: { fontSize: 22, fontWeight: "900", marginBottom: 8 },
  label: { fontWeight: "800" },

  input: { borderWidth: 1, borderRadius: 10, padding: 12 },

  row: { flexDirection: "row", gap: 8, flexWrap: "wrap" },
  chip: { borderWidth: 1, borderRadius: 999, paddingVertical: 8, paddingHorizontal: 12 },
  chipTextOn: { color: "white", fontWeight: "900" },

  pickerBtn: { borderWidth: 1, borderRadius: 10, padding: 12, gap: 4 },

  // keep black
  saveBtn: {
    marginTop: 12,
    backgroundColor: "#111",
    padding: 14,
    borderRadius: 12,
    alignItems: "center",
  },
  saveBtnText: { color: "white", fontWeight: "900" },

  // Modal
  doneBtn: {
    marginTop: 8,
    alignSelf: "flex-end",
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 10,
    backgroundColor: "#111",
  },
  doneBtnText: { color: "white", fontWeight: "900" },

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
});
