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

export default function RegisterStationScreen({ navigation }) {
  const { token } = useAuth();
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [lat, setLat] = useState("");
  const [lng, setLng] = useState("");
  const [locating, setLocating] = useState(false);
  const [saving, setSaving] = useState(false);

  async function handleUseCurrentLocation() {
    setLocating(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        Alert.alert("Location permission needed", "Enable location access, or enter coordinates manually.");
        return;
      }
      const pos = await Location.getCurrentPositionAsync({});
      setLat(String(pos.coords.latitude));
      setLng(String(pos.coords.longitude));
    } catch (e) {
      Alert.alert("Couldn't get location", e.message);
    } finally {
      setLocating(false);
    }
  }

  async function handleSave() {
    if (!name.trim() || !lat || !lng) {
      return Alert.alert("Station name and location are required");
    }
    setSaving(true);
    try {
      const station = await api.createStation(token, {
        name: name.trim(),
        address: address.trim() || undefined,
        lat: parseFloat(lat),
        lng: parseFloat(lng),
      });
      navigation.replace("StationManage", { station: { ...station, chargers: [] } });
    } catch (e) {
      Alert.alert("Couldn't register station", e.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: spacing.lg }}>
      <Text style={styles.title}>Register a Station</Text>
      <Text style={styles.subtitle}>
        Listing is free during Phase 1. Add chargers and go live once this is saved.
      </Text>

      <Text style={styles.label}>Station name</Text>
      <TextInput style={styles.input} placeholder="Chidi Motors Charging Bay" value={name} onChangeText={setName} placeholderTextColor={colors.textMuted} />

      <Text style={styles.label}>Address</Text>
      <TextInput style={styles.input} placeholder="Wuse 2, Abuja" value={address} onChangeText={setAddress} placeholderTextColor={colors.textMuted} />

      <Text style={styles.label}>Location</Text>
      <TouchableOpacity style={styles.locateButton} onPress={handleUseCurrentLocation} disabled={locating}>
        {locating ? <ActivityIndicator color={colors.teal} /> : <Text style={styles.locateButtonText}>Use my current location</Text>}
      </TouchableOpacity>

      <View style={styles.coordRow}>
        <View style={{ flex: 1, marginRight: spacing.sm }}>
          <Text style={styles.labelSmall}>Latitude</Text>
          <TextInput style={styles.input} placeholder="9.0765" keyboardType="decimal-pad" value={lat} onChangeText={setLat} placeholderTextColor={colors.textMuted} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.labelSmall}>Longitude</Text>
          <TextInput style={styles.input} placeholder="7.3986" keyboardType="decimal-pad" value={lng} onChangeText={setLng} placeholderTextColor={colors.textMuted} />
        </View>
      </View>

      <TouchableOpacity style={styles.primaryButton} onPress={handleSave} disabled={saving}>
        {saving ? <ActivityIndicator color={colors.white} /> : <Text style={styles.primaryButtonText}>Save station</Text>}
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  title: { fontSize: 22, fontWeight: "800", color: colors.navy },
  subtitle: { fontSize: 13.5, color: colors.textMuted, marginTop: spacing.xs, marginBottom: spacing.lg, lineHeight: 19 },
  label: { fontSize: 13, fontWeight: "600", color: colors.textDark, marginBottom: spacing.xs, marginTop: spacing.sm },
  labelSmall: { fontSize: 11.5, fontWeight: "600", color: colors.textMuted, marginBottom: spacing.xs },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    fontSize: 16,
    color: colors.textDark,
    backgroundColor: colors.card,
  },
  locateButton: {
    borderWidth: 1,
    borderColor: colors.teal,
    borderRadius: radius.sm,
    paddingVertical: 12,
    alignItems: "center",
    marginBottom: spacing.sm,
  },
  locateButtonText: { color: colors.teal, fontWeight: "700", fontSize: 13.5 },
  coordRow: { flexDirection: "row", marginTop: spacing.xs },
  primaryButton: {
    backgroundColor: colors.teal,
    borderRadius: radius.sm,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: spacing.lg,
  },
  primaryButtonText: { color: colors.white, fontWeight: "700", fontSize: 15 },
});
