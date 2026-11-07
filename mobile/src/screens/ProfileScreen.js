import React, { useCallback, useState } from "react";
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { api } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { colors, spacing, radius } from "../theme";

// Profile tab per Product Definition v1.0 section 12: "Vehicle, account,
// settings and support." Wallet and Loyalty moved here from the Find
// Chargers header per the scope-reduction decision — they're account-level
// concerns, not part of the core Charge journey.
export default function ProfileScreen({ navigation }) {
  const { user, signOut } = useAuth();
  const { token } = useAuth();
  const [vehicle, setVehicle] = useState(null);
  const [loading, setLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      (async () => {
        try {
          const vehicles = await api.listVehicles(token);
          if (!cancelled) setVehicle(vehicles[0] || null);
        } finally {
          if (!cancelled) setLoading(false);
        }
      })();
      return () => {
        cancelled = true;
      };
    }, [token])
  );

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: spacing.md }}>
      <Text style={styles.sectionLabel}>Vehicle</Text>
      <TouchableOpacity
        style={styles.card}
        onPress={() => navigation.navigate("VehicleRegistration", { editing: true, vehicle })}
      >
        {loading ? (
          <ActivityIndicator color={colors.teal} />
        ) : vehicle ? (
          <View>
            <Text style={styles.cardTitle}>{vehicle.make} {vehicle.model}</Text>
            <Text style={styles.cardMeta}>
              {vehicle.year ? `${vehicle.year} · ` : ""}{vehicle.battery_capacity_kwh} kWh battery
            </Text>
          </View>
        ) : (
          <Text style={styles.cardTitle}>Add your vehicle</Text>
        )}
        <Text style={styles.chevron}>›</Text>
      </TouchableOpacity>

      <Text style={styles.sectionLabel}>Account</Text>
      <TouchableOpacity style={styles.card} onPress={() => navigation.navigate("Wallet")}>
        <Text style={styles.cardTitle}>Wallet</Text>
        <Text style={styles.chevron}>›</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.card} onPress={() => navigation.navigate("Loyalty")}>
        <Text style={styles.cardTitle}>Loyalty Points</Text>
        <Text style={styles.chevron}>›</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.signOutButton} onPress={signOut}>
        <Text style={styles.signOutText}>Sign out</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  sectionLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.textMuted,
    textTransform: "uppercase",
    marginTop: spacing.md,
    marginBottom: spacing.xs,
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.sm,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  cardTitle: { fontSize: 15, fontWeight: "700", color: colors.textDark },
  cardMeta: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  chevron: { fontSize: 20, color: colors.textMuted },
  signOutButton: {
    marginTop: spacing.lg,
    alignItems: "center",
    paddingVertical: 14,
  },
  signOutText: { color: "#C0392B", fontWeight: "700", fontSize: 14 },
});
