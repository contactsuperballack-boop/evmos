import React, { useCallback, useState } from "react";
import { View, Text, ScrollView, StyleSheet, ActivityIndicator, RefreshControl } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { api } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { colors, spacing, radius } from "../theme";

export default function AnalyticsScreen({ route }) {
  const { station } = route.params;
  const { token } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const result = await api.getAnalytics(token, station.id);
      setData(result);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [token, station.id]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  function handleRefresh() {
    setRefreshing(true);
    load();
  }

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={colors.teal} />
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ padding: spacing.md }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.teal} />}
    >
      <View style={styles.summaryRow}>
        <SummaryCard label="Sessions" value={String(data.total_sessions)} />
        <SummaryCard label="Revenue" value={`₦${data.total_revenue.toLocaleString()}`} />
        <SummaryCard label="kWh Delivered" value={String(data.total_kwh_delivered)} />
      </View>

      <View style={styles.peakCard}>
        <Text style={styles.peakLabel}>Peak hour</Text>
        <Text style={styles.peakValue}>{data.peak_hour || "Not enough data yet"}</Text>
      </View>

      <Text style={styles.sectionTitle}>By charger</Text>
      {data.sessions_by_charger.length === 0 ? (
        <Text style={styles.mutedText}>No chargers yet.</Text>
      ) : (
        data.sessions_by_charger.map((c) => (
          <View key={c.charger_id} style={styles.chargerRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.chargerType}>{c.connector_type}</Text>
              <Text style={styles.chargerMeta}>{c.session_count} sessions</Text>
            </View>
            <Text style={styles.chargerRevenue}>₦{c.revenue.toLocaleString()}</Text>
          </View>
        ))
      )}
    </ScrollView>
  );
}

function SummaryCard({ label, value }) {
  return (
    <View style={styles.summaryCard}>
      <Text style={styles.summaryValue}>{value}</Text>
      <Text style={styles.summaryLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  centered: { flex: 1, alignItems: "center", justifyContent: "center", padding: spacing.lg },
  mutedText: { color: colors.textMuted, fontSize: 13.5 },
  summaryRow: { flexDirection: "row", gap: spacing.sm, marginBottom: spacing.md },
  summaryCard: {
    flex: 1,
    backgroundColor: colors.navy,
    borderRadius: radius.md,
    padding: spacing.md,
    alignItems: "center",
  },
  summaryValue: { color: colors.amber, fontSize: 18, fontWeight: "800" },
  summaryLabel: { color: "#CFE0DC", fontSize: 10.5, marginTop: 2, textAlign: "center" },
  peakCard: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.lg,
  },
  peakLabel: { fontSize: 11.5, fontWeight: "700", color: colors.textMuted },
  peakValue: { fontSize: 20, fontWeight: "800", color: colors.navy, marginTop: 2 },
  sectionTitle: { fontSize: 15, fontWeight: "700", color: colors.textDark, marginBottom: spacing.sm },
  chargerRow: {
    backgroundColor: colors.card,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.sm,
    flexDirection: "row",
    alignItems: "center",
  },
  chargerType: { fontSize: 14.5, fontWeight: "700", color: colors.textDark },
  chargerMeta: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  chargerRevenue: { fontSize: 15, fontWeight: "800", color: colors.teal },
});
