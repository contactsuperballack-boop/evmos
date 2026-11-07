import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  ScrollView,
} from "react-native";
import { api } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { colors, spacing, radius } from "../theme";

export default function VehicleRegistrationScreen({ navigation, route }) {
  const { token } = useAuth();
  // Reached two ways: first-run (no params, from HomeGate) or editing an
  // existing vehicle (from Profile, route.params = { editing, vehicle }).
  const editing = route?.params?.editing ?? false;
  const existingVehicle = route?.params?.vehicle ?? null;

  const [make, setMake] = useState(existingVehicle?.make ?? "");
  const [model, setModel] = useState(existingVehicle?.model ?? "");
  const [batteryCapacity, setBatteryCapacity] = useState(
    existingVehicle?.battery_capacity_kwh ? String(existingVehicle.battery_capacity_kwh) : ""
  );
  const [year, setYear] = useState(existingVehicle?.year ? String(existingVehicle.year) : "");
  const [loading, setLoading] = useState(false);

  async function handleSave() {
    if (!make.trim() || !model.trim()) {
      return Alert.alert("Make and model are required");
    }
    setLoading(true);
    try {
      const payload = {
        make: make.trim(),
        model: model.trim(),
        battery_capacity_kwh: batteryCapacity ? parseFloat(batteryCapacity) : undefined,
        year: year ? parseInt(year, 10) : undefined,
      };
      if (editing && existingVehicle?.id) {
        // Vehicle profile stays editable per Product Definition v1.0
        // section 3 ("Vehicle data remains editable"). PATCH /vehicles/:id
        // added to the backend in this same pass — see src/routes/vehicles.js.
        await api.updateVehicle(token, existingVehicle.id, payload);
        navigation.goBack();
      } else {
        await api.createVehicle(token, payload);
        navigation.replace("MainTabs");
      }
    } catch (e) {
      Alert.alert("Couldn't save vehicle", e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>{editing ? "Edit your EV" : "Tell us about your EV"}</Text>
      <Text style={styles.subtitle}>
        This helps us route you to the right chargers and connector types. Takes 30 seconds.
      </Text>

      <Text style={styles.label}>Make</Text>
      <TextInput style={styles.input} placeholder="BYD" value={make} onChangeText={setMake} placeholderTextColor={colors.textMuted} />

      <Text style={styles.label}>Model</Text>
      <TextInput style={styles.input} placeholder="Atto 3" value={model} onChangeText={setModel} placeholderTextColor={colors.textMuted} />

      <Text style={styles.label}>Battery capacity (kWh) — optional</Text>
      <TextInput
        style={styles.input}
        placeholder="60.5"
        keyboardType="decimal-pad"
        value={batteryCapacity}
        onChangeText={setBatteryCapacity}
        placeholderTextColor={colors.textMuted}
      />

      <Text style={styles.label}>Year — optional</Text>
      <TextInput
        style={styles.input}
        placeholder="2023"
        keyboardType="number-pad"
        value={year}
        onChangeText={setYear}
        placeholderTextColor={colors.textMuted}
      />

      <TouchableOpacity style={styles.primaryButton} onPress={handleSave} disabled={loading}>
        {loading ? (
          <ActivityIndicator color={colors.white} />
        ) : (
          <Text style={styles.primaryButtonText}>{editing ? "Save changes" : "Save & find chargers"}</Text>
        )}
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.lg, paddingTop: spacing.xl },
  title: { fontSize: 22, fontWeight: "800", color: colors.navy, marginBottom: spacing.xs },
  subtitle: { fontSize: 13.5, color: colors.textMuted, marginBottom: spacing.lg, lineHeight: 19 },
  label: { fontSize: 13, fontWeight: "600", color: colors.textDark, marginBottom: spacing.xs, marginTop: spacing.sm },
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
  primaryButton: {
    backgroundColor: colors.teal,
    borderRadius: radius.sm,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: spacing.lg,
  },
  primaryButtonText: { color: colors.white, fontWeight: "700", fontSize: 15 },
});
