import React, { useCallback, useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Alert,
  Switch,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { api } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { colors, spacing, radius } from "../theme";

const WAIT_PRESETS = [0, 5, 15, 30, 45];

export default function StationManageScreen({ route, navigation }) {
  const { token } = useAuth();
  const [station, setStation] = useState(route.params.station);
  const [chargers, setChargers] = useState(route.params.station.chargers || []);
  const [showAddCharger, setShowAddCharger] = useState(false);
  const [connectorType, setConnectorType] = useState("");
  const [price, setPrice] = useState("");
  const [savingCharger, setSavingCharger] = useState(false);
  const [activating, setActivating] = useState(false);
  // Featured Listing (Boost this station) UI intentionally removed here —
  // hardening/scope-reduction pass. Backend endpoint and screen logic are
  // untouched; see HARDENING_AND_SCOPE.md for why "hide, don't delete"
  // applies but this one isn't reachable at all right now, unlike Wallet
  // in the Driver App which stayed reachable for a real P1 dependency
  // (Store checkout). There's no equivalent P1 reason for Featured Listing
  // to be reachable — it's Phase 2 monetization per every source doc.

  const refresh = useCallback(async () => {
    const mine = await api.myStations(token);
    const updated = mine.find((s) => s.id === station.id);
    if (updated) {
      setStation(updated);
      setChargers(updated.chargers);
    }
  }, [token, station.id]);

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh])
  );

  async function handleAddCharger() {
    if (!connectorType.trim() || !price) {
      return Alert.alert("Connector type and price are required");
    }
    setSavingCharger(true);
    try {
      await api.addCharger(token, station.id, {
        connector_type: connectorType.trim(),
        price_per_kwh: parseFloat(price),
      });
      setConnectorType("");
      setPrice("");
      setShowAddCharger(false);
      await refresh();
    } catch (e) {
      Alert.alert("Couldn't add charger", e.message);
    } finally {
      setSavingCharger(false);
    }
  }

  async function handleSetWait(chargerId, minutes) {
    try {
      await api.updateQueue(token, chargerId, minutes);
      await refresh();
    } catch (e) {
      Alert.alert("Couldn't update queue", e.message);
    }
  }

  async function handleToggleAvailable(chargerId, value) {
    try {
      await api.updateCharger(token, chargerId, { is_available: value ? 1 : 0 });
      await refresh();
    } catch (e) {
      Alert.alert("Couldn't update charger", e.message);
    }
  }

  async function handleActivate() {
    setActivating(true);
    try {
      await api.activateStation(token, station.id);
      await refresh();
      Alert.alert("Station is live", "Drivers can now find this station in search.");
    } catch (e) {
      Alert.alert("Couldn't activate station", e.message);
    } finally {
      setActivating(false);
    }
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: spacing.md }}>
      <Text style={styles.title}>{station.name}</Text>
      <Text style={styles.subtitle}>{station.address || "No address set"}</Text>

      {station.status !== "active" ? (
        <View style={styles.pendingBanner}>
          <Text style={styles.pendingText}>
            Not visible to drivers yet. Add at least one charger, then activate.
          </Text>
          <TouchableOpacity style={styles.activateButton} onPress={handleActivate} disabled={activating || chargers.length === 0}>
            {activating ? <ActivityIndicator color={colors.white} /> : <Text style={styles.activateButtonText}>Activate Station</Text>}
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.liveBanner}>
          <Text style={styles.liveText}>● Live — visible to drivers nearby</Text>
        </View>
      )}

      <View style={styles.sectionHeaderRow}>
        <Text style={styles.sectionTitle}>Chargers & Queue</Text>
        <TouchableOpacity onPress={() => setShowAddCharger((v) => !v)}>
          <Text style={styles.addLink}>{showAddCharger ? "Cancel" : "+ Add charger"}</Text>
        </TouchableOpacity>
      </View>

      {showAddCharger && (
        <View style={styles.addCard}>
          <Text style={styles.label}>Connector type</Text>
          <TextInput style={styles.input} placeholder="Type2 / CCS / CHAdeMO" value={connectorType} onChangeText={setConnectorType} placeholderTextColor={colors.textMuted} />
          <Text style={styles.label}>Price per kWh (₦)</Text>
          <TextInput style={styles.input} placeholder="225" keyboardType="decimal-pad" value={price} onChangeText={setPrice} placeholderTextColor={colors.textMuted} />
          <TouchableOpacity style={styles.primaryButton} onPress={handleAddCharger} disabled={savingCharger}>
            {savingCharger ? <ActivityIndicator color={colors.white} /> : <Text style={styles.primaryButtonText}>Save charger</Text>}
          </TouchableOpacity>
        </View>
      )}

      {chargers.length === 0 && !showAddCharger ? (
        <Text style={styles.mutedText}>No chargers yet — add one to get this station live.</Text>
      ) : (
        chargers.map((charger) => (
          <View key={charger.id} style={styles.chargerCard}>
            <View style={styles.chargerHeaderRow}>
              <Text style={styles.chargerType}>{charger.connector_type}</Text>
              <View style={styles.availRow}>
                <Text style={styles.availLabel}>{charger.is_available ? "Available" : "Offline"}</Text>
                <Switch
                  value={!!charger.is_available}
                  onValueChange={(v) => handleToggleAvailable(charger.id, v)}
                  trackColor={{ true: colors.teal, false: colors.border }}
                />
              </View>
            </View>
            <Text style={styles.chargerPrice}>₦{charger.price_per_kwh}/kWh</Text>

            <Text style={styles.waitLabel}>Current wait time</Text>
            <View style={styles.waitPresetRow}>
              {WAIT_PRESETS.map((min) => (
                <TouchableOpacity key={min} style={styles.waitPreset} onPress={() => handleSetWait(charger.id, min)}>
                  <Text style={styles.waitPresetText}>{min === 0 ? "No queue" : `${min}m`}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        ))
      )}

      <TouchableOpacity style={styles.paymentLogLink} onPress={() => navigation.navigate("PaymentLog", { station })}>
        <Text style={styles.paymentLogLinkText}>View charging / payment log →</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.paymentLogLink} onPress={() => navigation.navigate("Analytics", { station })}>
        <Text style={styles.paymentLogLinkText}>View analytics →</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  title: { fontSize: 22, fontWeight: "800", color: colors.navy },
  subtitle: { fontSize: 13.5, color: colors.textMuted, marginTop: 2, marginBottom: spacing.md },
  pendingBanner: { backgroundColor: "#FFF3D6", borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.md },
  pendingText: { fontSize: 12.5, color: "#8A6D00", marginBottom: spacing.sm },
  activateButton: { backgroundColor: colors.navy, borderRadius: radius.sm, paddingVertical: 10, alignItems: "center" },
  activateButtonText: { color: colors.white, fontWeight: "700", fontSize: 13.5 },
  liveBanner: { backgroundColor: "#E7F3F1", borderRadius: radius.md, padding: spacing.sm, marginBottom: spacing.md },
  liveText: { color: colors.teal, fontWeight: "700", fontSize: 12.5 },
  sectionHeaderRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: spacing.sm, marginBottom: spacing.sm },
  sectionTitle: { fontSize: 16, fontWeight: "700", color: colors.textDark },
  addLink: { color: colors.teal, fontWeight: "700", fontSize: 13 },
  addCard: { backgroundColor: colors.card, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, padding: spacing.md, marginBottom: spacing.md },
  label: { fontSize: 12.5, fontWeight: "600", color: colors.textDark, marginBottom: spacing.xs, marginTop: spacing.xs },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    fontSize: 15,
    color: colors.textDark,
    backgroundColor: colors.bg,
  },
  primaryButton: { backgroundColor: colors.teal, borderRadius: radius.sm, paddingVertical: 12, alignItems: "center", marginTop: spacing.sm },
  primaryButtonText: { color: colors.white, fontWeight: "700", fontSize: 14 },
  mutedText: { color: colors.textMuted, fontSize: 13.5 },
  chargerCard: { backgroundColor: colors.card, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, padding: spacing.md, marginBottom: spacing.sm },
  chargerHeaderRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  chargerType: { fontSize: 15.5, fontWeight: "700", color: colors.textDark },
  availRow: { flexDirection: "row", alignItems: "center" },
  availLabel: { fontSize: 11.5, color: colors.textMuted, marginRight: 6 },
  chargerPrice: { fontSize: 13, color: colors.textMuted, marginTop: 2, marginBottom: spacing.sm },
  waitLabel: { fontSize: 11.5, fontWeight: "600", color: colors.textMuted, marginBottom: 6 },
  waitPresetRow: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  waitPreset: { backgroundColor: colors.bg, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, marginRight: 6, marginBottom: 6 },
  waitPresetText: { fontSize: 12, fontWeight: "600", color: colors.textDark },
  paymentLogLink: { marginTop: spacing.md, alignItems: "center" },
  paymentLogLinkText: { color: colors.teal, fontWeight: "700", fontSize: 13.5 },
});
