import React, { useCallback, useState } from "react";
import { View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { api } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { colors, spacing, radius } from "../theme";

export default function MyStationsScreen({ navigation }) {
  const { token, user, signOut } = useAuth();
  const [stations, setStations] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const results = await api.myStations(token);
      setStations(results);
    } finally {
      setLoading(false);
    }
  }, [token]);

  // Reload every time this screen regains focus — e.g. coming back from
  // "Register Station" or "Manage Chargers" so the list is always current.
  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      load();
    }, [load])
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>My Stations</Text>
          {user?.name ? <Text style={styles.headerSubtitle}>{user.name}</Text> : null}
        </View>
        <View style={{ alignItems: "flex-end" }}>
          <TouchableOpacity onPress={signOut}>
            <Text style={styles.signOut}>Sign out</Text>
          </TouchableOpacity>
        </View>
      </View>

      {loading ? (
        <ActivityIndicator size="large" color={colors.teal} style={{ marginTop: spacing.xl }} />
      ) : (
        <FlatList
          data={stations}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ padding: spacing.md }}
          ListEmptyComponent={
            <View style={styles.centered}>
              <Text style={styles.mutedText}>You haven't registered a station yet.</Text>
            </View>
          }
          renderItem={({ item }) => (
            <TouchableOpacity style={styles.card} onPress={() => navigation.navigate("StationManage", { station: item })}>
              <View style={{ flex: 1 }}>
                <Text style={styles.cardTitle}>{item.name}</Text>
                <Text style={styles.cardSubtitle}>{item.address || "No address set"}</Text>
                <View style={styles.badgeRow}>
                  <StatusBadge status={item.status} />
                  <Text style={styles.chargerCount}>
                    {item.chargers.length} charger{item.chargers.length === 1 ? "" : "s"}
                  </Text>
                  {item.average_rating != null ? (
                    <Text style={styles.ratingText}>★ {item.average_rating} ({item.review_count})</Text>
                  ) : null}
                </View>
              </View>
            </TouchableOpacity>
          )}
        />
      )}

      <TouchableOpacity style={styles.fab} onPress={() => navigation.navigate("RegisterStation")}>
        <Text style={styles.fabText}>+ Register Station</Text>
      </TouchableOpacity>
    </View>
  );
}

function StatusBadge({ status }) {
  const isActive = status === "active";
  return (
    <View style={[styles.badge, isActive ? styles.badgeActive : styles.badgePending]}>
      <Text style={[styles.badgeText, isActive ? styles.badgeTextActive : styles.badgeTextPending]}>
        {isActive ? "Live" : "Pending activation"}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  header: {
    backgroundColor: colors.navy,
    padding: spacing.lg,
    paddingTop: spacing.xl,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  headerTitle: { fontSize: 22, fontWeight: "800", color: colors.white },
  headerSubtitle: { fontSize: 13, color: "#CFE0DC", marginTop: 2 },
  signOut: { color: colors.amber, fontSize: 13, fontWeight: "600" },
  centered: { alignItems: "center", justifyContent: "center", padding: spacing.xl },
  mutedText: { color: colors.textMuted, fontSize: 14, textAlign: "center" },
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardTitle: { fontSize: 16, fontWeight: "700", color: colors.textDark },
  cardSubtitle: { fontSize: 12.5, color: colors.textMuted, marginTop: 2, marginBottom: spacing.sm },
  badgeRow: { flexDirection: "row", alignItems: "center" },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20, marginRight: spacing.sm },
  badgeActive: { backgroundColor: "#E7F3F1" },
  badgePending: { backgroundColor: "#FFF3D6" },
  badgeText: { fontSize: 11, fontWeight: "700" },
  badgeTextActive: { color: colors.teal },
  badgeTextPending: { color: "#8A6D00" },
  chargerCount: { fontSize: 12, color: colors.textMuted },
  ratingText: { fontSize: 12, color: colors.amber, fontWeight: "700", marginLeft: spacing.sm },
  fab: {
    position: "absolute",
    bottom: spacing.lg,
    right: spacing.lg,
    left: spacing.lg,
    backgroundColor: colors.teal,
    borderRadius: radius.md,
    paddingVertical: 14,
    alignItems: "center",
  },
  fabText: { color: colors.white, fontWeight: "700", fontSize: 15 },
});
