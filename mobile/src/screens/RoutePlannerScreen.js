import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Alert,
} from "react-native";
import * as Location from "expo-location";
import { api } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { colors, spacing, radius } from "../theme";

export default function RoutePlannerScreen({ navigation }) {
  const { token } = useAuth();
  const [originLat, setOriginLat] = useState("");
  const [originLng, setOriginLng] = useState("");
  const [destLat, setDestLat] = useState("");
  const [destLng, setDestLng] = useState("");
  const [range, setRange] = useState("");
  const [locating, setLocating] = useState(false);
  const [planning, setPlanning] = useState(false);
  const [result, setResult] = useState(null);

  async function handleUseCurrentLocation() {
    setLocating(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        Alert.alert("Location permission needed", "Enable location access, or enter coordinates manually.");
        return;
      }
      const pos = await Location.getCurrentPositionAsync({});
      setOriginLat(String(pos.coords.latitude));
      setOriginLng(String(pos.coords.longitude));
    } catch (e) {
      Alert.alert("Couldn't get location", e.message);
    } finally {
      setLocating(false);
    }
  }

  async function handlePlan() {
    if (!originLat || !originLng || !destLat || !destLng || !range) {
      return Alert.alert("Fill in origin, destination, and your remaining range first");
    }
    setPlanning(true);
    setResult(null);
    try {
      const plan = await api.planRoute(
        token,
        parseFloat(originLat),
        parseFloat(originLng),
        parseFloat(destLat),
        parseFloat(destLng),
        parseFloat(range)
      );
      setResult(plan);
    } catch (e) {
      Alert.alert("Couldn't plan route", e.message);
    } finally {
      setPlanning(false);
    }
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: spacing.lg }}>
      <Text style={styles.title}>Route Planner</Text>
      <Text style={styles.disclaimer}>
        Distances here are straight-line estimates, not real road distance — actual driving
        distance will usually be longer. Use Navigate for real turn-by-turn directions once
        you've picked a stop.
      </Text>

      <Text style={styles.label}>Origin</Text>
      <TouchableOpacity style={styles.locateButton} onPress={handleUseCurrentLocation} disabled={locating}>
        {locating ? <ActivityIndicator color={colors.teal} /> : <Text style={styles.locateButtonText}>Use my current location</Text>}
      </TouchableOpacity>
      <View style={styles.coordRow}>
        <TextInput style={[styles.input, styles.coordInput]} placeholder="Latitude" keyboardType="decimal-pad" value={originLat} onChangeText={setOriginLat} placeholderTextColor={colors.textMuted} />
        <TextInput style={[styles.input, styles.coordInput]} placeholder="Longitude" keyboardType="decimal-pad" value={originLng} onChangeText={setOriginLng} placeholderTextColor={colors.textMuted} />
      </View>

      <Text style={[styles.label, { marginTop: spacing.md }]}>Destination</Text>
      <Text style={styles.hint}>No address search yet — enter coordinates directly for now.</Text>
      <View style={styles.coordRow}>
        <TextInput style={[styles.input, styles.coordInput]} placeholder="Latitude" keyboardType="decimal-pad" value={destLat} onChangeText={setDestLat} placeholderTextColor={colors.textMuted} />
        <TextInput style={[styles.input, styles.coordInput]} placeholder="Longitude" keyboardType="decimal-pad" value={destLng} onChangeText={setDestLng} placeholderTextColor={colors.textMuted} />
      </View>

      <Text style={[styles.label, { marginTop: spacing.md }]}>Remaining range (km)</Text>
      <TextInput style={styles.input} placeholder="e.g. 40" keyboardType="decimal-pad" value={range} onChangeText={setRange} placeholderTextColor={colors.textMuted} />

      <TouchableOpacity style={styles.primaryButton} onPress={handlePlan} disabled={planning}>
        {planning ? <ActivityIndicator color={colors.white} /> : <Text style={styles.primaryButtonText}>Plan route</Text>}
      </TouchableOpacity>

      {result ? (
        <View style={styles.resultCard}>
          <Text style={styles.resultDistance}>{result.direct_distance_km} km (straight-line)</Text>
          {result.needs_charging_stop ? (
            <>
              <Text style={styles.resultNeedsStop}>You'll likely need a charging stop for this trip.</Text>
              {result.suggested_stops.length === 0 ? (
                <Text style={styles.mutedText}>No reachable stations found within your stated range.</Text>
              ) : (
                result.suggested_stops.map((stop) => (
                  <TouchableOpacity
                    key={stop.id}
                    style={styles.stopCard}
                    onPress={() => navigation.navigate("StationDetail", { station: stop })}
                  >
                    <Text style={styles.stopName}>{stop.name}</Text>
                    <Text style={styles.stopMeta}>
                      {stop.distance_km} km from origin · {stop.detour_km} km detour
                    </Text>
                  </TouchableOpacity>
                ))
              )}
            </>
          ) : (
            <Text style={styles.resultNoStop}>✓ Your remaining range comfortably covers this trip — no stop needed.</Text>
          )}
        </View>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  title: { fontSize: 22, fontWeight: "800", color: colors.navy },
  disclaimer: { fontSize: 11.5, color: colors.textMuted, fontStyle: "italic", marginTop: spacing.xs, marginBottom: spacing.lg, lineHeight: 16 },
  label: { fontSize: 13, fontWeight: "600", color: colors.textDark, marginBottom: spacing.xs },
  hint: { fontSize: 11, color: colors.textMuted, marginBottom: spacing.xs },
  locateButton: { borderWidth: 1, borderColor: colors.teal, borderRadius: radius.sm, paddingVertical: 10, alignItems: "center", marginBottom: spacing.sm },
  locateButtonText: { color: colors.teal, fontWeight: "700", fontSize: 13 },
  coordRow: { flexDirection: "row", gap: spacing.sm },
  coordInput: { flex: 1 },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    fontSize: 15,
    color: colors.textDark,
    backgroundColor: colors.card,
  },
  primaryButton: { backgroundColor: colors.teal, borderRadius: radius.sm, paddingVertical: 14, alignItems: "center", marginTop: spacing.lg },
  primaryButtonText: { color: colors.white, fontWeight: "700", fontSize: 15 },
  resultCard: { backgroundColor: colors.card, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, padding: spacing.lg, marginTop: spacing.lg },
  resultDistance: { fontSize: 20, fontWeight: "800", color: colors.navy },
  resultNeedsStop: { fontSize: 13, color: "#8A6D00", fontWeight: "600", marginTop: spacing.sm, marginBottom: spacing.sm },
  resultNoStop: { fontSize: 13, color: colors.teal, fontWeight: "600", marginTop: spacing.sm },
  mutedText: { color: colors.textMuted, fontSize: 12.5 },
  stopCard: { backgroundColor: colors.bg, borderRadius: radius.sm, padding: spacing.md, marginBottom: spacing.sm },
  stopName: { fontSize: 14.5, fontWeight: "700", color: colors.textDark },
  stopMeta: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
});
