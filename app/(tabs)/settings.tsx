import { ThemeContext } from "@/theme/ThemeProvider";
import { DEFAULT_APP_SETTINGS, type AppSettings } from "@/types/settings";
import { applyLanguage, type SupportedLanguage } from "@/i18n";
import { exportFullBackup, restoreFullBackup } from "@/utils/backup";

import { loadAppSettings, saveAppSettings } from "@/utils/appSettings";
import Constants from "expo-constants";
import * as DocumentPicker from "expo-document-picker";
import { Image } from "expo-image";
import * as Linking from "expo-linking";
import { useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Alert, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from "react-native";

type Choice<T extends string | number> = { label: string; value: T };

const WEIGHT_UNITS: Choice<AppSettings["weightUnit"]>[] = [
  { label: "Pounds (lb)", value: "lb" },
  { label: "Kilograms (kg)", value: "kg" },
];

const TEMP_UNITS: Choice<AppSettings["temperatureUnit"]>[] = [
  { label: "Fahrenheit", value: "fahrenheit" },
  { label: "Celsius", value: "celsius" },
];

const DATE_FORMATS: Choice<AppSettings["dateFormat"]>[] = [
  { label: "MM/DD/YYYY", value: "MM/DD/YYYY" },
  { label: "DD/MM/YYYY", value: "DD/MM/YYYY" },
];

const BUYER_TYPES: Choice<AppSettings["defaultBuyerType"]>[] = [
  { label: "Wholesale", value: "Wholesale" },
  { label: "Retail", value: "Retail" },
  { label: "Restaurant", value: "Restaurant" },
];

const PAYMENT_METHODS: Choice<AppSettings["defaultPaymentMethod"]>[] = [
  { label: "Cash", value: "Cash" },
  { label: "Card", value: "Card" },
  { label: "Bank Transfer", value: "Bank Transfer" },
  { label: "Check", value: "Check" },
];

const USER_ROLES: Choice<AppSettings["userRole"]>[] = [
  { label: "Owner", value: "Owner" },
  { label: "Employee", value: "Employee" },
  { label: "Viewer", value: "Viewer" },
];

const AUTO_LOCK_TIMERS: Choice<AppSettings["autoLockTimerMinutes"]>[] = [
  { label: "1 minute", value: 1 },
  { label: "5 minutes", value: 5 },
  { label: "10 minutes", value: 10 },
  { label: "15 minutes", value: 15 },
];

const SESSION_TIMEOUT_TIMERS: Choice<AppSettings["sessionTimeoutMinutes"]>[] = [
  { label: "5 minutes", value: 5 },
  { label: "15 minutes", value: 15 },
  { label: "30 minutes", value: 30 },
  { label: "60 minutes", value: 60 },
];

const LANGUAGES: Choice<AppSettings["language"]>[] = [
  { label: "English", value: "en" },
  { label: "Chinese (Simplified)", value: "zh" },
  { label: "Spanish", value: "es" },
  { label: "Hindi", value: "hi" },
  { label: "Arabic", value: "ar" },
];

export default function SettingsScreen() {
  const { colors, mode, toggle } = useContext(ThemeContext);
  const { t } = useTranslation();
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_APP_SETTINGS);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    loadAppSettings().then((stored) => setSettings(stored))
      .finally(() => setLoaded(true));
  }, []);

  useEffect(() => {
    if (!loaded) return;
    saveAppSettings(settings);
  }, [loaded, settings]);

  const appVersion = useMemo(() => Constants.expoConfig?.version ?? "dev", []);

  const updateSettings = useCallback((patch: Partial<AppSettings>) => {
    setSettings((prev) => ({ ...prev, ...patch }));
  }, []);

  const updateLanguage = useCallback(async (language: SupportedLanguage) => {
    updateSettings({ language });
    const { shouldShowRtlRestartPrompt } = await applyLanguage(language);
    if (shouldShowRtlRestartPrompt) {
      Alert.alert(t("settings.language"), t("settings.languageChangedRestart"));
    }
  }, [t, updateSettings]);

  const updateCompany = useCallback((patch: Partial<AppSettings["companyProfile"]>) => {
    setSettings((prev) => ({ ...prev, companyProfile: { ...prev.companyProfile, ...patch } }));
  }, []);

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

  async function pickLogo() {
    const result = await DocumentPicker.getDocumentAsync({ type: "image/*", copyToCacheDirectory: true });
    if (result.canceled || !result.assets?.length) return;
    updateCompany({ logoUri: result.assets[0].uri });
  }

  function syncNow() {
    updateSettings({ lastSyncedAt: new Date().toISOString() });
    Alert.alert("Synced", "CatchLedger data synced to local queue.");
  }

  async function clearLocalCache() {
    if (settings.userRole !== "Owner") {
      Alert.alert("Admin only", "Only Owner can clear local cache.");
      return;
    }

    Alert.alert("Clear local cache?", "This removes unsynced local cache values.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Clear",
        style: "destructive",
        onPress: async () => {
          await saveAppSettings(DEFAULT_APP_SETTINGS);
          await applyLanguage(DEFAULT_APP_SETTINGS.language);
          setSettings(DEFAULT_APP_SETTINGS);
          Alert.alert("Cache cleared", "Local app settings cache was reset.");
        },
      },
    ]);
  }

  return (
    <ScrollView style={[styles.container, { backgroundColor: colors.bg }]} contentContainerStyle={styles.content}>
      <Text style={[styles.title, { color: colors.text }]}>{t("settings.title")}</Text>
      <Card colors={colors} title={t("settings.language")}>
        <ChoiceGroup
          colors={colors}
          label={t("settings.language")}
          value={settings.language}
          options={LANGUAGES.map((opt) => ({ ...opt, label: t(`settings.languageLabels.${opt.value}`) }))}
          onChange={(value) => void updateLanguage(value as SupportedLanguage)}
        />
      </Card>

      <Card colors={colors} title="Appearance">
        <ToggleRow
          colors={colors}
          title="Night mode"
          subtitle="Smooth theme transition."
          value={mode === "DARK"}
          onValueChange={toggle}
          />
          </Card>
    
          <Card colors={colors} title="Units & Formatting">
            <ChoiceGroup colors={colors} label="Weight unit" value={settings.weightUnit} options={WEIGHT_UNITS} onChange={(value) => updateSettings({ weightUnit: value })} />
            <ChoiceGroup colors={colors} label="Temperature unit" value={settings.temperatureUnit} options={TEMP_UNITS} onChange={(value) => updateSettings({ temperatureUnit: value })} />
            <ChoiceGroup colors={colors} label="Date format" value={settings.dateFormat} options={DATE_FORMATS} onChange={(value) => updateSettings({ dateFormat: value })} />
          </Card>
    
          <Card colors={colors} title="Company Profile">
            <InputRow colors={colors} label="Business Name" value={settings.companyProfile.businessName} onChangeText={(businessName) => updateCompany({ businessName })} />
            <InputRow colors={colors} label="Business Address" value={settings.companyProfile.businessAddress} onChangeText={(businessAddress) => updateCompany({ businessAddress })} />
            <InputRow colors={colors} label="Phone" value={settings.companyProfile.phone} onChangeText={(phone) => updateCompany({ phone })} keyboardType="phone-pad" />
            <InputRow colors={colors} label="Email" value={settings.companyProfile.email} onChangeText={(email) => updateCompany({ email })} keyboardType="email-address" />
            <InputRow colors={colors} label="License number" value={settings.companyProfile.licenseNumber} onChangeText={(licenseNumber) => updateCompany({ licenseNumber })} />
            <InputRow colors={colors} label="EIN (optional)" value={settings.companyProfile.ein ?? ""} onChangeText={(ein) => updateCompany({ ein })} />
    
            <View style={styles.logoWrap}>
              <Pressable style={styles.secondaryBtn} onPress={pickLogo}>
                <Text style={styles.secondaryBtnText}>{settings.companyProfile.logoUri ? "Replace logo" : "Upload logo"}</Text>
              </Pressable>
              {settings.companyProfile.logoUri ? <Image source={settings.companyProfile.logoUri} style={styles.logoPreview} contentFit="contain" /> : null}
            </View>
          </Card>
    
          <Card colors={colors} title="Data & Sync Controls">
            <Pressable onPress={syncNow} style={styles.btn}><Text style={styles.btnText}>🔄 Sync Now</Text></Pressable>
            <ToggleRow colors={colors} title="📡 Auto-sync" subtitle="Sync automatically when connection is available." value={settings.autoSync} onValueChange={(autoSync) => updateSettings({ autoSync })} />
            <Pressable onPress={exportFullBackup} style={styles.btn}><Text style={styles.btnText}>📦 Backup data</Text></Pressable>
            <Pressable onPress={handleRestore} style={styles.secondaryBtn}><Text style={styles.secondaryBtnText}>Restore from backup</Text></Pressable>
            <Pressable onPress={clearLocalCache} style={styles.dangerBtn}><Text style={styles.btnText}>🗑 Clear local cache (admin)</Text></Pressable>
          </Card>
    
          <Card colors={colors} title="Notifications">
            <ToggleRow colors={colors} title="Delivery reminders" value={settings.deliveryReminders} onValueChange={(deliveryReminders) => updateSettings({ deliveryReminders })} />
            <ToggleRow colors={colors} title="Payment reminders" value={settings.paymentReminders} onValueChange={(paymentReminders) => updateSettings({ paymentReminders })} />
            <ToggleRow colors={colors} title="Low inventory alerts" value={settings.lowInventoryAlerts} onValueChange={(lowInventoryAlerts) => updateSettings({ lowInventoryAlerts })} />
            <ToggleRow colors={colors} title="Expiring product alert" value={settings.expiringProductAlerts} onValueChange={(expiringProductAlerts) => updateSettings({ expiringProductAlerts })} />
          </Card>
    
          <Card colors={colors} title="Default Sale Settings">
            <ChoiceGroup colors={colors} label="Default buyer type" value={settings.defaultBuyerType} options={BUYER_TYPES} onChange={(defaultBuyerType) => updateSettings({ defaultBuyerType })} />
            <ChoiceGroup colors={colors} label="Default payment method" value={settings.defaultPaymentMethod} options={PAYMENT_METHODS} onChange={(defaultPaymentMethod) => updateSettings({ defaultPaymentMethod })} />
            <ToggleRow colors={colors} title="Require signature?" value={settings.requireSignature} onValueChange={(requireSignature) => updateSettings({ requireSignature })} />
            <ToggleRow colors={colors} title="Require photo?" value={settings.requirePhoto} onValueChange={(requirePhoto) => updateSettings({ requirePhoto })} />
            <ToggleRow colors={colors} title="Auto-generate invoice?" value={settings.autoGenerateInvoice} onValueChange={(autoGenerateInvoice) => updateSettings({ autoGenerateInvoice })} />
          </Card>
    
          <Card colors={colors} title="User Role">
            <ChoiceGroup colors={colors} label="Role" value={settings.userRole} options={USER_ROLES} onChange={(userRole) => updateSettings({ userRole })} />
          </Card>
    
          <Card colors={colors} title="Security">
            <ToggleRow colors={colors} title="Passcode lock" value={settings.passcodeLockEnabled} onValueChange={(passcodeLockEnabled) => updateSettings({ passcodeLockEnabled })} />
            <ToggleRow colors={colors} title="FaceID / TouchID" value={settings.biometricsEnabled} onValueChange={(biometricsEnabled) => updateSettings({ biometricsEnabled })} />
            <ChoiceGroup colors={colors} label="Auto-lock timer" value={settings.autoLockTimerMinutes} options={AUTO_LOCK_TIMERS} onChange={(autoLockTimerMinutes) => updateSettings({ autoLockTimerMinutes })} />
            <ChoiceGroup colors={colors} label="Session timeout" value={settings.sessionTimeoutMinutes} options={SESSION_TIMEOUT_TIMERS} onChange={(sessionTimeoutMinutes) => updateSettings({ sessionTimeoutMinutes })} />
          </Card>
    
          <Card colors={colors} title="About / Legal">
            <Text style={[styles.metaText, { color: colors.text }]}>App version: {appVersion}</Text>
            <Pressable onPress={() => Linking.openURL("https://example.com/privacy")}><Text style={[styles.link, { color: colors.primary }]}>Privacy policy</Text></Pressable>
            <Pressable onPress={() => Linking.openURL("https://example.com/terms")}><Text style={[styles.link, { color: colors.primary }]}>Terms</Text></Pressable>
            <Pressable onPress={() => Linking.openURL("mailto:support@catchledger.app")}><Text style={[styles.link, { color: colors.primary }]}>Contact support</Text></Pressable>
            {!!settings.lastSyncedAt && <Text style={[styles.metaText, { color: colors.muted }]}>Last synced: {new Date(settings.lastSyncedAt).toLocaleString()}</Text>}
          </Card>
        </ScrollView>
      );
    }
    
    function Card({ colors, title, children }: { colors: any; title: string; children: ReactNode }) {
      return (
        <View style={[styles.card, { borderColor: colors.cardBorder, backgroundColor: colors.cardBg }]}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>{title}</Text>
          <View style={styles.sectionBody}>{children}</View>
        </View>
      );
    }
    
    function ToggleRow({ colors, title, subtitle, value, onValueChange }: { colors: any; title: string; subtitle?: string; value: boolean; onValueChange: (v: boolean) => void }) {
      return (
        <View style={[styles.toggleRow, { borderColor: colors.cardBorder }]}> 
          <View style={{ flex: 1 }}>
            <Text style={[styles.toggleTitle, { color: colors.text }]}>{title}</Text>
            {!!subtitle && <Text style={[styles.toggleSub, { color: colors.muted }]}>{subtitle}</Text>}
          </View>
          <Switch value={value} onValueChange={onValueChange} trackColor={{ false: colors.cardBorder, true: colors.primary }} thumbColor={value ? colors.cardBg : "#fff"} />
        </View>
      );
    }
    function InputRow({ colors, label, value, onChangeText, keyboardType }: { colors: any; label: string; value: string; onChangeText: (v: string) => void; keyboardType?: "default" | "phone-pad" | "email-address" }) {
      return (
        <View style={styles.inputWrap}>
          <Text style={[styles.inputLabel, { color: colors.text }]}>{label}</Text>
          <TextInput value={value} onChangeText={onChangeText} keyboardType={keyboardType} placeholder={label} placeholderTextColor={colors.muted} style={[styles.input, { borderColor: colors.cardBorder, color: colors.text }]} />
        </View>
      );
    }
    function ChoiceGroup<T extends string | number>({ colors, label, value, options, onChange }: { colors: any; label: string; value: T; options: Choice<T>[]; onChange: (value: T) => void }) {
      return (
        <View style={styles.choiceWrap}>
          <Text style={[styles.inputLabel, { color: colors.text }]}>{label}</Text>
          <View style={styles.choiceRow}>
            {options.map((opt) => (
              <Pressable
                key={String(opt.value)}
                onPress={() => onChange(opt.value)}
                style={[
                  styles.choiceChip,
                  { borderColor: colors.cardBorder, backgroundColor: value === opt.value ? colors.primary : "transparent" },
                ]}
              >
                <Text style={[styles.choiceText, { color: value === opt.value ? "white" : colors.text }]}>{opt.label}</Text>
              </Pressable>
            ))}
          </View>
        </View>
      );
    }
    
    const styles = StyleSheet.create({
      container: { flex: 1 },
  content: { padding: 16, gap: 14, paddingBottom: 40 },
  title: { fontSize: 22, fontWeight: "900" },
  card: { borderWidth: 1, borderRadius: 14, padding: 12 },
  sectionTitle: { fontSize: 17, fontWeight: "900", marginBottom: 10 },
  sectionBody: { gap: 10 },

  toggleRow: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  toggleTitle: { fontWeight: "800" },
  toggleSub: { marginTop: 1, fontSize: 12, lineHeight: 16 },

  inputWrap: { gap: 5 },
  inputLabel: { fontSize: 13, fontWeight: "800" },
  input: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 9, fontSize: 15 },
  choiceWrap: { gap: 6 },
  choiceRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  choiceChip: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 7 },
  choiceText: { fontWeight: "700", fontSize: 12 },

  btn: { backgroundColor: "#111", padding: 12, borderRadius: 12, alignItems: "center" },
  secondaryBtn: { backgroundColor: "#3b3b3b", padding: 12, borderRadius: 12, alignItems: "center" },
  dangerBtn: { backgroundColor: "#c62828", padding: 12, borderRadius: 12, alignItems: "center" },
  btnText: { color: "white", fontWeight: "900" },
  secondaryBtnText: { color: "white", fontWeight: "800" },

  logoWrap: { gap: 8 },
  logoPreview: { width: "100%", height: 90, borderRadius: 10, backgroundColor: "#0f0f0f20" },

  metaText: { fontSize: 13 },
  link: { textDecorationLine: "underline", fontWeight: "700" },
});
