import { ThemeContext } from "@/theme/ThemeProvider";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useContext, useMemo, useState } from "react";
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
import { InventoryItem } from "@/types/inventory";
import { BuyerType, PaymentMethod, Sale, SaleLine } from "@/types/sales";
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
const PAYMENT_METHODS: PaymentMethod[] = ["CASH", "PAYPAL", "CASHAPP", "VENMO", "OTHER"];
const SALE_LOCATION_TYPES: NonNullable<Sale["saleLocationType"]>[] = ["TRUCK", "HOME", "DOCK", "OTHER"];

export default function NewSaleScreen() {
  const { colors } = useContext(ThemeContext);

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

  const resetForm = useCallback(() => {
    setLines([]);
    setPaymentMethod("CASH");
    setPaymentNote("");
    setBuyerName("");
    setBuyerType("RESTAURANT");
    setBuyerContact("");
    setBuyerLicenseId("");
    setSaleLocationType("TRUCK");
    setSaleLocationNote("");
  }, []);

  const loadAll = useCallback(() => {
    let mounted = true;

    Promise.all([
      loadJSON<InventoryItem[]>(STORAGE_KEYS.INVENTORY, []),
      loadJSON<boolean>(STORAGE_KEYS.INSPECTION_MODE, false),
    ]).then(([inv, mode]) => {
      if (!mounted) return;

      setInventory(inv);
      setInspectionMode(!!mode);

      if (mode) {
        Alert.alert(
          "Inspection Mode",
          "Sales creation is disabled in read-only inspection mode."
        );
        router.replace("/(tabs)/sales");
      } else {
        resetForm();
      }
    });

    return () => {
      mounted = false;
    };
  }, [resetForm]);

  useFocusEffect(loadAll);

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
      Alert.alert("Add at least one item", "Tap an inventory item to add it to the sale.");
      return;
    }

    const trimmedBuyer = buyerName.trim();
    if (!trimmedBuyer) {
      Alert.alert("Buyer required", "Enter the buyer name for compliance records.");
      return;
    }

    const badQty = lines.find((l) => !Number.isFinite(l.quantity) || l.quantity <= 0);
    if (badQty) {
      Alert.alert("Invalid quantity", `Fix quantity for ${badQty.speciesName}.`);
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
      const available = inv?.quantity ?? 0;
      Alert.alert(
        "Not enough inventory",
        `${oversold.speciesName}: trying to sell ${oversold.quantity}, available ${available}.`
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
    };

    const existingSales = await loadJSON<Sale[]>(STORAGE_KEYS.SALES, []);
    await saveJSON(STORAGE_KEYS.SALES, [sale, ...existingSales]);

    resetForm();
    router.replace("/(tabs)/sales");
  }

  const inputStyle = [
    styles.input,
    { borderColor: colors.cardBorder, backgroundColor: colors.cardBg, color: colors.text },
  ] as const;

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
          <Text style={[styles.title, { color: colors.text }]}>New Sale</Text>

          <FlatList
            data={inventory}
            keyExtractor={(i) => i.id}
            scrollEnabled={false}
            ListEmptyComponent={
              <Text style={[styles.mutedText, { color: colors.muted }]}>
                No inventory yet. Add fish first.
              </Text>
            }
            ListHeaderComponent={
              <View style={{ gap: 10 }}>
                <Text style={[styles.sectionTitle, { color: colors.text }]}>Cart</Text>

                {lines.length === 0 ? (
                  <Text style={[styles.mutedText, { color: colors.muted }]}>
                    No items yet. Add from inventory below.
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
                            ${line.unitPrice}/{line.unit}
                          </Text>
                        </View>

                        <View style={{ width: 70 }}>
                          <Text style={[styles.smallLabel, { color: colors.muted }]}>Qty</Text>
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
                          <Text style={[styles.smallLabel, { color: colors.muted }]}>Subtotal</Text>
                          <Text style={[styles.bold, { color: colors.text }]}>
                            ${line.subtotal.toFixed(2)}
                          </Text>
                          <Pressable onPress={() => removeLine(line.itemId)}>
                            <Text style={styles.remove}>Remove</Text>
                          </Pressable>
                        </View>
                      </View>
                    ))}
                  </View>
                )}

                <View style={[styles.totalBar, { borderColor: colors.cardBorder }]}>
                  <Text style={[styles.bold, { color: colors.text }]}>Total</Text>
                  <Text style={[styles.bold, { color: colors.text }]}>${total.toFixed(2)}</Text>
                </View>

                <Text style={[styles.label, { color: colors.text }]}>Buyer name</Text>
                <TextInput
                  value={buyerName}
                  onChangeText={setBuyerName}
                  style={inputStyle}
                  placeholder="Joe’s Fish House"
                  placeholderTextColor={colors.muted}
                />

                <Text style={[styles.label, { color: colors.text }]}>Buyer type</Text>
                <View style={styles.row}>
                  {BUYER_TYPES.map((t) => {
                    const on = buyerType === t;
                    return (
                      <Pressable
                        key={t}
                        onPress={() => setBuyerType(t)}
                        style={[
                          styles.chip,
                          { borderColor: colors.cardBorder, backgroundColor: colors.cardBg },
                          on && { backgroundColor: colors.primary, borderColor: colors.primary },
                        ]}
                      >
                        <Text style={[{ color: colors.text }, on && styles.chipTextOn]}>{t}</Text>
                      </Pressable>
                    );
                  })}
                </View>

                <Text style={[styles.label, { color: colors.text }]}>Buyer contact (optional)</Text>
                <TextInput
                  value={buyerContact}
                  onChangeText={setBuyerContact}
                  style={inputStyle}
                  placeholder="phone or email"
                  placeholderTextColor={colors.muted}
                />

                <Text style={[styles.label, { color: colors.text }]}>
                  Buyer license / business ID (optional)
                </Text>
                <TextInput
                  value={buyerLicenseId}
                  onChangeText={setBuyerLicenseId}
                  style={inputStyle}
                  placeholder="License # / permit # / EIN"
                  placeholderTextColor={colors.muted}
                />

                <Text style={[styles.label, { color: colors.text }]}>Sale location</Text>
                <View style={styles.row}>
                  {SALE_LOCATION_TYPES.map((t) => {
                    const on = saleLocationType === t;
                    return (
                      <Pressable
                        key={t}
                        onPress={() => setSaleLocationType(t)}
                        style={[
                          styles.chip,
                          { borderColor: colors.cardBorder, backgroundColor: colors.cardBg },
                          on && { backgroundColor: colors.primary, borderColor: colors.primary },
                        ]}
                      >
                        <Text style={[{ color: colors.text }, on && styles.chipTextOn]}>{t}</Text>
                      </Pressable>
                    );
                  })}
                </View>

                <Text style={[styles.label, { color: colors.text }]}>Sale location note (optional)</Text>
                <TextInput
                  value={saleLocationNote}
                  onChangeText={setSaleLocationNote}
                  style={inputStyle}
                  placeholder='e.g. "Waukegan harbor parking lot"'
                  placeholderTextColor={colors.muted}
                />

                <Text style={[styles.sectionTitle, { color: colors.text }]}>Payment</Text>
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
                        <Text style={[{ color: colors.text }, on && styles.chipTextOn]}>{m}</Text>
                      </Pressable>
                    );
                  })}
                </View>

                <TextInput
                  value={paymentNote}
                  onChangeText={setPaymentNote}
                  placeholder="Payment note (optional) e.g. CashApp $handle, PayPal ref"
                  placeholderTextColor={colors.muted}
                  style={inputStyle}
                />

                {/* keep black */}
                <Pressable onPress={saveSale} style={styles.saveBtn}>
                  <Text style={styles.saveBtnText}>Save Sale</Text>
                </Pressable>

                <Text style={[styles.sectionTitle, { color: colors.text }]}>
                  Tap inventory to add
                </Text>
              </View>
            }
            renderItem={({ item }) => {
              const tracked = isTrackedQuantity(item.quantity);
              const available = tracked ? item.quantity : null;
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
                      ${item.pricePerUnit}/{item.unit}
                    </Text>
                    <Text style={[styles.availability, { color: colors.muted }]}>
                      Available: {tracked ? String(available) : "—"}
                    </Text>
                  </View>

                  <Text style={[styles.tapToAdd, { color: outOfStock ? "#c62828" : colors.muted, fontWeight: "900" }]}>
                    {outOfStock ? "Out" : "Tap to add"}
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
