import React, { useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  ScrollView,
} from "react-native";
import * as Location from "expo-location";
import { api } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { colors, spacing, radius } from "../theme";

const FAULT_TYPES = [
  { key: "wont_charge", label: "Won't charge" },
  { key: "battery_warning", label: "Battery warning" },
  { key: "wont_start", label: "Won't start" },
  { key: "physical_damage", label: "Physical damage" },
  { key: "other", label: "Other issue" },
];

export default function RequestMechanicScreen({ navigation }) {
  const { token } = useAuth();
  const [selectedFault, setSelectedFault] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit() {
    if (!selectedFault) return Alert.alert("Select what's wrong first");
    setSubmitting(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        Alert.alert("Location needed", "We need your location to send a mechanic to you.");
        setSubmitting(false);
        return;
      }
      const pos = await Location.getCurrentPositionAsync({});
      const request = await api.requestMechanic(
        token,
        selectedFault,
        pos.coords.latitude,
        pos.coords.longitude
      );
      navigation.replace("ServiceRequestStatus", { request });
    } catch (e) {
      Alert.alert("Couldn't request a mechanic", e.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: spacing.lg }}>
      <Text style={styles.title}>I need a mechanic</Text>
      <Text style={styles.subtitle}>
        We'll match you with the nearest vetted EV-capable technician and share your location
        with them.
      </Text>

      <Text style={styles.label}>What's wrong?</Text>
      {FAULT_TYPES.map((fault) => (
        <TouchableOpacity
          key={fault.key}
          style={[styles.faultOption, selectedFault === fault.key && styles.faultOptionSelected]}
          onPress={() => setSelectedFault(fault.key)}
        >
          <Text style={[styles.faultOptionText, selectedFault === fault.key && styles.faultOptionTextSelected]}>
            {fault.label}
          </Text>
        </TouchableOpacity>
      ))}

      <TouchableOpacity style={styles.submitButton} onPress={handleSubmit} disabled={submitting}>
        {submitting ? (
          <ActivityIndicator color={colors.white} />
        ) : (
          <Text style={styles.submitButtonText}>Send request with my location</Text>
        )}
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  title: { fontSize: 22, fontWeight: "800", color: colors.navy },
  subtitle: { fontSize: 13.5, color: colors.textMuted, marginTop: spacing.xs, marginBottom: spacing.lg, lineHeight: 19 },
  label: { fontSize: 13, fontWeight: "600", color: colors.textDark, marginBottom: spacing.sm },
  faultOption: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingVertical: 14,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.sm,
    backgroundColor: colors.card,
  },
  faultOptionSelected: { borderColor: colors.teal, backgroundColor: "#E7F3F1" },
  faultOptionText: { fontSize: 15, color: colors.textDark, fontWeight: "600" },
  faultOptionTextSelected: { color: colors.teal },
  submitButton: {
    backgroundColor: colors.teal,
    borderRadius: radius.sm,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: spacing.lg,
  },
  submitButtonText: { color: colors.white, fontWeight: "700", fontSize: 15 },
});
