import React, { useCallback, useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  RefreshControl,
  Alert,
  Modal,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { api } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { colors, spacing, radius } from "../theme";

const TOPUP_PRESETS = [1000, 2000, 5000, 10000];

const TRANSACTION_LABELS = {
  top_up: { label: "Wallet top-up", sign: "+" },
  charge_payment: { label: "Charging session", sign: "−" },
  mechanic_payment: { label: "Mechanic callout", sign: "−" },
  marketplace_order: { label: "Marketplace order", sign: "−" },
  payout: { label: "Payout", sign: "−" },
};

export default function WalletScreen({ navigation }) {
  const { token } = useAuth();
  const [wallet, setWallet] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showTopup, setShowTopup] = useState(false);
  const [customAmount, setCustomAmount] = useState("");
  const [toppingUp, setToppingUp] = useState(false);

  const load = useCallback(async () => {
    try {
      const result = await api.getWallet(token);
      setWallet(result);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [token]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  function handleRefresh() {
    setRefreshing(true);
    load();
  }

  async function handleTopup(amount) {
    if (!amount || amount <= 0) return Alert.alert("Enter a valid amount");
    setToppingUp(true);
    try {
      await api.topupWallet(token, amount);
      setShowTopup(false);
      setCustomAmount("");
      await load();
    } catch (e) {
      Alert.alert("Top-up failed", e.message);
    } finally {
      setToppingUp(false);
    }
  }

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={colors.teal} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.balanceCard}>
        <Text style={styles.balanceLabel}>Wallet balance</Text>
        <Text style={styles.balanceValue}>₦{wallet.balance.toLocaleString()}</Text>
        <TouchableOpacity style={styles.topupButton} onPress={() => setShowTopup(true)}>
          <Text style={styles.topupButtonText}>Top up</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => navigation.navigate("Loyalty")}>
          <Text style={styles.loyaltyLink}>View loyalty points →</Text>
        </TouchableOpacity>
        <Text style={styles.simDisclaimer}>
          Phase 2 preview — top-up is simulated, no real payment provider connected yet.
        </Text>
      </View>

      <Text style={styles.sectionTitle}>Transaction history</Text>
      <FlatList
        data={wallet.transactions}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ paddingHorizontal: spacing.md, paddingBottom: spacing.lg }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.teal} />}
        ListEmptyComponent={
          <View style={styles.centered}>
            <Text style={styles.mutedText}>No transactions yet.</Text>
          </View>
        }
        renderItem={({ item }) => {
          const meta = TRANSACTION_LABELS[item.type] || { label: item.type, sign: "" };
          return (
            <View style={styles.txRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.txLabel}>{meta.label}</Text>
                <Text style={styles.txDate}>{new Date(item.created_at).toLocaleString()}</Text>
              </View>
              <Text style={[styles.txAmount, meta.sign === "+" ? styles.txPositive : styles.txNegative]}>
                {meta.sign}₦{item.amount.toLocaleString()}
              </Text>
            </View>
          );
        }}
      />

      <Modal visible={showTopup} transparent animationType="slide" onRequestClose={() => setShowTopup(false)}>
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={styles.modalOverlay}
        >
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Top up wallet</Text>
            <View style={styles.presetRow}>
              {TOPUP_PRESETS.map((amt) => (
                <TouchableOpacity key={amt} style={styles.presetChip} onPress={() => handleTopup(amt)} disabled={toppingUp}>
                  <Text style={styles.presetChipText}>₦{amt.toLocaleString()}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <Text style={styles.label}>Or enter a custom amount</Text>
            <TextInput
              style={styles.input}
              placeholder="Amount in ₦"
              keyboardType="decimal-pad"
              value={customAmount}
              onChangeText={setCustomAmount}
              placeholderTextColor={colors.textMuted}
            />
            <TouchableOpacity
              style={styles.primaryButton}
              onPress={() => handleTopup(parseFloat(customAmount))}
              disabled={toppingUp}
            >
              {toppingUp ? <ActivityIndicator color={colors.white} /> : <Text style={styles.primaryButtonText}>Confirm top-up</Text>}
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setShowTopup(false)} disabled={toppingUp}>
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  centered: { flex: 1, alignItems: "center", justifyContent: "center", padding: spacing.lg },
  mutedText: { color: colors.textMuted },
  balanceCard: {
    backgroundColor: colors.navy,
    margin: spacing.md,
    borderRadius: radius.lg,
    padding: spacing.lg,
    alignItems: "center",
  },
  balanceLabel: { color: "#CFE0DC", fontSize: 13, fontWeight: "600" },
  balanceValue: { color: colors.white, fontSize: 36, fontWeight: "800", marginTop: 4 },
  topupButton: {
    backgroundColor: colors.teal,
    borderRadius: radius.sm,
    paddingVertical: 10,
    paddingHorizontal: 28,
    marginTop: spacing.md,
  },
  topupButtonText: { color: colors.white, fontWeight: "700", fontSize: 14 },
  loyaltyLink: { color: colors.amber, fontSize: 12, fontWeight: "700", marginTop: spacing.md },
  simDisclaimer: { color: "#9FB3CC", fontSize: 10.5, marginTop: spacing.sm, textAlign: "center", fontStyle: "italic" },
  sectionTitle: { fontSize: 15, fontWeight: "700", color: colors.textDark, marginHorizontal: spacing.md, marginBottom: spacing.sm },
  txRow: {
    backgroundColor: colors.card,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.sm,
    flexDirection: "row",
    alignItems: "center",
  },
  txLabel: { fontSize: 14.5, fontWeight: "600", color: colors.textDark },
  txDate: { fontSize: 11.5, color: colors.textMuted, marginTop: 2 },
  txAmount: { fontSize: 15, fontWeight: "800" },
  txPositive: { color: colors.teal },
  txNegative: { color: colors.textDark },
  modalOverlay: { flex: 1, backgroundColor: "rgba(11,31,58,0.5)", justifyContent: "flex-end" },
  modalCard: { backgroundColor: colors.card, borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg, padding: spacing.lg },
  modalTitle: { fontSize: 18, fontWeight: "800", color: colors.navy, marginBottom: spacing.md },
  presetRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: spacing.md },
  presetChip: { backgroundColor: colors.bg, borderRadius: 20, paddingHorizontal: 16, paddingVertical: 8, marginRight: 8, marginBottom: 8 },
  presetChipText: { fontSize: 13.5, fontWeight: "700", color: colors.teal },
  label: { fontSize: 12.5, fontWeight: "600", color: colors.textDark, marginBottom: spacing.xs },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    fontSize: 16,
    color: colors.textDark,
    marginBottom: spacing.md,
  },
  primaryButton: { backgroundColor: colors.teal, borderRadius: radius.sm, paddingVertical: 14, alignItems: "center" },
  primaryButtonText: { color: colors.white, fontWeight: "700", fontSize: 15 },
  cancelText: { color: colors.textMuted, textAlign: "center", marginTop: spacing.md, fontSize: 13.5 },
});
