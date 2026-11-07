import React, { useEffect, useState } from "react";
import { View, Text, FlatList, StyleSheet, ActivityIndicator } from "react-native";
import { api } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { colors, spacing, radius } from "../theme";

export default function PaymentLogScreen({ route }) {
  const { station } = route.params;
  const { token } = useAuth();
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .stationSessions(token, station.id)
      .then(setSessions)
      .finally(() => setLoading(false));
  }, [token, station.id]);

  const totalKwh = sessions.reduce((sum, s) => sum + (s.kwh_estimate || 0), 0);
  const totalRevenue = sessions.reduce((sum, s) => sum + (s.kwh_estimate || 0) * (s.price_per_kwh || 0), 0);

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={colors.teal} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.summaryCard}>
        <SummaryStat label="Sessions" value={String(sessions.length)} />
        <SummaryStat label="Est. kWh" value={totalKwh.toFixed(1)} />
        <SummaryStat label="Est. Revenue" value={`₦${totalRevenue.toFixed(0)}`} />
      </View>
      <Text style={styles.disclaimer}>
        Manual reconciliation for Phase 1 — in-app payment collection arrives in Phase 2.
      </Text>

      <FlatList
        data={sessions}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ padding: spacing.md }}
        ListEmptyComponent={
          <View style={styles.centered}>
            <Text style={styles.mutedText}>No charging sessions logged yet.</Text>
          </View>
        }
        renderItem={({ item }) => (
          <View style={styles.row}>
            <View style={{ flex: 1 }}>
              <Text style={styles.driverName}>{item.driver_name || item.driver_phone}</Text>
              <Text style={styles.meta}>{new Date(item.started_at).toLocaleString()} · {item.connector_type}</Text>
            </View>
            <View style={{ alignItems: "flex-end" }}>
              <Text style={styles.amount}>
                {item.kwh_estimate ? `₦${(item.kwh_estimate * item.price_per_kwh).toFixed(0)}` : "—"}
              </Text>
              <Text style={styles.meta}>{item.ended_at ? "Completed" : "In progress"}</Text>
            </View>
          </View>
        )}
      />
    </View>
  );
}

function SummaryStat({ label, value }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  centered: { flex: 1, alignItems: "center", justifyContent: "center", padding: spacing.lg },
  mutedText: { color: colors.textMuted },
  summaryCard: {
    flexDirection: "row",
    backgroundColor: colors.navy,
    margin: spacing.md,
    marginBottom: spacing.xs,
    borderRadius: radius.md,
    padding: spacing.md,
    justifyContent: "space-around",
  },
  stat: { alignItems: "center" },
  statValue: { color: colors.amber, fontSize: 20, fontWeight: "800" },
  statLabel: { color: "#CFE0DC", fontSize: 11, marginTop: 2 },
  disclaimer: { fontSize: 11, color: colors.textMuted, textAlign: "center", fontStyle: "italic", marginTop: spacing.sm },
  row: {
    backgroundColor: colors.card,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.sm,
    flexDirection: "row",
    justifyContent: "space-between",
  },
  driverName: { fontSize: 14.5, fontWeight: "700", color: colors.textDark },
  meta: { fontSize: 11.5, color: colors.textMuted, marginTop: 2 },
  amount: { fontSize: 15, fontWeight: "800", color: colors.teal },
});
