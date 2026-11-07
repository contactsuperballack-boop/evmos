import React, { useCallback, useState } from "react";
import { View, Text, FlatList, StyleSheet, ActivityIndicator, RefreshControl } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { api } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { colors, spacing, radius } from "../theme";

const TIER_LABELS = {
  standard: { label: "Standard", color: colors.textMuted },
  silver: { label: "Silver", color: "#8A8F98" },
  gold: { label: "Gold", color: colors.amber },
};

export default function LoyaltyScreen() {
  const { token } = useAuth();
  const [account, setAccount] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const result = await api.getLoyaltyAccount(token);
      setAccount(result);
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

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={colors.teal} />
      </View>
    );
  }

  const tierInfo = TIER_LABELS[account.tier] || TIER_LABELS.standard;

  return (
    <View style={styles.container}>
      <View style={styles.tierCard}>
        <View style={[styles.tierBadge, { backgroundColor: `${tierInfo.color}22` }]}>
          <Text style={[styles.tierBadgeText, { color: tierInfo.color }]}>{tierInfo.label.toUpperCase()}</Text>
        </View>
        <Text style={styles.pointsValue}>{account.points_balance.toLocaleString()}</Text>
        <Text style={styles.pointsLabel}>points</Text>
        {account.next_tier ? (
          <Text style={styles.nextTierText}>
            {account.next_tier.points_needed.toLocaleString()} points to {account.next_tier.name}
          </Text>
        ) : (
          <Text style={styles.nextTierText}>You've reached the top tier</Text>
        )}
      </View>

      <Text style={styles.sectionTitle}>How you earn points</Text>
      <Text style={styles.earnText}>1 point for every ₦100 you spend on charging.</Text>

      <Text style={styles.sectionTitle}>History</Text>
      <FlatList
        data={account.ledger}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ paddingHorizontal: spacing.md, paddingBottom: spacing.lg }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.teal} />}
        ListEmptyComponent={
          <View style={styles.centered}>
            <Text style={styles.mutedText}>No points earned yet — charge to start earning.</Text>
          </View>
        }
        renderItem={({ item }) => (
          <View style={styles.ledgerRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.ledgerReason}>{item.reason}</Text>
              <Text style={styles.ledgerDate}>{new Date(item.created_at).toLocaleString()}</Text>
            </View>
            <Text style={styles.ledgerPoints}>+{item.points_delta}</Text>
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  centered: { flex: 1, alignItems: "center", justifyContent: "center", padding: spacing.lg },
  mutedText: { color: colors.textMuted },
  tierCard: {
    backgroundColor: colors.navy,
    margin: spacing.md,
    borderRadius: radius.lg,
    padding: spacing.lg,
    alignItems: "center",
  },
  tierBadge: { paddingHorizontal: 14, paddingVertical: 5, borderRadius: 20, marginBottom: spacing.sm },
  tierBadgeText: { fontWeight: "800", fontSize: 11, letterSpacing: 1 },
  pointsValue: { color: colors.white, fontSize: 40, fontWeight: "800" },
  pointsLabel: { color: "#CFE0DC", fontSize: 12, marginTop: -4 },
  nextTierText: { color: "#9FB3CC", fontSize: 12, marginTop: spacing.sm },
  sectionTitle: { fontSize: 14, fontWeight: "700", color: colors.textDark, marginHorizontal: spacing.md, marginTop: spacing.sm, marginBottom: 4 },
  earnText: { fontSize: 12.5, color: colors.textMuted, marginHorizontal: spacing.md, marginBottom: spacing.md },
  ledgerRow: {
    backgroundColor: colors.card,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.sm,
    flexDirection: "row",
    alignItems: "center",
  },
  ledgerReason: { fontSize: 13.5, fontWeight: "600", color: colors.textDark },
  ledgerDate: { fontSize: 11, color: colors.textMuted, marginTop: 2 },
  ledgerPoints: { fontSize: 15, fontWeight: "800", color: colors.teal },
});
