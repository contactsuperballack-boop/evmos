import React, { useCallback, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Linking,
  Alert,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
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

const STATUS_COPY = {
  requested: { label: "Finding a mechanic…", color: colors.amber },
  accepted: { label: "Mechanic is on the way", color: colors.teal },
  completed: { label: "Job completed", color: colors.teal },
  cancelled: { label: "Request cancelled", color: colors.danger },
};

export default function ServiceRequestStatusScreen({ route }) {
  const { token } = useAuth();
  const [request, setRequest] = useState(route.params.request);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedRating, setSelectedRating] = useState(0);
  const [comment, setComment] = useState("");
  const [submittingReview, setSubmittingReview] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const updated = await api.getServiceRequest(token, route.params.request.id);
      setRequest(updated);
    } finally {
      setRefreshing(false);
    }
  }, [token, route.params.request.id]);

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh])
  );

  function handleRefresh() {
    setRefreshing(true);
    refresh();
  }

  async function handleSubmitReview() {
    if (selectedRating === 0) return Alert.alert("Tap a star to rate this mechanic first");
    setSubmittingReview(true);
    try {
      await api.createReview(token, request.id, selectedRating, comment.trim() || undefined);
      await refresh();
      Alert.alert("Thanks!", "Your review helps other drivers.");
    } catch (e) {
      Alert.alert("Couldn't submit review", e.message);
    } finally {
      setSubmittingReview(false);
    }
  }

  const statusInfo = STATUS_COPY[request.status] || { label: request.status, color: colors.textMuted };
  const showMechanicInfo = (request.status === "accepted" || request.status === "completed") && request.mechanic_name;

  return (
    <ScrollView
      contentContainerStyle={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.teal} />}
    >
      <View style={[styles.statusBadge, { backgroundColor: `${statusInfo.color}22` }]}>
        <Text style={[styles.statusText, { color: statusInfo.color }]}>{statusInfo.label}</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.label}>Issue reported</Text>
        <Text style={styles.value}>{FAULT_LABELS[request.fault_type] || request.fault_type}</Text>

        {showMechanicInfo ? (
          <>
            <Text style={styles.label}>Mechanic</Text>
            <Text style={styles.value}>{request.mechanic_name}</Text>
            <View style={styles.tierRow}>
              <View style={[styles.tierBadge, request.mechanic_tier === "certified" && styles.tierBadgeCertified]}>
                <Text style={styles.tierBadgeText}>
                  {request.mechanic_tier === "certified" ? "CERTIFIED EV TECH" : "GENERAL"}
                </Text>
              </View>
              {request.average_rating != null ? (
                <Text style={styles.ratingText}>★ {request.average_rating} ({request.review_count})</Text>
              ) : (
                <Text style={styles.ratingTextMuted}>No ratings yet</Text>
              )}
            </View>
            {request.mechanic_phone && request.status === "accepted" ? (
              <TouchableOpacity onPress={() => Linking.openURL(`tel:${request.mechanic_phone}`)}>
                <Text style={styles.callLink}>Call {request.mechanic_phone}</Text>
              </TouchableOpacity>
            ) : null}
          </>
        ) : null}
      </View>

      {request.status === "requested" ? (
        <>
          <ActivityIndicator size="large" color={colors.teal} style={{ marginTop: spacing.lg }} />
          <Text style={styles.mutedText}>Pull down to check for updates.</Text>
        </>
      ) : null}

      {request.status === "completed" ? (
        request.already_reviewed ? (
          <View style={styles.reviewedCard}>
            <Text style={styles.reviewedText}>✓ You've already reviewed this job. Thanks!</Text>
          </View>
        ) : (
          <View style={styles.reviewCard}>
            <Text style={styles.reviewTitle}>Rate this mechanic</Text>
            <View style={styles.starRow}>
              {[1, 2, 3, 4, 5].map((n) => (
                <TouchableOpacity key={n} onPress={() => setSelectedRating(n)}>
                  <Text style={[styles.star, n <= selectedRating && styles.starFilled]}>★</Text>
                </TouchableOpacity>
              ))}
            </View>
            <TextInput
              style={styles.commentInput}
              placeholder="Optional comment"
              placeholderTextColor={colors.textMuted}
              value={comment}
              onChangeText={setComment}
              multiline
            />
            <TouchableOpacity style={styles.submitButton} onPress={handleSubmitReview} disabled={submittingReview}>
              {submittingReview ? (
                <ActivityIndicator color={colors.white} />
              ) : (
                <Text style={styles.submitButtonText}>Submit review</Text>
              )}
            </TouchableOpacity>
          </View>
        )
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, backgroundColor: colors.bg, padding: spacing.lg, alignItems: "center" },
  statusBadge: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, marginBottom: spacing.lg, marginTop: spacing.md },
  statusText: { fontWeight: "800", fontSize: 14 },
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    width: "100%",
  },
  label: { fontSize: 11.5, fontWeight: "700", color: colors.textMuted, marginTop: spacing.sm, letterSpacing: 0.5 },
  value: { fontSize: 16, fontWeight: "600", color: colors.textDark, marginTop: 2 },
  tierRow: { flexDirection: "row", alignItems: "center", marginTop: 6 },
  tierBadge: { backgroundColor: colors.border, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 12, marginRight: 8 },
  tierBadgeCertified: { backgroundColor: colors.teal },
  tierBadgeText: { color: colors.white, fontSize: 9.5, fontWeight: "700" },
  ratingText: { color: colors.amber, fontSize: 12.5, fontWeight: "700" },
  ratingTextMuted: { color: colors.textMuted, fontSize: 12 },
  callLink: { color: colors.teal, fontWeight: "700", fontSize: 14, marginTop: spacing.sm },
  mutedText: { color: colors.textMuted, fontSize: 12.5, marginTop: spacing.sm },
  reviewedCard: {
    backgroundColor: "#E7F3F1",
    borderRadius: radius.md,
    padding: spacing.md,
    marginTop: spacing.lg,
    width: "100%",
    alignItems: "center",
  },
  reviewedText: { color: colors.teal, fontWeight: "700", fontSize: 13 },
  reviewCard: {
    backgroundColor: colors.card,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    width: "100%",
    marginTop: spacing.lg,
  },
  reviewTitle: { fontSize: 15, fontWeight: "700", color: colors.textDark, marginBottom: spacing.sm },
  starRow: { flexDirection: "row", marginBottom: spacing.md },
  star: { fontSize: 32, color: colors.border, marginRight: 6 },
  starFilled: { color: colors.amber },
  commentInput: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    padding: spacing.md,
    fontSize: 14,
    color: colors.textDark,
    minHeight: 60,
    textAlignVertical: "top",
    marginBottom: spacing.md,
  },
  submitButton: { backgroundColor: colors.teal, borderRadius: radius.sm, paddingVertical: 12, alignItems: "center" },
  submitButtonText: { color: colors.white, fontWeight: "700", fontSize: 14 },
});
