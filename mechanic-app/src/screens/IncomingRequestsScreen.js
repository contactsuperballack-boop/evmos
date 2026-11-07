import React, { useCallback, useState } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
  Alert,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import * as Location from "expo-location";
import { api } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { colors, spacing, radius } from "../theme";

const FALLBACK = { latitude: 9.0765, longitude: 7.3986 };

const FAULT_LABELS = {
  wont_charge: "Won't charge",
  battery_warning: "Battery warning",
  wont_start: "Won't start",
  physical_damage: "Physical damage",
  other: "Other issue",
};

export default function IncomingRequestsScreen({ navigation }) {
  const { token, user, signOut } = useAuth();
  const [requests, setRequests] = useState([]);
  const [mechanicId, setMechanicId] = useState(null);
  const [mechanicInfo, setMechanicInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [acceptingId, setAcceptingId] = useState(null);

  const load = useCallback(async () => {
    try {
      const mechanic = await api.myMechanicProfile(token);
      setMechanicId(mechanic.id);
      setMechanicInfo(mechanic);

      // If there's already an active job, go straight there instead of
      // showing the incoming-requests list.
      const mine = await api.myAssignedRequests(token);
      const active = mine.find((r) => r.status === "accepted");
      if (active) {
        navigation.replace("ActiveJob", { request: active });
        return;
      }

      let coords = FALLBACK;
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status === "granted") {
          const pos = await Location.getCurrentPositionAsync({});
          coords = { latitude: pos.coords.latitude, longitude: pos.coords.longitude };
        }
      } catch (e) {
        // fall back silently
      }

      const nearby = await api.nearbyRequests(token, coords.latitude, coords.longitude);
      setRequests(nearby);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [token, navigation]);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      load();
    }, [load])
  );

  async function handleAccept(requestId) {
    setAcceptingId(requestId);
    try {
      const accepted = await api.acceptRequest(token, requestId, mechanicId);
      navigation.replace("ActiveJob", { request: accepted });
    } catch (e) {
      Alert.alert("Couldn't accept job", e.message);
    } finally {
      setAcceptingId(null);
    }
  }

  function handleRefresh() {
    setRefreshing(true);
    load();
  }

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={colors.teal} />
        <Text style={styles.mutedText}>Finding requests near you…</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Incoming Requests</Text>
          {user?.name ? <Text style={styles.headerSubtitle}>{user.name}</Text> : null}
          {mechanicInfo ? (
            <View style={styles.badgeRow}>
              <View style={[styles.tierBadge, mechanicInfo.tier === "certified" && styles.tierBadgeCertified]}>
                <Text style={styles.tierBadgeText}>{mechanicInfo.tier === "certified" ? "CERTIFIED EV TECH" : "GENERAL"}</Text>
              </View>
              {mechanicInfo.average_rating != null ? (
                <Text style={styles.ratingText}>★ {mechanicInfo.average_rating} ({mechanicInfo.review_count})</Text>
              ) : null}
            </View>
          ) : null}
        </View>
        <TouchableOpacity onPress={signOut}>
          <Text style={styles.signOut}>Sign out</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={requests}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ padding: spacing.md }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.teal} />}
        ListEmptyComponent={
          <View style={styles.centered}>
            <Text style={styles.mutedText}>No open requests nearby right now.</Text>
            <Text style={styles.mutedTextSmall}>Pull down to refresh.</Text>
          </View>
        }
        renderItem={({ item }) => (
          <View style={styles.card}>
            <View style={{ flex: 1 }}>
              <Text style={styles.faultType}>{FAULT_LABELS[item.fault_type] || item.fault_type}</Text>
              <Text style={styles.distance}>{item.distance_km} km away</Text>
            </View>
            <TouchableOpacity
              style={styles.acceptButton}
              onPress={() => handleAccept(item.id)}
              disabled={acceptingId === item.id}
            >
              {acceptingId === item.id ? (
                <ActivityIndicator color={colors.white} />
              ) : (
                <Text style={styles.acceptButtonText}>Accept</Text>
              )}
            </TouchableOpacity>
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  centered: { flex: 1, alignItems: "center", justifyContent: "center", padding: spacing.lg },
  mutedText: { color: colors.textMuted, marginTop: spacing.sm, fontSize: 14 },
  mutedTextSmall: { color: colors.textMuted, marginTop: spacing.xs, fontSize: 12 },
  header: {
    backgroundColor: colors.navy,
    padding: spacing.lg,
    paddingTop: spacing.xl,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  headerTitle: { fontSize: 20, fontWeight: "800", color: colors.white },
  headerSubtitle: { fontSize: 13, color: "#CFE0DC", marginTop: 2 },
  badgeRow: { flexDirection: "row", alignItems: "center", marginTop: 6 },
  tierBadge: { backgroundColor: "#2A3B5E", paddingHorizontal: 8, paddingVertical: 3, borderRadius: 12, marginRight: 8 },
  tierBadgeCertified: { backgroundColor: colors.teal },
  tierBadgeText: { color: colors.white, fontSize: 9.5, fontWeight: "700" },
  ratingText: { color: colors.amber, fontSize: 12, fontWeight: "700" },
  signOut: { color: colors.amber, fontSize: 13, fontWeight: "600" },
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
  faultType: { fontSize: 15.5, fontWeight: "700", color: colors.textDark },
  distance: { fontSize: 12.5, color: colors.textMuted, marginTop: 2 },
  acceptButton: { backgroundColor: colors.teal, borderRadius: radius.sm, paddingVertical: 10, paddingHorizontal: 18 },
  acceptButtonText: { color: colors.white, fontWeight: "700", fontSize: 13 },
});
