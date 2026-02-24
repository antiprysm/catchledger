import { STORAGE_KEYS } from "@/constants/storageKeys";
import { ThemeContext } from "@/theme/ThemeProvider";
import { loadJSON, saveJSON } from "@/utils/storage";
import { Link, router, useFocusEffect } from "expo-router";
import { useCallback, useContext, useState } from "react";
import { useTranslation } from "react-i18next";
import { Alert, Platform, Pressable, StyleSheet, Text, View } from "react-native";

export default function ComplianceHome() {
  const { colors } = useContext(ThemeContext);
  const { t } = useTranslation();
  const [inspectionMode, setInspectionMode] = useState(false);

  const loadInspectionMode = useCallback(() => {
    loadJSON<boolean>(STORAGE_KEYS.INSPECTION_MODE, false).then(setInspectionMode);
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadInspectionMode();
    }, [loadInspectionMode])
  );

  const enterInspectionMode = useCallback(async () => {
    const pin = await loadJSON<string | null>(STORAGE_KEYS.INSPECTION_PIN, null);

    if (!pin) {
      await saveJSON(STORAGE_KEYS.INSPECTION_MODE, true);
      setInspectionMode(true);
      router.push("/(tabs)/compliance/week");
      return;
    }

    if (Platform.OS === "ios") {
      Alert.prompt(
        "Enter Inspection PIN",
        undefined,
        async (entered) => {
          if ((entered ?? "") === pin) {
            await saveJSON(STORAGE_KEYS.INSPECTION_MODE, true);
            setInspectionMode(true);
            router.push("/(tabs)/compliance/week");
          } else {
            Alert.alert("Incorrect PIN");
          }
        },
        "secure-text"
      );
    } else {
      Alert.alert("PIN required", "PIN entry UI for Android will be added next.");
    }
  }, []);

  const exitInspectionMode = useCallback(async () => {
    await saveJSON(STORAGE_KEYS.INSPECTION_MODE, false);
    setInspectionMode(false);
    Alert.alert("Inspection mode off");
  }, []);

  return (
    <View style={[styles.container, { backgroundColor: colors.bg }]}>
      <Text style={[styles.title, { color: colors.text }]}>{t("compliance.title")}</Text>
      <Text style={[styles.sub, { color: colors.muted }]}>
        Inspection-ready records (offline). Show harvest/sales logs quickly.
      </Text>

      <Link href="/(tabs)/compliance/profile" asChild>
        <Pressable style={styles.btn}>
          <Text style={styles.btnText}>License Profile</Text>
        </Pressable>
      </Link>


      <Link href="/(tabs)/compliance/inspection" asChild>
        <Pressable style={styles.btn}>
          <Text style={styles.btnText}>Inspection Controls</Text>
        </Pressable>
      </Link>

      {inspectionMode ? (
        <Pressable style={[styles.btn, styles.btnDanger]} onPress={exitInspectionMode}>
          <Text style={styles.btnText}>Exit Inspection Mode</Text>
        </Pressable>
      ) : (
        <Pressable style={styles.btn} onPress={enterInspectionMode}>
          <Text style={styles.btnText}>Enter Inspection Mode</Text>
        </Pressable>
      )}

      <Link href="/(tabs)/compliance/today" asChild>
        <Pressable style={styles.btn}>
          <Text style={styles.btnText}>Show Today’s Records</Text>
        </Pressable>
      </Link>

      <Link href="/(tabs)/compliance/range" asChild>
        <Pressable style={styles.btn}>
          <Text style={styles.btnText}>View Date Range</Text>
        </Pressable>
      </Link>

      <Link href="/(tabs)/compliance/week" asChild>
        <Pressable style={styles.btn}>
          <Text style={styles.btnText}>Last 7 Days</Text>
        </Pressable>
      </Link>

      <Link href="/(tabs)/compliance/week" asChild>
        <Pressable style={styles.btn}>
          <Text style={styles.btnText}>Export Inspection CSV (7 days)</Text>
        </Pressable>
      </Link>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, gap: 12 },
  title: { fontSize: 22, fontWeight: "900" },
  sub: { marginTop: -6 },

  // keep black + red buttons
  btn: {
    backgroundColor: "#111",
    padding: 14,
    borderRadius: 12,
    alignItems: "center",
    marginTop: 6,
  },
  btnDanger: { backgroundColor: "#c62828" },

  btnText: { color: "white", fontWeight: "900" },
});
