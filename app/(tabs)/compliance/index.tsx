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
        t("compliance.enterInspectionPin"),
        undefined,
        async (entered) => {
          if ((entered ?? "") === pin) {
            await saveJSON(STORAGE_KEYS.INSPECTION_MODE, true);
            setInspectionMode(true);
            router.push("/(tabs)/compliance/week");
          } else {
            Alert.alert(t("compliance.incorrectPin"));
          }
        },
        "secure-text"
      );
    } else {
      Alert.alert(t("compliance.pinRequired"), t("compliance.pinRequiredAndroid"));
    }
  }, [t]);

  const exitInspectionMode = useCallback(async () => {
    await saveJSON(STORAGE_KEYS.INSPECTION_MODE, false);
    setInspectionMode(false);
    Alert.alert(t("compliance.inspectionOff"));
  }, [t]);

  return (
    <View style={[styles.container, { backgroundColor: colors.bg }]}> 
      <Text style={[styles.title, { color: colors.text }]}>{t("compliance.title")}</Text>
      <Text style={[styles.sub, { color: colors.muted }]}>{t("compliance.homeSubtitle")}</Text>

      <Link href="/(tabs)/compliance/profile" asChild>
        <Pressable style={styles.btn}>
          <Text style={styles.btnText}>{t("compliance.licenseProfile")}</Text>
        </Pressable>
      </Link>

      <Link href="/(tabs)/compliance/inspection" asChild>
        <Pressable style={styles.btn}>
          <Text style={styles.btnText}>{t("compliance.inspectionControls")}</Text>
        </Pressable>
      </Link>

      {inspectionMode ? (
        <Pressable style={[styles.btn, styles.btnDanger]} onPress={exitInspectionMode}>
          <Text style={styles.btnText}>{t("compliance.exitInspectionMode")}</Text>
        </Pressable>
      ) : (
        <Pressable style={styles.btn} onPress={enterInspectionMode}>
          <Text style={styles.btnText}>{t("compliance.enterInspectionMode")}</Text>
        </Pressable>
      )}

      <Link href="/(tabs)/compliance/today" asChild>
        <Pressable style={styles.btn}>
          <Text style={styles.btnText}>{t("compliance.showTodaysRecords")}</Text>
        </Pressable>
      </Link>

      <Link href="/(tabs)/compliance/range" asChild>
        <Pressable style={styles.btn}>
          <Text style={styles.btnText}>{t("compliance.viewDateRange")}</Text>
        </Pressable>
      </Link>

      <Link href="/(tabs)/compliance/week" asChild>
        <Pressable style={styles.btn}>
          <Text style={styles.btnText}>{t("compliance.last7Days")}</Text>
        </Pressable>
      </Link>

      <Link href="/(tabs)/compliance/week" asChild>
        <Pressable style={styles.btn}>
          <Text style={styles.btnText}>{t("compliance.exportInspectionCsv7Days")}</Text>
        </Pressable>
      </Link>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, gap: 12 },
  title: { fontSize: 22, fontWeight: "900" },
  sub: { marginTop: -6 },

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
