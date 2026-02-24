import { STORAGE_KEYS } from "@/constants/storageKeys";
import { ThemeContext } from "@/theme/ThemeProvider";
import { loadJSON, saveJSON } from "@/utils/storage";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useContext, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";

const MIN_PIN_LENGTH = 4;

export default function InspectionControlsScreen() {
  const { colors } = useContext(ThemeContext);
  const { t } = useTranslation();

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
      Alert.alert(t("compliance.pinTooShortTitle"), t("compliance.pinTooShortMessage", { count: MIN_PIN_LENGTH }));
      return;
    }

    if (!/^\d+$/.test(next)) {
      Alert.alert(t("compliance.digitsOnlyTitle"), t("compliance.digitsOnlyMessage"));
      return;
    }

    if (next !== confirm) {
      Alert.alert(t("compliance.pinMismatchTitle"), t("compliance.pinMismatchMessage"));
      return;
    }

    await saveJSON(STORAGE_KEYS.INSPECTION_PIN, next);
    setSavedPin(next);
    setPinInput("");
    setConfirmPinInput("");
    Alert.alert(t("compliance.saved"), t("compliance.inspectionPinUpdated"));
  }, [pinInput, confirmPinInput, t]);

  const clearPin = useCallback(async () => {
    Alert.alert(t("compliance.removePinTitle"), t("compliance.removePinMessage"), [
      { text: t("common.cancel"), style: "cancel" },
      {
        text: t("compliance.remove"),
        style: "destructive",
        onPress: async () => {
          await saveJSON(STORAGE_KEYS.INSPECTION_PIN, null);
          setSavedPin(null);
          setPinInput("");
          setConfirmPinInput("");
        },
      },
    ]);
  }, [t]);

  const enterMode = useCallback(async () => {
    if (!savedPin) {
      await saveJSON(STORAGE_KEYS.INSPECTION_MODE, true);
      setInspectionMode(true);
      Alert.alert(t("compliance.inspectionModeEnabled"));
      return;
    }

    if (entryPinInput.trim() !== savedPin) {
      Alert.alert(t("compliance.incorrectPin"), t("compliance.enterConfiguredPin"));
      return;
    }

    await saveJSON(STORAGE_KEYS.INSPECTION_MODE, true);
    setInspectionMode(true);
    setEntryPinInput("");
    Alert.alert(t("compliance.inspectionModeEnabled"));
  }, [entryPinInput, savedPin, t]);

  const exitMode = useCallback(async () => {
    await saveJSON(STORAGE_KEYS.INSPECTION_MODE, false);
    setInspectionMode(false);
    setEntryPinInput("");
    Alert.alert(t("compliance.inspectionModeDisabled"));
  }, [t]);

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.bg }}
      contentContainerStyle={styles.container}
      keyboardShouldPersistTaps="handled"
    >
      <Text style={[styles.title, { color: colors.text }]}>{t("compliance.inspectionControls")}</Text>
      <Text style={[styles.sub, { color: colors.muted }]}>{t("compliance.inspectionControlsSubtitle")}</Text>

      <View style={[styles.card, { borderColor: colors.cardBorder, backgroundColor: colors.cardBg }]}> 
        <Text style={[styles.cardTitle, { color: colors.text }]}>{t("compliance.inspectionMode")}</Text>
        <Text style={[styles.status, { color: inspectionMode ? "#2e7d32" : colors.muted }]}>
          {t("compliance.status", { status: inspectionMode ? t("compliance.on") : t("compliance.off") })}
        </Text>

        {inspectionMode ? (
          <Pressable style={[styles.button, styles.dangerButton]} onPress={exitMode}>
            <Text style={styles.buttonText}>{t("compliance.exitInspectionMode")}</Text>
          </Pressable>
        ) : (
          <>
            {pinConfigured ? (
              <>
                <Text style={[styles.label, { color: colors.text }]}>{t("compliance.enterPinToEnable")}</Text>
                <TextInput
                  value={entryPinInput}
                  onChangeText={setEntryPinInput}
                  style={[styles.input, { borderColor: colors.cardBorder, color: colors.text, backgroundColor: colors.bg }]}
                  placeholder={t("compliance.pin")}
                  placeholderTextColor={colors.muted}
                  keyboardType="number-pad"
                  secureTextEntry
                  maxLength={12}
                />
              </>
            ) : null}

            <Pressable style={styles.button} onPress={enterMode}>
              <Text style={styles.buttonText}>{t("compliance.enterInspectionMode")}</Text>
            </Pressable>
          </>
        )}
      </View>

      <View style={[styles.card, { borderColor: colors.cardBorder, backgroundColor: colors.cardBg }]}> 
        <Text style={[styles.cardTitle, { color: colors.text }]}>{t("compliance.pinProtection")}</Text>
        <Text style={[styles.small, { color: colors.muted }]}> 
          {pinConfigured
            ? t("compliance.pinConfigured", { count: savedPin?.length ?? MIN_PIN_LENGTH })
            : t("compliance.noPinConfigured")}
        </Text>

        <Text style={[styles.label, { color: colors.text }]}>{t("compliance.newPin")}</Text>
        <TextInput
          value={pinInput}
          onChangeText={setPinInput}
          style={[styles.input, { borderColor: colors.cardBorder, color: colors.text, backgroundColor: colors.bg }]}
          placeholder={t("compliance.atLeastDigits", { count: MIN_PIN_LENGTH })}
          placeholderTextColor={colors.muted}
          keyboardType="number-pad"
          secureTextEntry
          maxLength={12}
        />

        <Text style={[styles.label, { color: colors.text }]}>{t("compliance.confirmPin")}</Text>
        <TextInput
          value={confirmPinInput}
          onChangeText={setConfirmPinInput}
          style={[styles.input, { borderColor: colors.cardBorder, color: colors.text, backgroundColor: colors.bg }]}
          placeholder={t("compliance.reenterPin")}
          placeholderTextColor={colors.muted}
          keyboardType="number-pad"
          secureTextEntry
          maxLength={12}
        />

        <View style={styles.row}>
          <Pressable style={styles.button} onPress={savePin}>
            <Text style={styles.buttonText}>{t("compliance.savePin")}</Text>
          </Pressable>

          {pinConfigured ? (
            <Pressable style={[styles.button, styles.secondaryButton]} onPress={clearPin}>
              <Text style={styles.buttonText}>{t("compliance.removePin")}</Text>
            </Pressable>
          ) : null}
        </View>
      </View>

      <Pressable style={[styles.button, styles.backButton]} onPress={() => router.back()}>
        <Text style={styles.buttonText}>{t("compliance.back")}</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, gap: 12, paddingBottom: 40 },
  title: { fontSize: 22, fontWeight: "900" },
  sub: { marginTop: -4 },

  card: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 12,
    gap: 8,
  },
  cardTitle: { fontSize: 16, fontWeight: "900" },
  status: { fontWeight: "800" },

  label: { fontWeight: "800", marginTop: 4 },
  small: { fontSize: 12 },

  input: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
  },

  row: { flexDirection: "row", gap: 10, marginTop: 6 },

  button: {
    flex: 1,
    backgroundColor: "#111",
    padding: 12,
    borderRadius: 12,
    alignItems: "center",
  },
  dangerButton: { backgroundColor: "#c62828" },
  secondaryButton: { backgroundColor: "#3b3b3b" },
  backButton: { marginTop: 4 },
  buttonText: { color: "white", fontWeight: "900" },
});
