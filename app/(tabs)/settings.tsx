import i18n, { applyLanguage, type SupportedLanguage } from "@/i18n";
import { ThemeContext } from "@/theme/ThemeProvider";
import { DEFAULT_APP_SETTINGS, type AppSettings } from "@/types/settings";
import { exportFullBackup, restoreFullBackup } from "@/utils/backup";
import { ensureBiometricToken, getPasscode, setPasscode as persistPasscode } from "@/utils/security";

import { loadAppSettings, saveAppSettings } from "@/utils/appSettings";
import Constants from "expo-constants";
import * as DocumentPicker from "expo-document-picker";
import { Image } from "expo-image";
import * as Linking from "expo-linking";
import { useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Alert, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from "react-native";

type Choice<T extends string | number> = { label: string; value: T };

const DATE_FORMATS: Choice<AppSettings["dateFormat"]>[] = [
  { label: "MM/DD/YYYY", value: "MM/DD/YYYY" },
  { label: "DD/MM/YYYY", value: "DD/MM/YYYY" },
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
  const [hasSavedPasscode, setHasSavedPasscode] = useState(false);
  const [editingPasscode, setEditingPasscode] = useState(false);
  const [newPasscode, setNewPasscode] = useState("");
  const [confirmPasscode, setConfirmPasscode] = useState("");

  const sanitizePasscode = useCallback((value: string) => value.replace(/\D/g, ""), []);

  useEffect(() => {
    Promise.all([loadAppSettings(), getPasscode()])
      .then(([stored, storedPasscode]) => {
        setSettings(stored);
        setHasSavedPasscode(Boolean(storedPasscode));
      });
  }, []);

  const appVersion = useMemo(() => Constants.expoConfig?.version ?? "dev", []);

  const weightUnits = useMemo<Choice<AppSettings["weightUnit"]>[]>(() => [
    { label: t("settings.values.pounds"), value: "lb" },
    { label: t("settings.values.kilograms"), value: "kg" },
  ], [t]);
  const tempUnits = useMemo<Choice<AppSettings["temperatureUnit"]>[]>(() => [
    { label: t("settings.values.fahrenheit"), value: "fahrenheit" },
    { label: t("settings.values.celsius"), value: "celsius" },
  ], [t]);
  const buyerTypes = useMemo<Choice<AppSettings["defaultBuyerType"]>[]>(() => [
    { label: t("settings.values.wholesale"), value: "Wholesale" },
    { label: t("settings.values.retail"), value: "Retail" },
    { label: t("settings.values.restaurant"), value: "Restaurant" },
  ], [t]);
  const paymentMethods = useMemo<Choice<AppSettings["defaultPaymentMethod"]>[]>(() => [
    { label: t("settings.values.cash"), value: "Cash" },
    { label: t("settings.values.card"), value: "Card" },
    { label: t("settings.values.bankTransfer"), value: "Bank Transfer" },
    { label: t("settings.values.check"), value: "Check" },
  ], [t]);
  const userRoles = useMemo<Choice<AppSettings["userRole"]>[]>(() => [
    { label: t("settings.values.owner"), value: "Owner" },
    { label: t("settings.values.employee"), value: "Employee" },
    { label: t("settings.values.viewer"), value: "Viewer" },
  ], [t]);
  const autoLockTimers = useMemo<Choice<AppSettings["autoLockTimerMinutes"]>[]>(() => [
    { label: t("settings.values.minuteCount", { count: 1 }), value: 1 },
    { label: t("settings.values.minuteCount", { count: 5 }), value: 5 },
    { label: t("settings.values.minuteCount", { count: 10 }), value: 10 },
    { label: t("settings.values.minuteCount", { count: 15 }), value: 15 },
  ], [t]);
  const sessionTimeoutTimers = useMemo<Choice<AppSettings["sessionTimeoutMinutes"]>[]>(() => [
    { label: t("settings.values.minuteCount", { count: 5 }), value: 5 },
    { label: t("settings.values.minuteCount", { count: 15 }), value: 15 },
    { label: t("settings.values.minuteCount", { count: 30 }), value: 30 },
    { label: t("settings.values.minuteCount", { count: 60 }), value: 60 },
  ], [t]);

  const updateSettings = useCallback(async (patch: Partial<AppSettings>) => {
    setSettings((prev) => {
      const next = { ...prev, ...patch };
      void saveAppSettings(next);
      return next;
    });
  }, []);

  const savePasscode = useCallback(async () => {
    const normalizedPasscode = sanitizePasscode(newPasscode);
    const normalizedConfirm = sanitizePasscode(confirmPasscode);

    if (normalizedPasscode.length < 4) {
      Alert.alert(t("settings.passcodeRequiredTitle"), t("settings.passcodeLengthError"));
      return;
    }

    if (normalizedPasscode !== normalizedConfirm) {
      Alert.alert(t("settings.passcodeRequiredTitle"), t("settings.passcodeMismatchError"));
      return;
    }

    await persistPasscode(normalizedPasscode);
    setHasSavedPasscode(true);
    setEditingPasscode(false);
    setNewPasscode("");
    setConfirmPasscode("");

    if (!settings.passcodeLockEnabled) {
      await updateSettings({ passcodeLockEnabled: true });
    }

    Alert.alert(t("settings.success"), t("settings.passcodeSaved"));
  }, [confirmPasscode, newPasscode, sanitizePasscode, settings.passcodeLockEnabled, t, updateSettings]);

  const togglePasscodeLock = useCallback(async (nextValue: boolean) => {
    if (!nextValue) {
      await updateSettings({ passcodeLockEnabled: false });
      return;
    }

    const storedPasscode = await getPasscode();
    if (!storedPasscode) {
      setHasSavedPasscode(false);
      setEditingPasscode(true);
      Alert.alert(t("settings.passcodeRequiredTitle"), t("settings.passcodeRequiredBody"));
      return;
    }

    setHasSavedPasscode(true);
    await updateSettings({ passcodeLockEnabled: true });
  }, [t, updateSettings]);

  const toggleBiometrics = useCallback(async (nextValue: boolean) => {
    if (nextValue) {
      await ensureBiometricToken();
    }
    await updateSettings({ biometricsEnabled: nextValue });
  }, [updateSettings]);

  const updateLanguage = useCallback(async (language: SupportedLanguage) => {
    const nextSettings = await new Promise<AppSettings>((resolve) => {
      setSettings((prev) => {
        const next = { ...prev, language };
        resolve(next);
        return next;
      });
    });

    await saveAppSettings(nextSettings);

    const { shouldShowRtlRestartPrompt } = await applyLanguage(language);

    if (shouldShowRtlRestartPrompt) {
      Alert.alert(t("settings.language"), t("settings.languageChangedRestart"));
    }
  }, [t]);

  const updateCompany = useCallback(async (patch: Partial<AppSettings["companyProfile"]>) => {
    setSettings((prev) => {
      const next = { ...prev, companyProfile: { ...prev.companyProfile, ...patch } };
      void saveAppSettings(next);
      return next;
    });
  }, []);

  async function handleRestore() {
    Alert.alert(t("settings.restoreBackupTitle"), t("settings.restoreBackupMessage"), [
      { text: t("common.cancel"), style: "cancel" },
      {
        text: t("settings.restore"),
        style: "destructive",
        onPress: async () => {
          try {
            await restoreFullBackup();
            Alert.alert(t("settings.success"), t("settings.restoreSuccess"));
          } catch (e: any) {
            Alert.alert(t("settings.restoreFailed"), e?.message ?? t("settings.invalidFile"));
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
    Alert.alert(t("settings.syncedTitle"), t("settings.syncedMessage"));
  }

  async function clearLocalCache() {
    if (settings.userRole !== "Owner") {
      Alert.alert(t("settings.adminOnlyTitle"), t("settings.adminOnlyMessage"));
      return;
    }

    Alert.alert(t("settings.clearCacheTitle"), t("settings.clearCacheMessage"), [
      { text: t("common.cancel"), style: "cancel" },
      {
        text: t("settings.clear"),
        style: "destructive",
        onPress: async () => {
          await saveAppSettings(DEFAULT_APP_SETTINGS);
          await applyLanguage(DEFAULT_APP_SETTINGS.language);
          setSettings(DEFAULT_APP_SETTINGS);
          Alert.alert(t("settings.cacheClearedTitle"), t("settings.cacheClearedMessage"));
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
        {__DEV__ ? (
          <View style={{ gap: 4, marginTop: 8 }}>
            <Text style={[styles.metaText, { color: colors.muted }]}>{t("settings.savedLanguage", { language: settings.language })}</Text>
            <Text style={[styles.metaText, { color: colors.muted }]}>{t("settings.activeLanguage", { language: i18n.language })}</Text>
          </View>
        ) : null}
      </Card>

      <Card colors={colors} title={t("settings.appearance")}>
        <ToggleRow
          colors={colors}
          title={t("settings.nightMode")}
          subtitle={t("settings.nightModeSubtitle")}
          value={mode === "DARK"}
          onValueChange={toggle}
          />
          </Card>
    
          <Card colors={colors} title={t("settings.unitsFormatting")}>
            <ChoiceGroup colors={colors} label={t("settings.weightUnit")} value={settings.weightUnit} options={weightUnits} onChange={(value) => updateSettings({ weightUnit: value })} />
            <ChoiceGroup colors={colors} label={t("settings.temperatureUnit")} value={settings.temperatureUnit} options={tempUnits} onChange={(value) => updateSettings({ temperatureUnit: value })} />
            <ChoiceGroup colors={colors} label={t("settings.dateFormat")} value={settings.dateFormat} options={DATE_FORMATS} onChange={(value) => updateSettings({ dateFormat: value })} />
          </Card>
    
          <Card colors={colors} title={t("settings.companyProfile")}>
            <InputRow colors={colors} label={t("settings.businessName")} value={settings.companyProfile.businessName} onChangeText={(businessName) => updateCompany({ businessName })} />
            <InputRow colors={colors} label={t("settings.businessAddress")} value={settings.companyProfile.businessAddress} onChangeText={(businessAddress) => updateCompany({ businessAddress })} />
            <InputRow colors={colors} label={t("settings.phone")} value={settings.companyProfile.phone} onChangeText={(phone) => updateCompany({ phone })} keyboardType="phone-pad" />
            <InputRow colors={colors} label={t("settings.email")} value={settings.companyProfile.email} onChangeText={(email) => updateCompany({ email })} keyboardType="email-address" />
            <InputRow colors={colors} label={t("settings.licenseNumber")} value={settings.companyProfile.licenseNumber} onChangeText={(licenseNumber) => updateCompany({ licenseNumber })} />
            <InputRow colors={colors} label={t("settings.einOptional")} value={settings.companyProfile.ein ?? ""} onChangeText={(ein) => updateCompany({ ein })} />
    
            <View style={styles.logoWrap}>
              <Pressable style={styles.secondaryBtn} onPress={pickLogo}>
                <Text style={styles.secondaryBtnText}>{settings.companyProfile.logoUri ? t("settings.replaceLogo") : t("settings.uploadLogo")}</Text>
              </Pressable>
              {settings.companyProfile.logoUri ? <Image source={settings.companyProfile.logoUri} style={styles.logoPreview} contentFit="contain" /> : null}
            </View>
          </Card>
    
          <Card colors={colors} title={t("settings.backupSync")}>
            <Pressable onPress={syncNow} style={styles.btn}><Text style={styles.btnText}>{t("settings.syncNow")}</Text></Pressable>
            <ToggleRow colors={colors} title={t("settings.autoSync")} subtitle={t("settings.autoSyncSubtitle")} value={settings.autoSync} onValueChange={(autoSync) => updateSettings({ autoSync })} />
            <Pressable onPress={exportFullBackup} style={styles.btn}><Text style={styles.btnText}>{t("settings.exportBackup")}</Text></Pressable>
            <Pressable onPress={handleRestore} style={styles.secondaryBtn}><Text style={styles.secondaryBtnText}>{t("settings.importBackup")}</Text></Pressable>
            <Pressable onPress={clearLocalCache} style={styles.dangerBtn}><Text style={styles.btnText}>{t("settings.clearLocalCache")}</Text></Pressable>
          </Card>
    
          <Card colors={colors} title={t("settings.remindersAlerts")}>
            <ToggleRow colors={colors} title={t("settings.deliveryReminders")} value={settings.deliveryReminders} onValueChange={(deliveryReminders) => updateSettings({ deliveryReminders })} />
            <ToggleRow colors={colors} title={t("settings.paymentReminders")} value={settings.paymentReminders} onValueChange={(paymentReminders) => updateSettings({ paymentReminders })} />
            <ToggleRow colors={colors} title={t("settings.lowInventoryAlerts")} value={settings.lowInventoryAlerts} onValueChange={(lowInventoryAlerts) => updateSettings({ lowInventoryAlerts })} />
            <ToggleRow colors={colors} title={t("settings.expiringProductAlerts")} value={settings.expiringProductAlerts} onValueChange={(expiringProductAlerts) => updateSettings({ expiringProductAlerts })} />
          </Card>
    
          <Card colors={colors} title={t("settings.defaultSaleSettings")}>
            <ChoiceGroup colors={colors} label={t("settings.defaultBuyerType")} value={settings.defaultBuyerType} options={buyerTypes} onChange={(defaultBuyerType) => updateSettings({ defaultBuyerType })} />
            <ChoiceGroup colors={colors} label={t("settings.defaultPaymentMethod")} value={settings.defaultPaymentMethod} options={paymentMethods} onChange={(defaultPaymentMethod) => updateSettings({ defaultPaymentMethod })} />
            <ToggleRow colors={colors} title={t("settings.requireSignature")} value={settings.requireSignature} onValueChange={(requireSignature) => updateSettings({ requireSignature })} />
            <ToggleRow colors={colors} title={t("settings.requirePhoto")} value={settings.requirePhoto} onValueChange={(requirePhoto) => updateSettings({ requirePhoto })} />
            <ToggleRow colors={colors} title={t("settings.autoGenerateInvoice")} value={settings.autoGenerateInvoice} onValueChange={(autoGenerateInvoice) => updateSettings({ autoGenerateInvoice })} />
          </Card>
    
          <Card colors={colors} title={t("settings.userRole")}>
            <ChoiceGroup colors={colors} label={t("settings.role")} value={settings.userRole} options={userRoles} onChange={(userRole) => updateSettings({ userRole })} />
          </Card>
    
          <Card colors={colors} title={t("settings.security")}>
            <ToggleRow colors={colors} title={t("settings.passcodeLock")} value={settings.passcodeLockEnabled} onValueChange={(passcodeLockEnabled) => void togglePasscodeLock(passcodeLockEnabled)} />
            {!hasSavedPasscode ? (
              <Text style={[styles.metaText, { color: colors.muted }]}>{t("settings.noPasscodeSet")}</Text>
            ) : null}

            {editingPasscode || !hasSavedPasscode ? (
              <View style={styles.passcodeEditor}>
                <InputRow
                  colors={colors}
                  label={t("settings.newPasscode")}
                  value={newPasscode}
                  onChangeText={(value) => setNewPasscode(sanitizePasscode(value))}
                  keyboardType="number-pad"
                  secureTextEntry
                />
                <InputRow
                  colors={colors}
                  label={t("settings.confirmPasscode")}
                  value={confirmPasscode}
                  onChangeText={(value) => setConfirmPasscode(sanitizePasscode(value))}
                  keyboardType="number-pad"
                  secureTextEntry
                />
                <Pressable style={styles.btn} onPress={() => void savePasscode()}>
                  <Text style={styles.btnText}>{hasSavedPasscode ? t("settings.updatePasscode") : t("settings.setPasscode")}</Text>
                </Pressable>
                {hasSavedPasscode ? (
                  <Pressable style={styles.secondaryBtn} onPress={() => {
                    setEditingPasscode(false);
                    setNewPasscode("");
                    setConfirmPasscode("");
                  }}>
                    <Text style={styles.secondaryBtnText}>{t("common.cancel")}</Text>
                  </Pressable>
                ) : null}
              </View>
            ) : (
              <Pressable style={styles.secondaryBtn} onPress={() => setEditingPasscode(true)}>
                <Text style={styles.secondaryBtnText}>{t("settings.changePasscode")}</Text>
              </Pressable>
            )}
            <ToggleRow colors={colors} title={t("settings.faceIdTouchId")} value={settings.biometricsEnabled} onValueChange={(biometricsEnabled) => void toggleBiometrics(biometricsEnabled)} />
            <ChoiceGroup colors={colors} label={t("settings.autoLockTimer")} value={settings.autoLockTimerMinutes} options={autoLockTimers} onChange={(autoLockTimerMinutes) => updateSettings({ autoLockTimerMinutes })} />
            <ChoiceGroup colors={colors} label={t("settings.sessionTimeout")} value={settings.sessionTimeoutMinutes} options={sessionTimeoutTimers} onChange={(sessionTimeoutMinutes) => updateSettings({ sessionTimeoutMinutes })} />
          </Card>
    
          <Card colors={colors} title={t("settings.aboutLegal")}>
            <Text style={[styles.metaText, { color: colors.text }]}>{t("settings.appVersion", { version: appVersion })}</Text>
            <Pressable onPress={() => Linking.openURL("https://hambungle.com/privacy/?app=catchledger#catchledger")}><Text style={[styles.link, { color: colors.primary }]}>{t("settings.privacyPolicy")}</Text></Pressable>
            <Pressable onPress={() => Linking.openURL("https://hambungle.com/terms/")}><Text style={[styles.link, { color: colors.primary }]}>{t("settings.terms")}</Text></Pressable>
            <Pressable onPress={() => Linking.openURL("hello@hambungle.com")}><Text style={[styles.link, { color: colors.primary }]}>{t("settings.contactSupport")}</Text></Pressable>
            {!!settings.lastSyncedAt && <Text style={[styles.metaText, { color: colors.muted }]}>{t("settings.lastSynced", { time: new Date(settings.lastSyncedAt).toLocaleString() })}</Text>}
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
function InputRow({ colors, label, value, onChangeText, keyboardType, secureTextEntry }: { colors: any; label: string; value: string; onChangeText: (v: string) => void; keyboardType?: "default" | "phone-pad" | "email-address" | "number-pad"; secureTextEntry?: boolean }) {
  return (
    <View style={styles.inputWrap}>
      <Text style={[styles.inputLabel, { color: colors.text }]}>{label}</Text>
      <TextInput value={value} onChangeText={onChangeText} keyboardType={keyboardType} secureTextEntry={secureTextEntry} placeholder={label} placeholderTextColor={colors.muted} style={[styles.input, { borderColor: colors.cardBorder, color: colors.text }]} />
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
  passcodeEditor: { gap: 8 },

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
