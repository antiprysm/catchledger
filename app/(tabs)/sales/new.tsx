import { ThemeContext } from "@/theme/ThemeProvider";

import { router, useFocusEffect } from "expo-router";
import { useCallback, useContext, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Alert,
  FlatList,
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
import { InventoryItem } from "@/types/inventory";
import { BuyerType, PaymentMethod, Sale, SaleLine } from "@/types/sales";
import { DEFAULT_APP_SETTINGS, type AppSettings } from "@/types/settings";
import { applyDateFormat, loadAppSettings, weightUnitLabel } from "@/utils/appSettings";
import { initNotifications } from "@/utils/notifications";
import { loadJSON, saveJSON } from "@/utils/storage";

function uid() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

function parseQty(n: unknown) {
  const x = typeof n === "number" ? n : Number(n);
  return Number.isFinite(x) ? x : 0;
}

function isTrackedQuantity(q: unknown): q is number {
  return typeof q === "number" && Number.isFinite(q);
}

const BUYER_TYPES: BuyerType[] = ["RESTAURANT", "CHEF", "MARKET", "PERSON", "OTHER"];
const PAYMENT_METHODS: PaymentMethod[] = ["CASH", "CARD", "BANK_TRANSFER", "CHECK", "PAYPAL", "CASHAPP", "VENMO", "OTHER"];
const SALE_LOCATION_TYPES: NonNullable<Sale["saleLocationType"]>[] = ["TRUCK", "HOME", "DOCK", "OTHER"];

export default function NewSaleScreen() {
  const { colors } = useContext(ThemeContext);
  const { t } = useTranslation();
  const { incrementSuccess } = useReviewPrompt();

  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [inspectionMode, setInspectionMode] = useState(false);

  const [lines, setLines] = useState<SaleLine[]>([]);

  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("CASH");
  const [paymentNote, setPaymentNote] = useState("");

  const [buyerName, setBuyerName] = useState("");
  const [buyerType, setBuyerType] = useState<BuyerType>("RESTAURANT");
  const [buyerContact, setBuyerContact] = useState("");
  const [buyerLicenseId, setBuyerLicenseId] = useState("");

  const [saleLocationType, setSaleLocationType] =
    useState<NonNullable<Sale["saleLocationType"]>>("TRUCK");
  const [saleLocationNote, setSaleLocationNote] = useState("");
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_APP_SETTINGS);

  const [isReady, setIsReady] = useState(false);

  const resetForm = useCallback((active: AppSettings) => {
    setLines([]);
    setPaymentMethod(
      active.defaultPaymentMethod === "Cash" ? "CASH"
      : active.defaultPaymentMethod === "Card" ? "CARD"
      : active.defaultPaymentMethod === "Check" ? "CHECK"
      : "BANK_TRANSFER"
    );
    setPaymentNote("");
    setBuyerName("");
    setBuyerType(
      active.defaultBuyerType === "Restaurant" ? "RESTAURANT"
      : active.defaultBuyerType === "Retail" ? "MARKET"
      : "OTHER"
    );
    setBuyerContact("");
    setBuyerLicenseId("");
    setSaleLocationType("TRUCK");
    setSaleLocationNote("");
  }, []);

  const loadAll = useCallback(() => {
    let mounted = true;
    setIsReady(false);
  
    Promise.all([
      loadJSON<InventoryItem[]>(STORAGE_KEYS.INVENTORY, []),
      loadJSON<boolean>(STORAGE_KEYS.INSPECTION_MODE, false),
      loadAppSettings(),
    ]).then(([inv, mode, appSettings]) => {
      if (!mounted) return;
  
      setInventory(inv);
      setInspectionMode(!!mode);
      setSettings(appSettings);
  
      if (mode) {
        Alert.alert(t("sales.inspectionModeTitle"), t("sales.inspectionModeDisabledMessage"));
        router.replace("/(tabs)/sales");
        return;
      }
  
      resetForm(appSettings);
      setIsReady(true);
    });
  
    return () => {
      mounted = false;
    };
  }, [resetForm, t, router]);

  useFocusEffect(loadAll);

  if (!isReady) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg, alignItems: "center", justifyContent: "center" }}>
        <Text style={{ color: colors.muted, fontWeight: "800" }}>{t("common.loading")}</Text>
      </View>
    );
  }

  const total = useMemo(() => lines.reduce((sum, l) => sum + l.subtotal, 0), [lines]);

  function addLine(item: InventoryItem) {
    setLines((prev) => {
      const existing = prev.find((l) => l.itemId === item.id);
      if (existing) {
        return prev.map((l) => {
          if (l.itemId !== item.id) return l;
          const qty = l.quantity + 1;
          return { ...l, quantity: qty, subtotal: qty * l.unitPrice };
        });
      }

      const newLine: SaleLine = {
        itemId: item.id,
        speciesName: item.speciesName,
        unit: item.unit,
        unitPrice: item.pricePerUnit,
        quantity: 1,
        subtotal: item.pricePerUnit,

        originCatchLocation: item.catchLocation,
        originCaughtAt: item.caughtAt,
        originCatchMethod: item.catchMethod,
        originBatchId: item.batchId,
      };

      return [...prev, newLine];
    });
  }

  function updateQty(itemId: string, qtyText: string) {
    const qty = Number(qtyText);
    setLines((prev) =>
      prev.map((l) => {
        if (l.itemId !== itemId) return l;
        const safeQty = Number.isFinite(qty) && qty >= 0 ? qty : l.quantity;
        return { ...l, quantity: safeQty, subtotal: safeQty * l.unitPrice };
      })
    );
  }

  function removeLine(itemId: string) {
    setLines((prev) => prev.filter((l) => l.itemId !== itemId));
  }

  async function saveSale() {
    if (inspectionMode) return;

    if (lines.length === 0) {
      Alert.alert(t("sales.addAtLeastOneItemTitle"), t("sales.addAtLeastOneItemMessage"));
      return;
    }

    const trimmedBuyer = buyerName.trim();
    if (!trimmedBuyer) {
      Alert.alert(t("sales.buyerRequiredTitle"), t("sales.buyerRequiredMessage"));
      return;
    }

    const badQty = lines.find((l) => !Number.isFinite(l.quantity) || l.quantity <= 0);
    if (badQty) {
      Alert.alert(t("sales.invalidQuantityTitle"), t("sales.fixQuantityFor", { species: badQty.speciesName }));
      return;
    }

    const currentInventory = await loadJSON<InventoryItem[]>(STORAGE_KEYS.INVENTORY, []);
    const invById = new Map(currentInventory.map((i) => [i.id, i]));

    const oversold = lines.find((l) => {
      const inv = invById.get(l.itemId);
      if (!inv) return true;
      if (inv.quantity == null) return false;
      return l.quantity > parseQty(inv.quantity);
    });

    if (oversold) {
      const inv = invById.get(oversold.itemId);
      const available = Number(inv?.quantity ?? 0);
      Alert.alert(
        t("sales.notEnoughInventoryTitle"),
        t("sales.notEnoughInventoryMessage", { species: oversold.speciesName, requested: oversold.quantity, available })
      );
      return;
    }

    const updatedInventory = currentInventory.map((inv) => {
      const line = lines.find((l) => l.itemId === inv.id);
      if (!line) return inv;
      if (inv.quantity == null) return inv;

      const newQty = Math.max(0, parseQty(inv.quantity) - line.quantity);
      return { ...inv, quantity: newQty, updatedAt: new Date().toISOString() };
    });

    await saveJSON(STORAGE_KEYS.INVENTORY, updatedInventory);

    const nowISO = new Date().toISOString();
    const sale: Sale = {
      id: uid(),
      occurredAt: nowISO,

      buyerName: trimmedBuyer,
      buyerType,
      buyerContact: buyerContact.trim() ? buyerContact.trim() : undefined,
      buyerLicenseId: buyerLicenseId.trim() ? buyerLicenseId.trim() : undefined,

      saleLocationType: saleLocationType ?? "TRUCK",
      saleLocationNote: saleLocationNote.trim() ? saleLocationNote.trim() : undefined,

      paymentMethod,
      paymentNote: paymentNote.trim() ? paymentNote.trim() : undefined,

      lines,
      total,

      createdAt: nowISO,
      updatedAt: nowISO,
      requireSignature: settings.requireSignature,
      requirePhoto: settings.requirePhoto,
      invoiceNumber: settings.autoGenerateInvoice ? `INV-${Date.now()}` : undefined,
    };

    const existingSales = await loadJSON<Sale[]>(STORAGE_KEYS.SALES, []);
    await saveJSON(STORAGE_KEYS.SALES, [sale, ...existingSales]);
    await incrementSuccess();
    console.log("[new-sale] resetForm called", {
      t: Date.now(),
      reason: "FOCUS_EFFECT" // label each call site
    });
    console.log("[new-sale] render", Date.now());
    resetForm(settings);
    await initNotifications().catch(() => undefined);
    router.replace("/(tabs)/sales");
  }

  const inputStyle = [
    styles.input,
    { borderColor: colors.cardBorder, backgroundColor: colors.cardBg, color: colors.text },
  ];

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
        {/* Tap-to-dismiss wrapper */}
        <Pressable onPress={Keyboard.dismiss} style={{ gap: 10 }}>
          <Text style={[styles.title, { color: colors.text }]}>{t("sales.newSale")}</Text>
          <Text style={[styles.mutedText, { color: colors.muted }]}>{t("sales.dateFormatValue", { format: settings.dateFormat, date: applyDateFormat(new Date(), settings.dateFormat) })}</Text>

          <FlatList
            data={inventory}
            keyExtractor={(i) => i.id}
            scrollEnabled={false}
            ListEmptyComponent={
              <Text style={[styles.mutedText, { color: colors.muted }]}>
                {t("sales.noInventoryYet")}
              </Text>
            }
            ListHeaderComponent={
              <View style={{ gap: 10 }}>
                <Text style={[styles.sectionTitle, { color: colors.text }]}>{t("sales.cart")}</Text>

                {lines.length === 0 ? (
                  <Text style={[styles.mutedText, { color: colors.muted }]}>
                    {t("sales.noItemsYetAddFromInventory")}
                  </Text>
                ) : (
                  <View style={{ gap: 8 }}>
                    {lines.map((line) => (
                      <View
                        key={line.itemId}
                        style={[
                          styles.cartRow,
                          { borderColor: colors.cardBorder, backgroundColor: colors.cardBg },
                        ]}
                      >
                        <View style={{ flex: 1 }}>
                          <Text style={[styles.bold, { color: colors.text }]}>{line.speciesName}</Text>
                          <Text style={{ color: colors.muted }}>
                            ${line.unitPrice}/{weightUnitLabel(line.unit, settings.weightUnit)}
                          </Text>
                        </View>

                        <View style={{ width: 70 }}>
                          <Text style={[styles.smallLabel, { color: colors.muted }]}>{t("sales.qty")}</Text>
                          <TextInput
                            value={String(line.quantity)}
                            onChangeText={(t) => updateQty(line.itemId, t)}
                            keyboardType="number-pad"
                            style={[
                              styles.qtyInput,
                              {
                                borderColor: colors.cardBorder,
                                backgroundColor: colors.cardBg,
                                color: colors.text,
                              },
                            ]}
                            placeholderTextColor={colors.muted}
                          />
                        </View>

                        <View style={{ width: 90, alignItems: "flex-end" }}>
                          <Text style={[styles.smallLabel, { color: colors.muted }]}>{t("sales.subtotal")}</Text>
                          <Text style={[styles.bold, { color: colors.text }]}>
                            ${line.subtotal.toFixed(2)}
                          </Text>
                          <Pressable onPress={() => removeLine(line.itemId)}>
                            <Text style={styles.remove}>{t("sales.remove")}</Text>
                          </Pressable>
                        </View>
                      </View>
                    ))}
                  </View>
                )}

                <View style={[styles.totalBar, { borderColor: colors.cardBorder }]}>
                  <Text style={[styles.bold, { color: colors.text }]}>{t("sales.total")}</Text>
                  <Text style={[styles.bold, { color: colors.text }]}>${total.toFixed(2)}</Text>
                </View>

                <Text style={[styles.label, { color: colors.text }]}>{t("sales.buyerName")}</Text>
                <TextInput
                  value={buyerName}
                  onChangeText={setBuyerName}
                  style={inputStyle}
                  placeholder={t("sales.buyerNamePlaceholder")}
                  placeholderTextColor={colors.muted}
                />

                <Text style={[styles.label, { color: colors.text }]}>{t("sales.buyerType")}</Text>
                <View style={styles.row}>
                  {BUYER_TYPES.map((buyerTypeOption) => {
                    const on = buyerType === buyerTypeOption;
                    return (
                      <Pressable
                        key={buyerTypeOption}
                        onPress={() => setBuyerType(buyerTypeOption)}
                        style={[
                          styles.chip,
                          { borderColor: colors.cardBorder, backgroundColor: colors.cardBg },
                          on && { backgroundColor: colors.primary, borderColor: colors.primary },
                        ]}
                      >
                        <Text style={[{ color: colors.text }, on && styles.chipTextOn]}>{t(`sales.buyerTypes.${buyerTypeOption}`)}</Text>
                      </Pressable>
                    );
                  })}
                </View>

                <Text style={[styles.label, { color: colors.text }]}>{t("sales.buyerContactOptional")}</Text>
                <TextInput
                  value={buyerContact}
                  onChangeText={setBuyerContact}
                  style={inputStyle}
                  placeholder={t("sales.buyerContactPlaceholder")}
                  placeholderTextColor={colors.muted}
                />

                <Text style={[styles.label, { color: colors.text }]}>
                  {t("sales.buyerLicenseOptional")}
                </Text>
                <TextInput
                  value={buyerLicenseId}
                  onChangeText={setBuyerLicenseId}
                  style={inputStyle}
                  placeholder={t("sales.buyerLicensePlaceholder")}
                  placeholderTextColor={colors.muted}
                />

                <Text style={[styles.label, { color: colors.text }]}>{t("sales.saleLocation")}</Text>
                <View style={styles.row}>
                  {SALE_LOCATION_TYPES.map((saleLocationTypeOption) => {
                    const on = saleLocationType === saleLocationTypeOption;
                    return (
                      <Pressable
                        key={saleLocationTypeOption}
                        onPress={() => setSaleLocationType(saleLocationTypeOption)}
                        style={[
                          styles.chip,
                          { borderColor: colors.cardBorder, backgroundColor: colors.cardBg },
                          on && { backgroundColor: colors.primary, borderColor: colors.primary },
                        ]}
                      >
                        <Text style={[{ color: colors.text }, on && styles.chipTextOn]}>{t(`sales.saleLocationTypes.${saleLocationTypeOption}`)}</Text>
                      </Pressable>
                    );
                  })}
                </View>

                <Text style={[styles.label, { color: colors.text }]}>{t("sales.saleLocationNoteOptional")}</Text>
                <TextInput
                  value={saleLocationNote}
                  onChangeText={setSaleLocationNote}
                  style={inputStyle}
                  placeholder={t("sales.saleLocationNotePlaceholder")}
                  placeholderTextColor={colors.muted}
                />

                <Text style={[styles.sectionTitle, { color: colors.text }]}>{t("sales.payment")}</Text>
                <View style={styles.row}>
                  {PAYMENT_METHODS.map((m) => {
                    const on = paymentMethod === m;
                    return (
                      <Pressable
                        key={m}
                        onPress={() => setPaymentMethod(m)}
                        style={[
                          styles.chip,
                          { borderColor: colors.cardBorder, backgroundColor: colors.cardBg },
                          on && { backgroundColor: colors.primary, borderColor: colors.primary },
                        ]}
                      >
                        <Text style={[{ color: colors.text }, on && styles.chipTextOn]}>{t(`sales.paymentMethods.${m}`)}</Text>
                      </Pressable>
                    );
                  })}
                </View>

                <TextInput
                  value={paymentNote}
                  onChangeText={setPaymentNote}
                  placeholder={t("sales.paymentNotePlaceholder")}
                  placeholderTextColor={colors.muted}
                  style={inputStyle}
                />

                {/* keep black */}
                <Pressable onPress={saveSale} style={styles.saveBtn}>
                  <Text style={styles.saveBtnText}>{t("sales.saveSale")}</Text>
                </Pressable>

                <Text style={[styles.sectionTitle, { color: colors.text }]}>
                  {t("sales.tapInventoryToAdd")}
                </Text>
              </View>
            }
            renderItem={({ item }) => {
              const tracked = isTrackedQuantity(item.quantity);
              const available = tracked ? Number(item.quantity ?? 0) : 0;
              const outOfStock = tracked ? available <= 0 : false;

              return (
                <Pressable
                  onPress={() => {
                    if (outOfStock) return;
                    addLine(item);
                  }}
                  style={[
                    styles.invRow,
                    { borderColor: colors.cardBorder, backgroundColor: colors.cardBg },
                    outOfStock && { opacity: 0.55 },
                  ]}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.bold, { color: colors.text }, outOfStock && { color: colors.muted }]}>
                      {item.speciesName}
                    </Text>
                    <Text style={{ color: outOfStock ? colors.muted : colors.text }}>
                      ${item.pricePerUnit}/{weightUnitLabel(item.unit, settings.weightUnit)}
                    </Text>
                    <Text style={[styles.availability, { color: colors.muted }]}>
                      {t("sales.availableValue", { value: tracked ? String(available) : "—" })}
                    </Text>
                  </View>

                  <Text style={[styles.tapToAdd, { color: outOfStock ? "#c62828" : colors.muted, fontWeight: "900" }]}>
                    {outOfStock ? t("sales.out") : t("sales.tapToAdd")}
                  </Text>
                </Pressable>
              );
            }}
          />
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, gap: 10, paddingBottom: 40 },

  title: { fontSize: 22, fontWeight: "900", marginBottom: 8 },
  sectionTitle: { marginTop: 8, fontWeight: "900" },

  label: { fontWeight: "800" },

  input: { borderWidth: 1, borderRadius: 10, padding: 12 },

  row: { flexDirection: "row", gap: 8, flexWrap: "wrap" },
  chip: { borderWidth: 1, borderRadius: 999, paddingVertical: 8, paddingHorizontal: 12 },
  chipTextOn: { color: "white", fontWeight: "900" },

  mutedText: { fontWeight: "700" },

  bold: { fontWeight: "900" },
  smallLabel: { fontSize: 12, fontWeight: "800" },

  cartRow: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
    flexDirection: "row",
    gap: 10,
    alignItems: "center",
  },
  qtyInput: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 10,
    marginTop: 4,
    textAlign: "center",
    fontWeight: "900",
  },
  remove: { marginTop: 6, color: "#c62828", fontWeight: "900" },

  totalBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 10,
    borderTopWidth: 1,
  },

  // keep black
  saveBtn: {
    marginTop: 12,
    backgroundColor: "#111",
    padding: 14,
    borderRadius: 12,
    alignItems: "center",
  },
  saveBtnText: { color: "white", fontWeight: "900" },

  invRow: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 10,
  },
  availability: { marginTop: 2, fontSize: 12, fontWeight: "800" },
  tapToAdd: { opacity: 0.9 },
});
