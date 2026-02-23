import { STORAGE_KEYS } from "@/constants/storageKeys";
import { ThemeContext } from "@/theme/ThemeProvider";
import { loadJSON, saveJSON } from "@/utils/storage";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useContext, useMemo, useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";

const MIN_PIN_LENGTH = 4;

export default function InspectionControlsScreen() {
  const { colors } = useContext(ThemeContext);

  const [inspectionMode, setInspectionMode] = useState(false);
  const [savedPin, setSavedPin] = useState<string | null>(null);
  const [pinInput, setPinInput] = useState("");
  const [confirmPinInput, setConfirmPinInput] = useState("");
  const [entryPinInput, setEntryPinInput] = useState("");

  const loadState = useCallback(async () => {
    const [mode, pin] = await Promise.all([
      loadJSON<boolean>(STORAGE_KEYS.INSPECTION_MODE, false),
      loadJSON<string | null>(STORAGE_KEYS.INSPECTION_PIN, null),
    ]);

    setInspectionMode(mode);
    setSavedPin(pin);
    setPinInput("");
    setConfirmPinInput("");
    setEntryPinInput("");
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadState();
    }, [loadState])
  );

  const pinConfigured = useMemo(() => Boolean(savedPin), [savedPin]);

  const savePin = useCallback(async () => {
    const next = pinInput.trim();
    const confirm = confirmPinInput.trim();

    if (next.length < MIN_PIN_LENGTH) {
      Alert.alert("PIN too short", `Use at least ${MIN_PIN_LENGTH} digits.`);
      return;
    }

    if (!/^\d+$/.test(next)) {
      Alert.alert("Digits only", "Inspection PIN must contain only numbers.");
      return;
    }

    if (next !== confirm) {
      Alert.alert("PIN mismatch", "PIN and confirmation do not match.");
      return;
    }

    await saveJSON(STORAGE_KEYS.INSPECTION_PIN, next);
    setSavedPin(next);
    setPinInput("");
    setConfirmPinInput("");
    Alert.alert("Saved", "Inspection PIN updated.");
  }, [pinInput, confirmPinInput]);

  const clearPin = useCallback(async () => {
    Alert.alert("Remove PIN?", "Inspection Mode will no longer require a PIN.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Remove",
        style: "destructive",
        onPress: async () => {
          await saveJSON(STORAGE_KEYS.INSPECTION_PIN, null);
          setSavedPin(null);
          setPinInput("");
          setConfirmPinInput("");
        },
      },
    ]);
  }, []);

  const enterMode = useCallback(async () => {
    if (!savedPin) {
      await saveJSON(STORAGE_KEYS.INSPECTION_MODE, true);
      setInspectionMode(true);
      Alert.alert("Inspection Mode enabled");
      return;
    }

    if (entryPinInput.trim() !== savedPin) {
      Alert.alert("Incorrect PIN", "Enter the configured inspection PIN.");
      return;
    }

    await saveJSON(STORAGE_KEYS.INSPECTION_MODE, true);
    setInspectionMode(true);
    setEntryPinInput("");
    Alert.alert("Inspection Mode enabled");
  }, [entryPinInput, savedPin]);

  const exitMode = useCallback(async () => {
    await saveJSON(STORAGE_KEYS.INSPECTION_MODE, false);
    setInspectionMode(false);
    setEntryPinInput("");
    Alert.alert("Inspection Mode disabled");
  }, []);

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.bg }}
      contentContainerStyle={styles.container}
      keyboardShouldPersistTaps="handled"
    >
      <Text style={[styles.title, { color: colors.text }]}>Inspection Controls</Text>
      <Text style={[styles.sub, { color: colors.muted }]}>Manage PIN protection and switch inspection mode on/off.</Text>

      <View style={[styles.card, { borderColor: colors.cardBorder, backgroundColor: colors.cardBg }]}>
        <Text style={[styles.cardTitle, { color: colors.text }]}>Inspection Mode</Text>
        <Text style={[styles.status, { color: inspectionMode ? "#2e7d32" : colors.muted }]}>Status: {inspectionMode ? "ON" : "OFF"}</Text>

        {inspectionMode ? (
          <Pressable style={[styles.button, styles.dangerButton]} onPress={exitMode}>
            <Text style={styles.buttonText}>Exit Inspection Mode</Text>
          </Pressable>
        ) : (
          <>
            {pinConfigured ? (
              <>
                <Text style={[styles.label, { color: colors.text }]}>Enter PIN to enable</Text>
                <TextInput
                  value={entryPinInput}
                  onChangeText={setEntryPinInput}
                  style={[styles.input, { borderColor: colors.cardBorder, color: colors.text, backgroundColor: colors.bg }]}
                  placeholder="PIN"
                  placeholderTextColor={colors.muted}
                  keyboardType="number-pad"
                  secureTextEntry
                  maxLength={12}
                />
              </>
            ) : null}

            <Pressable style={styles.button} onPress={enterMode}>
              <Text style={styles.buttonText}>Enter Inspection Mode</Text>
            </Pressable>
          </>
        )}
      </View>

      <View style={[styles.card, { borderColor: colors.cardBorder, backgroundColor: colors.cardBg }]}>
        <Text style={[styles.cardTitle, { color: colors.text }]}>PIN Protection</Text>
        <Text style={[styles.small, { color: colors.muted }]}>
          {pinConfigured ? `PIN is configured (${savedPin?.length ?? MIN_PIN_LENGTH} digits).` : "No PIN configured."}
        </Text>

        <Text style={[styles.label, { color: colors.text }]}>New PIN</Text>
        <TextInput
          value={pinInput}
          onChangeText={setPinInput}
          style={[styles.input, { borderColor: colors.cardBorder, color: colors.text, backgroundColor: colors.bg }]}
          placeholder="At least 4 digits"
          placeholderTextColor={colors.muted}
          keyboardType="number-pad"
          secureTextEntry
          maxLength={12}
        />

        <Text style={[styles.label, { color: colors.text }]}>Confirm PIN</Text>
        <TextInput
          value={confirmPinInput}
          onChangeText={setConfirmPinInput}
          style={[styles.input, { borderColor: colors.cardBorder, color: colors.text, backgroundColor: colors.bg }]}
          placeholder="Re-enter PIN"
          placeholderTextColor={colors.muted}
          keyboardType="number-pad"
          secureTextEntry
          maxLength={12}
        />

        <Pressable style={styles.button} onPress={savePin}>
          <Text style={styles.buttonText}>{pinConfigured ? "Update PIN" : "Save PIN"}</Text>
        </Pressable>

        {pinConfigured ? (
          <Pressable style={[styles.button, styles.dangerButton]} onPress={clearPin}>
            <Text style={styles.buttonText}>Remove PIN</Text>
          </Pressable>
        ) : null}
      </View>

      <View style={[styles.card, { borderColor: colors.cardBorder, backgroundColor: colors.cardBg }]}>
        <Text style={[styles.cardTitle, { color: colors.text }]}>Inspection Views</Text>
        <Text style={[styles.small, { color: colors.muted }]}>Open records optimized for inspections.</Text>

        <Pressable style={styles.button} onPress={() => router.push("/(tabs)/compliance/today")}>
          <Text style={styles.buttonText}>Open Today</Text>
        </Pressable>

        <Pressable style={styles.button} onPress={() => router.push("/(tabs)/compliance/week")}>
          <Text style={styles.buttonText}>Open Last 7 Days</Text>
        </Pressable>

        <Pressable style={styles.button} onPress={() => router.push("/(tabs)/compliance/range")}>
          <Text style={styles.buttonText}>Open Date Range</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, gap: 12, paddingBottom: 40 },
  title: { fontSize: 22, fontWeight: "900" },
  sub: { marginTop: -6 },

  card: { borderWidth: 1, borderRadius: 14, padding: 12, gap: 8 },
  cardTitle: { fontSize: 16, fontWeight: "900" },
  status: { fontWeight: "800" },
  label: { marginTop: 2, fontWeight: "800" },
  small: { fontSize: 13 },

  input: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
  },

  button: {
    marginTop: 4,
    backgroundColor: "#111",
    padding: 13,
    borderRadius: 12,
    alignItems: "center",
  },
  dangerButton: { backgroundColor: "#c62828" },
  buttonText: { color: "white", fontWeight: "900" },
});
