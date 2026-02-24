import { ThemeContext } from "@/theme/ThemeProvider";
import DateTimePicker from "@react-native-community/datetimepicker";
import { router } from "expo-router";
import { useContext, useState } from "react";
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

function uid() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

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

export default function AddExpenseScreen() {
  const { colors } = useContext(ThemeContext);
  const { t } = useTranslation();

  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState<ExpenseCategory>("FUEL");
  const [note, setNote] = useState("");

  const [occurredAt, setOccurredAt] = useState<Date>(new Date());
  const [showPicker, setShowPicker] = useState(false);

  async function onSave() {
    const amt = Number(amount);
    if (!Number.isFinite(amt) || amt <= 0) {
      Alert.alert(t("expenses.invalidAmountTitle"), t("expenses.invalidAmountMessage"));
      return;
    }

    const expense: Expense = {
      id: uid(),
      occurredAt: occurredAt.toISOString(),
      category,
      amount: amt,
      note: note.trim() ? note.trim() : undefined,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const existing = await loadJSON<Expense[]>(STORAGE_KEYS.EXPENSES, []);
    await saveJSON(STORAGE_KEYS.EXPENSES, [expense, ...existing]);

    router.back();
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
          <Text style={[styles.title, { color: colors.text }]}>{t("expenses.addExpense")}</Text>

          <Text style={[styles.label, { color: colors.text }]}>{t("expenses.amount")}</Text>
          <TextInput
            value={amount}
            onChangeText={setAmount}
            keyboardType="decimal-pad"
            placeholder={t("expenses.amountPlaceholder")}
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

          <Text style={[styles.label, { color: colors.text }]}>{t("expenses.category")}</Text>
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
                  <Text style={[{ color: colors.text }, on && styles.chipTextOn]}>{t(`expenses.categories.${c}`)}</Text>
                </Pressable>
              );
            })}
          </View>

          <Text style={[styles.label, { color: colors.text }]}>{t("expenses.dateTime")}</Text>
          <Pressable
            onPress={() => setShowPicker(true)}
            style={[
              styles.pickerBtn,
              { borderColor: colors.cardBorder, backgroundColor: colors.cardBg },
            ]}
          >
            <Text style={{ color: colors.text }}>{occurredAt.toLocaleString()}</Text>
          </Pressable>

          <Text style={[styles.label, { color: colors.text }]}>{t("expenses.noteOptional")}</Text>
          <TextInput
            value={note}
            onChangeText={setNote}
            placeholder={t("expenses.notePlaceholder")}
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

          {/* keep black */}
          <Pressable onPress={onSave} style={styles.saveBtn}>
            <Text style={styles.saveBtnText}>{t("expenses.saveExpense")}</Text>
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
              <Text style={[styles.pickerTitle, { color: colors.text }]}>{t("expenses.expenseDate")}</Text>

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
                  <Text style={styles.doneBtnText}>{t("expenses.done")}</Text>
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
  title: { fontSize: 22, fontWeight: "900" },
  label: { fontWeight: "800" },

  input: { borderWidth: 1, borderRadius: 10, padding: 12 },

  rowWrap: { flexDirection: "row", gap: 8, flexWrap: "wrap" },
  chip: { borderWidth: 1, borderRadius: 999, paddingVertical: 8, paddingHorizontal: 12 },
  chipTextOn: { color: "white", fontWeight: "900" },

  pickerBtn: { borderWidth: 1, borderRadius: 10, padding: 12 },

  // keep black button
  saveBtn: { marginTop: 8, backgroundColor: "#111", padding: 14, borderRadius: 12, alignItems: "center" },
  saveBtnText: { color: "white", fontWeight: "900" },

  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.35)", justifyContent: "center", padding: 16 },
  pickerCard: { borderRadius: 16, padding: 12, gap: 10, borderWidth: 1 },
  pickerTitle: { fontWeight: "900", fontSize: 16 },

  // keep black
  doneBtn: { backgroundColor: "#111", padding: 12, borderRadius: 12, alignItems: "center" },
  doneBtnText: { color: "white", fontWeight: "900" },
});
