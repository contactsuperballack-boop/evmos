import React, { useCallback, useState } from "react";
import { View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator, RefreshControl, Alert } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { api } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { colors, spacing, radius } from "../theme";

const STATUS_STYLE = {
  active: { label: "Active", color: colors.teal },
  fulfilled: { label: "Fulfilled", color: colors.teal },
  expired: { label: "Expired", color: colors.textMuted },
  cancelled: { label: "Cancelled", color: colors.textMuted },
};

export default function MyHoldsScreen() {
  const { token } = useAuth();
  const [holds, setHolds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [cancellingId, setCancellingId] = useState(null);

  const load = useCallback(async () => {
    try {
      const result = await api.myHolds(token);
      setHolds(result);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [token]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  function handleRefresh() {
    setRefreshing(true);
    load();
  }

  async function handleCancel(holdId) {
    setCancellingId(holdId);
    try {
      await api.cancelHold(token, holdId);
      await load();
    } catch (e) {
      Alert.alert("Couldn't cancel hold", e.message);
    } finally {
      setCancellingId(null);
    }
  }

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={colors.teal} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.disclaimer}>
        Heads-up holds coordinate with other EVMOS drivers only — they can't stop a walk-up
        customer at the station from using the charger.
      </Text>
      <FlatList
        data={holds}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ padding: spacing.md }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.teal} />}
        ListEmptyComponent={
          <View style={styles.centered}>
            <Text style={styles.mutedText}>No holds yet.</Text>
          </View>
        }
        renderItem={({ item }) => {
          const statusInfo = STATUS_STYLE[item.status] || { label: item.status, color: colors.textMuted };
          return (
            <View style={styles.card}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.statusText, { color: statusInfo.color }]}>{statusInfo.label.toUpperCase()}</Text>
                <Text style={styles.metaText}>
                  Until {new Date(item.hold_until).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                </Text>
              </View>
              {item.status === "active" ? (
                <TouchableOpacity style={styles.cancelButton} onPress={() => handleCancel(item.id)} disabled={cancellingId === item.id}>
                  {cancellingId === item.id ? (
                    <ActivityIndicator color={colors.white} size="small" />
                  ) : (
                    <Text style={styles.cancelButtonText}>Cancel</Text>
                  )}
                </TouchableOpacity>
              ) : null}
            </View>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  centered: { flex: 1, alignItems: "center", justifyContent: "center", padding: spacing.lg },
  mutedText: { color: colors.textMuted },
  disclaimer: { fontSize: 11, color: colors.textMuted, fontStyle: "italic", padding: spacing.md, paddingBottom: 0 },
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.sm,
    flexDirection: "row",
    alignItems: "center",
  },
  statusText: { fontSize: 12, fontWeight: "800", letterSpacing: 0.5 },
  metaText: { fontSize: 12.5, color: colors.textMuted, marginTop: 2 },
  cancelButton: { backgroundColor: colors.danger, borderRadius: radius.sm, paddingVertical: 8, paddingHorizontal: 14 },
  cancelButtonText: { color: colors.white, fontWeight: "700", fontSize: 12 },
});
