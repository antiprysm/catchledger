import { ThemeContext } from "@/theme/ThemeProvider";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useContext, useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";

import { STORAGE_KEYS } from "@/constants/storageKeys";
import { LicenseProfile } from "@/types/license";
import { loadJSON, saveJSON } from "@/utils/storage";

export default function LicenseProfileScreen() {
  const { colors } = useContext(ThemeContext);

  const [legalName, setLegalName] = useState("");
  const [dbaName, setDbaName] = useState("");
  const [licenseNumber, setLicenseNumber] = useState("");
  const [stateCode, setStateCode] = useState("IL");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [vehiclePlate, setVehiclePlate] = useState("");
  const [homeBaseCity, setHomeBaseCity] = useState("");

  const load = useCallback(async () => {
    const p = await loadJSON<LicenseProfile | null>(STORAGE_KEYS.LICENSE_PROFILE, null);
    if (!p) return;
    setLegalName(p.legalName ?? "");
    setDbaName(p.dbaName ?? "");
    setLicenseNumber(p.licenseNumber ?? "");
    setStateCode(p.state ?? "IL");
    setPhone(p.phone ?? "");
    setEmail(p.email ?? "");
    setVehiclePlate(p.vehiclePlate ?? "");
    setHomeBaseCity(p.homeBaseCity ?? "");
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  async function onSave() {
    if (!legalName.trim()) return Alert.alert("Required", "Legal name is required.");
    if (!licenseNumber.trim()) return Alert.alert("Required", "License number is required.");
    if (!stateCode.trim()) return Alert.alert("Required", "State is required (e.g. IL).");

    const profile: LicenseProfile = {
      legalName: legalName.trim(),
      dbaName: dbaName.trim() ? dbaName.trim() : undefined,
      licenseNumber: licenseNumber.trim(),
      state: stateCode.trim().toUpperCase(),
      phone: phone.trim() ? phone.trim() : undefined,
      email: email.trim() ? email.trim() : undefined,
      vehiclePlate: vehiclePlate.trim() ? vehiclePlate.trim() : undefined,
      homeBaseCity: homeBaseCity.trim() ? homeBaseCity.trim() : undefined,
      updatedAt: new Date().toISOString(),
    };

    await saveJSON(STORAGE_KEYS.LICENSE_PROFILE, profile);
    Alert.alert("Saved", "License profile updated.");
    router.back();
  }

  const inputStyle = [
    styles.input,
    { borderColor: colors.cardBorder, backgroundColor: colors.cardBg, color: colors.text },
  ];

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.bg }}
      contentContainerStyle={styles.container}
      keyboardShouldPersistTaps="handled"
    >
      <Text style={[styles.title, { color: colors.text }]}>License Profile</Text>
      <Text style={[styles.sub, { color: colors.muted }]}>
        Used for compliance screens during inspection. Stored locally on this device.
      </Text>

      <Text style={[styles.label, { color: colors.text }]}>Legal name</Text>
      <TextInput
        value={legalName}
        onChangeText={setLegalName}
        style={inputStyle}
        placeholder="First Last"
        placeholderTextColor={colors.muted}
      />

      <Text style={[styles.label, { color: colors.text }]}>DBA / Business name (optional)</Text>
      <TextInput
        value={dbaName}
        onChangeText={setDbaName}
        style={inputStyle}
        placeholder="CatchLedger Fisheries"
        placeholderTextColor={colors.muted}
      />

      <View style={styles.row}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.label, { color: colors.text }]}>State</Text>
          <TextInput
            value={stateCode}
            onChangeText={setStateCode}
            style={inputStyle}
            placeholder="IL"
            placeholderTextColor={colors.muted}
            autoCapitalize="characters"
          />
        </View>

        <View style={{ flex: 2 }}>
          <Text style={[styles.label, { color: colors.text }]}>License #</Text>
          <TextInput
            value={licenseNumber}
            onChangeText={setLicenseNumber}
            style={inputStyle}
            placeholder="Aquatic Life Distributor #"
            placeholderTextColor={colors.muted}
          />
        </View>
      </View>

      <Text style={[styles.label, { color: colors.text }]}>Phone (optional)</Text>
      <TextInput
        value={phone}
        onChangeText={setPhone}
        style={inputStyle}
        placeholder="(555) 555-5555"
        placeholderTextColor={colors.muted}
        keyboardType="phone-pad"
      />

      <Text style={[styles.label, { color: colors.text }]}>Email (optional)</Text>
      <TextInput
        value={email}
        onChangeText={setEmail}
        style={inputStyle}
        placeholder="name@email.com"
        placeholderTextColor={colors.muted}
        autoCapitalize="none"
        keyboardType="email-address"
      />

      <Text style={[styles.label, { color: colors.text }]}>Vehicle plate (optional)</Text>
      <TextInput
        value={vehiclePlate}
        onChangeText={setVehiclePlate}
        style={inputStyle}
        placeholder="ABC1234"
        placeholderTextColor={colors.muted}
        autoCapitalize="characters"
      />

      <Text style={[styles.label, { color: colors.text }]}>Home base city (optional)</Text>
      <TextInput
        value={homeBaseCity}
        onChangeText={setHomeBaseCity}
        style={inputStyle}
        placeholder="Waukegan, IL"
        placeholderTextColor={colors.muted}
      />

      <Pressable onPress={onSave} style={styles.saveBtn}>
        <Text style={styles.saveBtnText}>Save</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, gap: 10, paddingBottom: 40 },
  title: { fontSize: 22, fontWeight: "900" },
  sub: { marginTop: -4, marginBottom: 6 },

  label: { fontWeight: "800" },

  input: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
  },

  row: { flexDirection: "row", gap: 10 },

  // keep your black button
  saveBtn: {
    marginTop: 10,
    backgroundColor: "#111",
    padding: 14,
    borderRadius: 12,
    alignItems: "center",
  },
  saveBtnText: { color: "white", fontWeight: "900" },
});
