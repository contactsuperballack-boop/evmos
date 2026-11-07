import React, { useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Linking,
  ActivityIndicator,
  Alert,
} from "react-native";
import { api } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { colors, spacing, radius } from "../theme";

const FAULT_LABELS = {
  wont_charge: "Won't charge",
  battery_warning: "Battery warning",
  wont_start: "Won't start",
  physical_damage: "Physical damage",
  other: "Other issue",
};

export default function ActiveJobScreen({ route, navigation }) {
  const { request } = route.params;
  const { token } = useAuth();
  const [completing, setCompleting] = useState(false);

  function handleNavigateToDriver() {
    const url = `https://www.google.com/maps/search/?api=1&query=${request.lat},${request.lng}`;
    Linking.openURL(url);
  }

  function handleCallDriver() {
    if (!request.driver_phone) return Alert.alert("No phone number on file for this driver");
    Linking.openURL(`tel:${request.driver_phone}`);
  }

  async function handleComplete() {
    setCompleting(true);
    try {
      await api.completeRequest(token, request.id);
      Alert.alert("Job marked complete", "Thanks — back to incoming requests.");
      navigation.replace("IncomingRequests");
    } catch (e) {
      Alert.alert("Couldn't complete job", e.message);
    } finally {
      setCompleting(false);
    }
  }

  return (
    <View style={styles.container}>
      <View style={styles.statusBanner}>
        <Text style={styles.statusText}>● Active job</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.label}>Driver</Text>
        <Text style={styles.value}>{request.driver_name || "Driver"}</Text>

        <Text style={styles.label}>Reported issue</Text>
        <Text style={styles.value}>{FAULT_LABELS[request.fault_type] || request.fault_type}</Text>

        <Text style={styles.label}>Location</Text>
        <Text style={styles.value}>
          {request.lat.toFixed(4)}, {request.lng.toFixed(4)}
        </Text>
      </View>

      <TouchableOpacity style={styles.navigateButton} onPress={handleNavigateToDriver}>
        <Text style={styles.navigateButtonText}>Navigate to driver</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.callButton} onPress={handleCallDriver}>
        <Text style={styles.callButtonText}>Call driver</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.completeButton} onPress={handleComplete} disabled={completing}>
        {completing ? <ActivityIndicator color={colors.white} /> : <Text style={styles.completeButtonText}>Mark job complete</Text>}
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg, padding: spacing.md },
  statusBanner: { backgroundColor: "#E7F3F1", borderRadius: radius.md, padding: spacing.sm, marginBottom: spacing.md, alignSelf: "flex-start", paddingHorizontal: spacing.md },
  statusText: { color: colors.teal, fontWeight: "700", fontSize: 12.5 },
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    marginBottom: spacing.lg,
  },
  label: { fontSize: 11.5, fontWeight: "700", color: colors.textMuted, marginTop: spacing.sm, letterSpacing: 0.5 },
  value: { fontSize: 16, fontWeight: "600", color: colors.textDark, marginTop: 2 },
  navigateButton: { backgroundColor: colors.navy, borderRadius: radius.sm, paddingVertical: 14, alignItems: "center", marginBottom: spacing.sm },
  navigateButtonText: { color: colors.white, fontWeight: "700", fontSize: 15 },
  callButton: { borderWidth: 1, borderColor: colors.teal, borderRadius: radius.sm, paddingVertical: 14, alignItems: "center", marginBottom: spacing.lg },
  callButtonText: { color: colors.teal, fontWeight: "700", fontSize: 15 },
  completeButton: { backgroundColor: colors.teal, borderRadius: radius.sm, paddingVertical: 14, alignItems: "center" },
  completeButtonText: { color: colors.white, fontWeight: "700", fontSize: 15 },
});
