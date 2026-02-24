import { ThemeContext } from "@/theme/ThemeProvider";
import DateTimePicker from "@react-native-community/datetimepicker";
import { router, useLocalSearchParams } from "expo-router";
import { useContext, useEffect, useMemo, useState } from "react";
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

import { STORAGE_KEYS } from "@/constants/storageKeys";
import { Expense, ExpenseCategory } from "@/types/expenses";
import { loadJSON, saveJSON } from "@/utils/storage";

const CATS: ExpenseCategory[] = [
  "FUEL",
  "ICE",
  "BAIT",
  "GEAR",
  "MAINTENANCE",
  "FEES",
  "PACKAGING",
  "OTHER",
];

export default function EditExpenseScreen() {
  const { colors } = useContext(ThemeContext);
  const { t } = useTranslation();
  const { id } = useLocalSearchParams<{ id: string }>();

  const [loaded, setLoaded] = useState<Expense | null>(null);

  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState<ExpenseCategory>("FUEL");
  const [note, setNote] = useState("");

  const [occurredAt, setOccurredAt] = useState<Date>(new Date());
  const [showPicker, setShowPicker] = useState(false);

  useEffect(() => {
    async function loadExpense() {
      const list = await loadJSON<Expense[]>(STORAGE_KEYS.EXPENSES, []);
      const found = list.find((e) => e.id === id);
      if (!found) return;

      setLoaded(found);
      setAmount(String(found.amount));
      setCategory(found.category);
      setNote(found.note ?? "");
      setOccurredAt(new Date(found.occurredAt));
    }

    loadExpense();
  }, [id]);

  const parsedAmount = useMemo(() => Number(amount), [amount]);

  async function onSave() {
    if (!loaded) return;

    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      Alert.alert(t("expenses.invalidAmountTitle"), t("expenses.invalidAmountMessage"));
      return;
    }

    const list = await loadJSON<Expense[]>(STORAGE_KEYS.EXPENSES, []);

    const updated = list.map((e) =>
      e.id === id
        ? {
            ...e,
            amount: parsedAmount,
            category,
            note: note.trim() ? note.trim() : undefined,
            occurredAt: occurredAt.toISOString(),
            updatedAt: new Date().toISOString(),
          }
        : e
    );

    await saveJSON(STORAGE_KEYS.EXPENSES, updated);
    router.back();
  }

  async function onDelete() {
    if (!loaded) return;

    Alert.alert(t("expenses.deleteExpenseTitle"), t("common.cannotBeUndone"), [
            { text: t("common.cancel"), style: "cancel" },
      {
        text: t("common.delete"),
        style: "destructive",
        onPress: async () => {
          const list = await loadJSON<Expense[]>(STORAGE_KEYS.EXPENSES, []);
          const filtered = list.filter((e) => e.id !== id);
          await saveJSON(STORAGE_KEYS.EXPENSES, filtered);
          router.back();
        },
      },
    ]);
  }

  if (!loaded) {
    return (
      <View style={[styles.loading, { backgroundColor: colors.bg }]}>
        <Text style={{ color: colors.text }}>Loading...</Text>
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
          <Text style={[styles.title, { color: colors.text }]}>Edit Expense</Text>

          <Text style={[styles.label, { color: colors.text }]}>Amount</Text>
          <TextInput
            value={amount}
            onChangeText={setAmount}
            keyboardType="decimal-pad"
            placeholder="25.00"
            placeholderTextColor={colors.muted}
            style={[
              styles.input,
              { borderColor: colors.cardBorder, backgroundColor: colors.cardBg, color: colors.text },
            ]}
          />

          <Text style={[styles.label, { color: colors.text }]}>Category</Text>
          <View style={styles.rowWrap}>
            {CATS.map((c) => {
              const on = category === c;
              return (
                <Pressable
                  key={c}
                  onPress={() => setCategory(c)}
                  style={[
                    styles.chip,
                    { borderColor: colors.cardBorder, backgroundColor: colors.cardBg },
                    on && { backgroundColor: colors.primary, borderColor: colors.primary },
                  ]}
                >
                  <Text style={[{ color: colors.text }, on && styles.chipTextOn]}>
                    {c}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <Text style={[styles.label, { color: colors.text }]}>Date/time</Text>
          <Pressable
            onPress={() => setShowPicker(true)}
            style={[
              styles.pickerBtn,
              { borderColor: colors.cardBorder, backgroundColor: colors.cardBg },
            ]}
          >
            <Text style={{ color: colors.text }}>{occurredAt.toLocaleString()}</Text>
          </Pressable>

          <Text style={[styles.label, { color: colors.text }]}>Note (optional)</Text>
          <TextInput
            value={note}
            onChangeText={setNote}
            placeholder="Gas station, dock fee, etc."
            placeholderTextColor={colors.muted}
            style={[
              styles.input,
              { borderColor: colors.cardBorder, backgroundColor: colors.cardBg, color: colors.text },
            ]}
          />

          {/* keep black */}
          <Pressable onPress={onSave} style={styles.saveBtn}>
            <Text style={styles.saveBtnText}>Save Changes</Text>
          </Pressable>

          {/* keep red */}
          <Pressable onPress={onDelete} style={styles.deleteBtn}>
            <Text style={styles.deleteBtnText}>Delete</Text>
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
              <Text style={[styles.pickerTitle, { color: colors.text }]}>Expense date</Text>

              <DateTimePicker
                value={occurredAt}
                mode="datetime"
                display={Platform.OS === "ios" ? "spinner" : "default"}
                onChange={(_, date) => {
                  if (Platform.OS !== "ios") setShowPicker(false);
                  if (date) setOccurredAt(date);
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
  loading: { flex: 1, alignItems: "center", justifyContent: "center" },

  container: { padding: 16, gap: 10, paddingBottom: 40 },
  title: { fontSize: 22, fontWeight: "900" },
  label: { fontWeight: "800" },

  input: { borderWidth: 1, borderRadius: 10, padding: 12 },

  rowWrap: { flexDirection: "row", gap: 8, flexWrap: "wrap" },
  chip: {
    borderWidth: 1,
    borderRadius: 999,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  chipTextOn: { color: "white", fontWeight: "900" },

  pickerBtn: { borderWidth: 1, borderRadius: 10, padding: 12 },

  // keep black button
  saveBtn: { marginTop: 8, backgroundColor: "#111", padding: 14, borderRadius: 12, alignItems: "center" },
  saveBtnText: { color: "white", fontWeight: "900" },

  // keep red button
  deleteBtn: { marginTop: 8, backgroundColor: "#c62828", padding: 14, borderRadius: 12, alignItems: "center" },
  deleteBtnText: { color: "white", fontWeight: "900" },

  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.35)", justifyContent: "center", padding: 16 },
  pickerCard: { borderRadius: 16, padding: 12, gap: 10, borderWidth: 1 },
  pickerTitle: { fontWeight: "900", fontSize: 16 },

  // keep black
  doneBtn: { backgroundColor: "#111", padding: 12, borderRadius: 12, alignItems: "center" },
  doneBtnText: { color: "white", fontWeight: "900" },
});
