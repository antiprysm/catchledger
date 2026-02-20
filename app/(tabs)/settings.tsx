import { ThemeContext } from "@/theme/ThemeProvider";
import { exportFullBackup, restoreFullBackup } from "@/utils/backup";
import { useContext } from "react";
import { Alert, Pressable, StyleSheet, Switch, Text, View } from "react-native";

export default function SettingsScreen() {
  const { colors, mode, toggle } = useContext(ThemeContext);

  async function handleRestore() {
    Alert.alert("Restore Backup?", "This will overwrite all current data.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Restore",
        style: "destructive",
        onPress: async () => {
          try {
            await restoreFullBackup();
            Alert.alert("Success", "Backup restored successfully.");
          } catch (e: any) {
            Alert.alert("Restore failed", e?.message ?? "Invalid file.");
          }
        },
      },
    ]);
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.bg }]}>
      <Text style={[styles.title, { color: colors.text }]}>Data Management</Text>

      <View style={[styles.toggleRow, { borderColor: colors.cardBorder, backgroundColor: colors.cardBg }]}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.toggleTitle, { color: colors.text }]}>Night mode</Text>
          <Text style={[styles.toggleSub, { color: colors.muted }]}>Smooth theme transition.</Text>
        </View>

        <Switch
          value={mode === "DARK"}
          onValueChange={toggle}
          trackColor={{ false: colors.cardBorder, true: colors.primary }}
          thumbColor={mode === "DARK" ? colors.cardBg : "#fff"}
        />
      </View>

      <Pressable onPress={exportFullBackup} style={styles.btn}>
        <Text style={styles.btnText}>Export Full Backup</Text>
      </Pressable>

      <Pressable onPress={handleRestore} style={styles.dangerBtn}>
        <Text style={styles.btnText}>Restore From Backup</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, gap: 12 },
  title: { fontSize: 20, fontWeight: "900" },

  toggleRow: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  toggleTitle: { fontWeight: "900" },
  toggleSub: { marginTop: 2, fontSize: 12, lineHeight: 16 },

  btn: { backgroundColor: "#111", padding: 14, borderRadius: 12, alignItems: "center" },
  dangerBtn: { backgroundColor: "#c62828", padding: 14, borderRadius: 12, alignItems: "center" },
  btnText: { color: "white", fontWeight: "900" },
});
