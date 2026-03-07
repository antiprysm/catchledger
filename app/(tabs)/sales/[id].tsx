import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { useCallback, useContext, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Alert,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { STORAGE_KEYS } from "@/constants/storageKeys";
import { useReviewPrompt } from "@/hooks/useReviewPrompt";
import { BuyerType, PaymentMethod, Sale } from "@/types/sales";
import { formatDateTime, loadAppSettings } from "@/utils/appSettings";
import { initNotifications } from "@/utils/notifications";
import { loadJSON, saveJSON } from "@/utils/storage";

import { ThemeContext } from "@/theme/ThemeProvider";


const BUYER_TYPES: BuyerType[] = ["RESTAURANT", "CHEF", "MARKET", "PERSON", "OTHER"];
const PAYMENT_METHODS: PaymentMethod[] = ["CASH", "CARD", "BANK_TRANSFER", "CHECK", "PAYPAL", "CASHAPP", "VENMO", "OTHER"];
const SALE_LOCATION_TYPES: NonNullable<Sale["saleLocationType"]>[] = ["TRUCK", "HOME", "DOCK", "OTHER"];

function fmtWhen(iso: string) {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleString();
}

export default function SaleDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();

  const { colors, mode } = useContext(ThemeContext);
  const { t } = useTranslation();
  const { incrementSuccess } = useReviewPrompt();

  const [sale, setSale] = useState<Sale | null>(null);
  const [inspectionMode, setInspectionMode] = useState(false);
  const [busy, setBusy] = useState(false);
  const [dateFormat, setDateFormat] = useState<"MM/DD/YYYY" | "DD/MM/YYYY">("MM/DD/YYYY");

  // editable fields
  const [buyerName, setBuyerName] = useState("");
  const [buyerType, setBuyerType] = useState<BuyerType>("RESTAURANT");
  const [buyerContact, setBuyerContact] = useState("");
  const [buyerLicenseId, setBuyerLicenseId] = useState("");

  const [saleLocationType, setSaleLocationType] =
    useState<NonNullable<Sale["saleLocationType"]>>("TRUCK");
  const [saleLocationNote, setSaleLocationNote] = useState("");

  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("CASH");
  const [paymentNote, setPaymentNote] = useState("");

  const loadInspectionMode = useCallback(async () => {
    const m = await loadJSON<boolean>(STORAGE_KEYS.INSPECTION_MODE, false);
    setInspectionMode(!!m);
  }, []);

  const loadSale = useCallback(async () => {
    const sales = await loadJSON<Sale[]>(STORAGE_KEYS.SALES, []);
    const found = sales.find((s) => s.id === id) ?? null;
    setSale(found);

    if (found) {
      setBuyerName(found.buyerName ?? "");
      setBuyerType(found.buyerType ?? "RESTAURANT");
      setBuyerContact(found.buyerContact ?? "");
      setBuyerLicenseId(found.buyerLicenseId ?? "");

      setSaleLocationType(found.saleLocationType ?? "TRUCK");
      setSaleLocationNote(found.saleLocationNote ?? "");

      setPaymentMethod(found.paymentMethod ?? "CASH");
      setPaymentNote(found.paymentNote ?? "");
    }
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      loadInspectionMode();
      loadSale();
      loadAppSettings().then((s) => setDateFormat(s.dateFormat));
    }, [loadInspectionMode, loadSale])
  );

  const linesTotal = useMemo(() => {
    if (!sale) return 0;
    return sale.lines.reduce((sum, l) => sum + (Number(l.subtotal) || 0), 0);
  }, [sale]);

  const computedTotal = useMemo(() => {
    if (!sale) return 0;
    return Number.isFinite(linesTotal) ? linesTotal : Number(sale.total || 0);
  }, [sale, linesTotal]);

  const confirmDelete = useCallback(() => {
    Alert.alert(t("sales.deleteSaleTitle"), t("common.cannotBeUndone"), [
            { text: t("common.cancel"), style: "cancel" },
      {
        text: t("common.delete"),
        style: "destructive",
        onPress: async () => {
          const sales = await loadJSON<Sale[]>(STORAGE_KEYS.SALES, []);
          const filtered = sales.filter((s) => s.id !== id);
          await saveJSON(STORAGE_KEYS.SALES, filtered);
          await initNotifications().catch(() => undefined);
          router.back();
        },
      },
    ]);
  }, [id]);

  const saveEdits = useCallback(async () => {
    if (inspectionMode) return;
    if (!sale) return;
    if (busy) return;

    const trimmedBuyer = buyerName.trim();
    if (!trimmedBuyer) {
      Alert.alert(t("sales.buyerRequiredTitle"), t("sales.buyerRequiredMessage"));
      return;
    }

    setBusy(true);
    try {
      const sales = await loadJSON<Sale[]>(STORAGE_KEYS.SALES, []);

      const updated: Sale = {
        ...sale,
        buyerName: trimmedBuyer,
        buyerType,
        buyerContact: buyerContact.trim() ? buyerContact.trim() : undefined,
        buyerLicenseId: buyerLicenseId.trim() ? buyerLicenseId.trim() : undefined,

        saleLocationType: saleLocationType ?? "TRUCK",
        saleLocationNote: saleLocationNote.trim() ? saleLocationNote.trim() : undefined,

        paymentMethod,
        paymentNote: paymentNote.trim() ? paymentNote.trim() : undefined,

        total: Number(computedTotal || 0),
        updatedAt: new Date().toISOString(),
      };

      const replaced = sales.map((s) => (s.id === sale.id ? updated : s));
      await saveJSON(STORAGE_KEYS.SALES, replaced);
      await incrementSuccess();
      await initNotifications().catch(() => undefined);
      setSale(updated);

      Alert.alert(t("sales.savedTitle"), t("sales.saleUpdatedMessage"));
    } catch (e: any) {
      Alert.alert(t("sales.saveFailedTitle"), e?.message ?? t("reports.unknownError"));
    } finally {
      setBusy(false);
    }
  }, [
    inspectionMode,
    sale,
    busy,
    buyerName,
    buyerType,
    buyerContact,
    buyerLicenseId,
    saleLocationType,
    saleLocationNote,
    paymentMethod,
    paymentNote,
    computedTotal,
    incrementSuccess,
  ]);

  // ✅ empty-state readable in dark mode
  if (!sale) {
    return (
      <View style={[styles.container, { backgroundColor: colors.bg, flex: 1, justifyContent: "center" }]}>
        <Text style={[styles.h2, { color: colors.text }]}>{t("sales.saleNotFound")}</Text>
        <Text style={[styles.muted, { color: colors.muted, marginTop: 6 }]}>
          {t("sales.saleNotFoundMessage")}
        </Text>

        <Pressable style={[styles.backBtn, { backgroundColor: "#111" }]} onPress={() => router.back()}>
          <Text style={styles.backBtnText}>{t("common.back")}</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.bg }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        contentContainerStyle={{paddingBottom: 40 }}
        style={{ backgroundColor: colors.bg }}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
      >
        <Pressable onPress={Keyboard.dismiss} style={{ gap: 10 }}>
          {inspectionMode ? (
            <View style={styles.bannerWrap}>
              <View style={styles.banner}>
                <Text style={styles.bannerText}>{t("sales.inspectionReadOnlyBanner")}</Text>
              </View>

              <Pressable
                style={styles.exitBtn}
                onPress={async () => {
                  await saveJSON(STORAGE_KEYS.INSPECTION_MODE, false);
                  setInspectionMode(false);
                  Alert.alert(t("compliance.inspectionOff"));
                }}
              >
                <Text style={styles.exitText}>{t("sales.exitInspectionMode")}</Text>
              </Pressable>
            </View>
          ) : null}

          <View style={[styles.card, { borderColor: colors.cardBorder, backgroundColor: colors.cardBg }]}>
            <Text style={[styles.h2, { color: colors.text }]}>{t("sales.buyer")}</Text>

            {inspectionMode ? (
              <>
                <Text style={[styles.bigValue, { color: colors.text }]}>
                  {sale.buyerName || t("sales.unknownBuyer")}
                </Text>
                <Text style={[styles.muted, { color: colors.muted }]}>
                  {sale.buyerType ? t(`sales.buyerTypes.${sale.buyerType}`) : t("sales.buyerTypes.OTHER")}
                  {sale.buyerContact ? ` • ${sale.buyerContact}` : ""}
                </Text>
                {sale.buyerLicenseId ? (
                  <Text style={[styles.muted, { color: colors.muted }]}>
                    {t("sales.buyerLicenseInline", { value: sale.buyerLicenseId })}
                  </Text>
                ) : null}
              </>
            ) : (
              <>
                <Text style={[styles.label, { color: colors.text }]}>{t("sales.buyerName")}</Text>
                <TextInput
                  value={buyerName}
                  onChangeText={setBuyerName}
                  placeholder={t("sales.buyerNamePlaceholder")}
                  placeholderTextColor={colors.muted}
                  style={[styles.input, { borderColor: colors.cardBorder, color: colors.text, backgroundColor: colors.cardBg }]}
                />

                <Text style={[styles.label, { color: colors.text }]}>{t("sales.buyerType")}</Text>
                <View style={styles.rowWrap}>
                  {BUYER_TYPES.map((buyerTypeOption) => (
                    <Pressable
                      key={buyerTypeOption}
                      onPress={() => setBuyerType(buyerTypeOption)}
                      style={[
                        styles.chip,
                        { borderColor: colors.cardBorder, backgroundColor: colors.cardBg },
                        buyerType === buyerTypeOption && { backgroundColor: colors.primary, borderColor: colors.primary },
                      ]}
                    >
                      <Text style={buyerType === buyerTypeOption ? styles.chipTextOn : [styles.chipText, { color: colors.text }]}>
                        {t(`sales.buyerTypes.${buyerTypeOption}`)}
                      </Text>
                    </Pressable>
                  ))}
                </View>

                <Text style={[styles.label, { color: colors.text }]}>{t("sales.buyerContactOptional")}</Text>
                <TextInput
                  value={buyerContact}
                  onChangeText={setBuyerContact}
                  placeholder={t("sales.buyerContactPlaceholder")}
                  placeholderTextColor={colors.muted}
                  style={[styles.input, { borderColor: colors.cardBorder, color: colors.text, backgroundColor: colors.cardBg }]}
                />

                <Text style={[styles.label, { color: colors.text }]}>{t("sales.buyerLicenseOptional")}</Text>
                <TextInput
                  value={buyerLicenseId}
                  onChangeText={setBuyerLicenseId}
                  placeholder={t("sales.buyerLicensePlaceholder")}
                  placeholderTextColor={colors.muted}
                  style={[styles.input, { borderColor: colors.cardBorder, color: colors.text, backgroundColor: colors.cardBg }]}
                />
              </>
            )}

            <View style={[styles.hr, { backgroundColor: colors.cardBorder, opacity: mode === "DARK" ? 0.55 : 0.7 }]} />

            <Text style={[styles.h2, { color: colors.text }]}>{t("sales.sale")}</Text>
            <Text style={[styles.muted, { color: colors.muted }]}>
              {t("sales.occurredValue", { value: formatDateTime(sale.occurredAt, dateFormat) })}
            </Text>

            {inspectionMode ? (
              <Text style={[styles.muted, { color: colors.muted }]}>
                {t("sales.locationValue", { value: sale.saleLocationType ? t(`sales.saleLocationTypes.${sale.saleLocationType}`) : "—" })}
                {sale.saleLocationNote ? ` • ${sale.saleLocationNote}` : ""}
              </Text>
            ) : (
              <>
                <Text style={[styles.label, { color: colors.text }]}>{t("sales.saleLocation")}</Text>
                <View style={styles.rowWrap}>
                  {SALE_LOCATION_TYPES.map((saleLocationTypeOption) => (
                    <Pressable
                      key={saleLocationTypeOption}
                      onPress={() => setSaleLocationType(saleLocationTypeOption)}
                      style={[
                        styles.chip,
                        { borderColor: colors.cardBorder, backgroundColor: colors.cardBg },
                        saleLocationType === saleLocationTypeOption && { backgroundColor: colors.primary, borderColor: colors.primary },
                      ]}
                    >
                      <Text
                        style={
                          saleLocationType === saleLocationTypeOption
                            ? styles.chipTextOn
                            : [styles.chipText, { color: colors.text }]
                        }
                      >
                        {t(`sales.saleLocationTypes.${saleLocationTypeOption}`)}
                      </Text>
                    </Pressable>
                  ))}
                </View>

                <Text style={[styles.label, { color: colors.text }]}>{t("sales.saleLocationNoteOptional")}</Text>
                <TextInput
                  value={saleLocationNote}
                  onChangeText={setSaleLocationNote}
                  placeholder={t("sales.saleLocationNotePlaceholder")}
                  placeholderTextColor={colors.muted}
                  style={[styles.input, { borderColor: colors.cardBorder, color: colors.text, backgroundColor: colors.cardBg }]}
                />
              </>
            )}

            <View style={[styles.hr, { backgroundColor: colors.cardBorder, opacity: mode === "DARK" ? 0.55 : 0.7 }]} />

            <Text style={[styles.h2, { color: colors.text }]}>{t("sales.payment")}</Text>

            {inspectionMode ? (
              <Text style={[styles.muted, { color: colors.muted }]}>
                {t("sales.paymentValue", { value: t(`sales.paymentMethods.${sale.paymentMethod}`) })}
                {sale.paymentNote ? ` • ${sale.paymentNote}` : ""}
              </Text>
            ) : (
              <>
                <View style={styles.rowWrap}>
                  {PAYMENT_METHODS.map((m) => (
                    <Pressable
                      key={m}
                      onPress={() => setPaymentMethod(m)}
                      style={[
                        styles.chip,
                        { borderColor: colors.cardBorder, backgroundColor: colors.cardBg },
                        paymentMethod === m && { backgroundColor: colors.primary, borderColor: colors.primary },
                      ]}
                    >
                      <Text
                        style={
                          paymentMethod === m
                            ? styles.chipTextOn
                            : [styles.chipText, { color: colors.text }]
                        }
                      >
                        {t(`sales.paymentMethods.${m}`)}
                      </Text>
                    </Pressable>
                  ))}
                </View>

                <Text style={[styles.label, { color: colors.text }]}>{t("sales.paymentNoteOptional")}</Text>
                <TextInput
                  value={paymentNote}
                  onChangeText={setPaymentNote}
                  placeholder={t("sales.paymentNotePlaceholder")}
                  placeholderTextColor={colors.muted}
                  style={[styles.input, { borderColor: colors.cardBorder, color: colors.text, backgroundColor: colors.cardBg }]}
                />
              </>
            )}

            <Text style={[styles.total, { color: colors.text }]}>
              {t("sales.totalValue", { value: Number(computedTotal || 0).toFixed(2) })}
            </Text>

            {!inspectionMode ? (
              <Pressable
                style={[styles.saveBtn, busy && { opacity: 0.6 }]}
                onPress={saveEdits}
                disabled={busy}
              >
                <Text style={styles.saveText}>{busy ? t("sales.saving") : t("sales.saveChanges")}</Text>
              </Pressable>
            ) : null}
          </View>

          <Text style={[styles.sectionTitle, { color: colors.text }]}>{t("sales.lineItems")}</Text>

          {sale.lines.map((ln, idx) => (
            <View
              key={`${ln.itemId}-${idx}`}
              style={[styles.lineCard, { borderColor: colors.cardBorder, backgroundColor: colors.cardBg }]}
            >
              <Text style={[styles.lineTitle, { color: colors.text }]}>
                {ln.speciesName} — {ln.quantity} {ln.unit}
              </Text>
              <Text style={[styles.muted, { color: colors.muted }]}>
                ${Number(ln.unitPrice).toFixed(2)} / {ln.unit} • {t("sales.subtotal")} ${Number(ln.subtotal).toFixed(2)}
              </Text>

              <View style={{ marginTop: 8 }}>
                {(ln as any).originBatchId ? (
                  <Text style={[styles.muted, { color: colors.muted }]}>
                    {t("sales.batchValue", { value: (ln as any).originBatchId })}
                  </Text>
                ) : null}
                <Text style={[styles.muted, { color: colors.muted }]}>
                  {t("sales.originValue", { value: ln.originCatchLocation || "—" })}
                </Text>
                <Text style={[styles.muted, { color: colors.muted }]}>
                  {t("sales.caughtValue", { value: ln.originCaughtAt ? fmtWhen(ln.originCaughtAt) : "—" })}
                </Text>
                {ln.originCatchMethod ? (
                  <Text style={[styles.muted, { color: colors.muted }]}>
                    {t("sales.methodValue", { value: ln.originCatchMethod })}
                  </Text>
                ) : null}
              </View>
            </View>
          ))}

          {!inspectionMode ? (
            <Pressable style={styles.deleteBtn} onPress={confirmDelete}>
              <Text style={styles.deleteText}>{t("sales.deleteSale")}</Text>
            </Pressable>
          ) : null}

          <View style={{ height: 6 }} />
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, gap: 10, paddingBottom: 40 },

  bannerWrap: { gap: 10 },
  banner: { backgroundColor: "#111", padding: 10, borderRadius: 12 },
  bannerText: { color: "white", fontWeight: "900", textAlign: "center" },
  exitBtn: { backgroundColor: "#c62828", padding: 12, borderRadius: 12, alignItems: "center" },
  exitText: { color: "white", fontWeight: "900" },

  card: { borderWidth: 1, borderRadius: 12, padding: 12, gap: 10 },

  h2: { fontSize: 16, fontWeight: "900" },
  bigValue: { fontSize: 18, fontWeight: "900" },

  sectionTitle: { fontWeight: "900", marginTop: 2 },

  input: { borderWidth: 1, borderRadius: 10, padding: 12 },
  label: { fontWeight: "800" },

  rowWrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 },

  chip: { borderWidth: 1, borderRadius: 999, paddingVertical: 8, paddingHorizontal: 12 },
  chipText: { fontWeight: "800" },
  chipTextOn: { color: "white", fontWeight: "900" },

  hr: { height: 1 },

  total: { fontSize: 16, fontWeight: "900", marginTop: 2 },

  saveBtn: { backgroundColor: "#111", padding: 14, borderRadius: 12, alignItems: "center" },
  saveText: { color: "white", fontWeight: "900" },

  lineCard: { borderWidth: 1, borderRadius: 12, padding: 12, gap: 6 },
  lineTitle: { fontWeight: "900" },

  deleteBtn: { backgroundColor: "#c62828", padding: 14, borderRadius: 12, alignItems: "center" },
  deleteText: { color: "white", fontWeight: "900" },

  // empty state
  muted: {},
  backBtn: { marginTop: 14, padding: 14, borderRadius: 12, alignItems: "center" },
  backBtnText: { color: "white", fontWeight: "900" },
});
