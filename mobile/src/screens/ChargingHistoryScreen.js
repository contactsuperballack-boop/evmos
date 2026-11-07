import React, { useEffect, useState } from "react";
import { View, Text, FlatList, StyleSheet, ActivityIndicator } from "react-native";
import { api } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { colors, spacing, radius } from "../theme";

export default function ChargingHistoryScreen() {
  const { token } = useAuth();
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .listSessions(token)
      .then(setSessions)
      .finally(() => setLoading(false));
  }, [token]);

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={colors.teal} />
      </View>
    );
  }

  return (
    <FlatList
      style={styles.container}
      contentContainerStyle={{ padding: spacing.md }}
      data={sessions}
      keyExtractor={(item) => item.id}
      ListEmptyComponent={
        <View style={styles.centered}>
          <Text style={styles.mutedText}>No charging sessions yet.</Text>
        </View>
      }
      renderItem={({ item }) => (
        <View style={styles.card}>
          <Text style={styles.date}>{new Date(item.started_at).toLocaleString()}</Text>
          <Text style={styles.status}>{item.ended_at ? "Completed" : "In progress"}</Text>
          {item.kwh_estimate ? <Text style={styles.kwh}>~{item.kwh_estimate} kWh</Text> : null}
        </View>
      )}
    />
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  centered: { flex: 1, alignItems: "center", justifyContent: "center", padding: spacing.lg },
  mutedText: { color: colors.textMuted },
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  date: { fontSize: 14, fontWeight: "600", color: colors.textDark },
  status: { fontSize: 12.5, color: colors.textMuted, marginTop: 2 },
  kwh: { fontSize: 12.5, color: colors.teal, marginTop: 2, fontWeight: "600" },
});
