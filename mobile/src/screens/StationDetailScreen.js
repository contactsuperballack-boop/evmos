import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Linking,
  Platform,
  ActivityIndicator,
  Alert,
  Modal,
  KeyboardAvoidingView,
} from "react-native";
import { api } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { colors, spacing, radius } from "../theme";

export default function StationDetailScreen({ route, navigation }) {
  const { station } = route.params;
  const { token } = useAuth();
  const [activeSession, setActiveSession] = useState(null);
  const [loading, setLoading] = useState(false);
  const [showEndModal, setShowEndModal] = useState(false);
  const [kwhInput, setKwhInput] = useState("");
  const [couponInput, setCouponInput] = useState("");
  const [ending, setEnding] = useState(false);
  const [myHoldChargerIds, setMyHoldChargerIds] = useState({});
  const [holdingChargerId, setHoldingChargerId] = useState(null);
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [completedSessionId, setCompletedSessionId] = useState(null);
  const [selectedRating, setSelectedRating] = useState(0);
  const [reviewComment, setReviewComment] = useState("");
  const [submittingReview, setSubmittingReview] = useState(false);

  function handleNavigate() {
    const label = encodeURIComponent(station.name);
    const url = Platform.select({
      ios: `maps:0,0?q=${label}@${station.lat},${station.lng}`,
      android: `geo:0,0?q=${station.lat},${station.lng}(${label})`,
    });
    Linking.openURL(url).catch(() =>
      Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${station.lat},${station.lng}`)
    );
  }

  async function handleStartCharging(chargerId) {
    setLoading(true);
    try {
      const session = await api.startSession(token, chargerId);
      setActiveSession(session);
    } catch (e) {
      Alert.alert("Couldn't start session", e.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleCreateHold(chargerId) {
    setHoldingChargerId(chargerId);
    try {
      const hold = await api.createHold(token, chargerId);
      setMyHoldChargerIds((prev) => ({ ...prev, [chargerId]: hold.id }));
      const untilTime = new Date(hold.hold_until).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
      Alert.alert("Heads-up hold set", `${hold.disclaimer}\n\nHeld until ${untilTime}.`);
    } catch (e) {
      Alert.alert("Couldn't set a hold", e.message);
    } finally {
      setHoldingChargerId(null);
    }
  }

  async function handleConfirmEnd() {
    const kwh = parseFloat(kwhInput);
    if (!kwh || kwh <= 0) return Alert.alert("Enter how many kWh you charged");

    setEnding(true);
    try {
      const result = await api.endSession(token, activeSession.id, kwh, couponInput.trim() || undefined);
      setShowEndModal(false);
      setKwhInput("");
      setCouponInput("");
      setActiveSession(null);

      if (result.payment_status === "paid") {
        const discountLine = result.discount_applied > 0 ? `\nCoupon saved you ₦${result.discount_applied}.` : "";
        const pointsLine = result.points_earned > 0 ? `\nYou earned ${result.points_earned} loyalty points.` : "";
        Alert.alert("Charging complete", `₦${result.amount_charged} charged from your wallet.${discountLine}${pointsLine}`);
      } else if (result.payment_status === "insufficient_balance") {
        Alert.alert(
          "Session logged, payment pending",
          "Your wallet balance was too low to cover this session. Top up your wallet to settle it.",
          [
            { text: "Later", style: "cancel" },
            { text: "Top up now", onPress: () => navigation.navigate("Wallet") },
          ]
        );
      } else {
        Alert.alert("Session logged", "Added to your charging history.");
      }

      // Prompt for a review right after — the driver's experience is
      // freshest now, and this is the same moment ServiceRequestStatus
      // does it for mechanics.
      setCompletedSessionId(result.id);
      setSelectedRating(0);
      setReviewComment("");
      setShowReviewModal(true);
    } catch (e) {
      Alert.alert("Couldn't end session", e.message);
    } finally {
      setEnding(false);
    }
  }

  async function handleSubmitReview() {
    if (selectedRating === 0) return Alert.alert("Tap a star to rate this station first");
    setSubmittingReview(true);
    try {
      await api.createStationReview(token, completedSessionId, selectedRating, reviewComment.trim() || undefined);
      setShowReviewModal(false);
      Alert.alert("Thanks!", "Your review helps other drivers.");
    } catch (e) {
      Alert.alert("Couldn't submit review", e.message);
    } finally {
      setSubmittingReview(false);
    }
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: spacing.md }}>
      <Text style={styles.title}>{station.name}</Text>
      <Text style={styles.address}>{station.address || "Abuja"}</Text>
      <Text style={styles.distance}>{station.distance_km} km away</Text>
      {station.average_rating != null ? (
        <Text style={styles.ratingText}>★ {station.average_rating} ({station.review_count} review{station.review_count === 1 ? "" : "s"})</Text>
      ) : (
        <Text style={styles.ratingTextMuted}>No reviews yet</Text>
      )}

      <TouchableOpacity style={styles.navigateButton} onPress={handleNavigate}>
        <Text style={styles.navigateButtonText}>Navigate</Text>
      </TouchableOpacity>

      <Text style={styles.sectionTitle}>Chargers</Text>
      {(station.chargers || []).length === 0 ? (
        <Text style={styles.mutedText}>No chargers listed at this station yet.</Text>
      ) : (
        station.chargers.map((charger) => {
          const iHoldThis = !!myHoldChargerIds[charger.id];
          const someoneElseHolds = charger.active_hold && !iHoldThis;
          const chargingHere = activeSession && activeSession.charger_id === charger.id;

          return (
            <View key={charger.id} style={styles.chargerCard}>
              <View style={{ flex: 1 }}>
                <Text style={styles.chargerType}>{charger.connector_type}</Text>
                <Text style={styles.chargerMeta}>₦{charger.price_per_kwh}/kWh</Text>
                <Text style={[styles.chargerMeta, charger.wait_estimate_min === 0 && styles.noQueue]}>
                  {charger.wait_estimate_min === 0 ? "No queue" : `${charger.wait_estimate_min} min wait`}
                </Text>
                {someoneElseHolds ? (
                  <Text style={styles.holdBadge}>
                    ⏱ Another EVMOS driver has a heads-up hold until{" "}
                    {new Date(charger.active_hold.held_until).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </Text>
                ) : null}
                {iHoldThis ? <Text style={styles.holdBadgeMine}>✓ You have a heads-up hold on this charger</Text> : null}
              </View>

              <View style={{ alignItems: "flex-end" }}>
                {chargingHere ? (
                  <TouchableOpacity style={styles.endButton} onPress={() => setShowEndModal(true)} disabled={loading}>
                    <Text style={styles.actionButtonText}>End charging</Text>
                  </TouchableOpacity>
                ) : (
                  <TouchableOpacity
                    style={styles.startButton}
                    onPress={() => handleStartCharging(charger.id)}
                    disabled={loading || !!activeSession}
                  >
                    {loading ? <ActivityIndicator color={colors.white} /> : <Text style={styles.actionButtonText}>Start charging</Text>}
                  </TouchableOpacity>
                )}
                {!chargingHere && !iHoldThis ? (
                  <TouchableOpacity
                    style={styles.holdButton}
                    onPress={() => handleCreateHold(charger.id)}
                    disabled={holdingChargerId === charger.id || someoneElseHolds || !!activeSession}
                  >
                    {holdingChargerId === charger.id ? (
                      <ActivityIndicator color={colors.teal} size="small" />
                    ) : (
                      <Text style={styles.holdButtonText}>Heads-up hold (15 min)</Text>
                    )}
                  </TouchableOpacity>
                ) : null}
              </View>
            </View>
          );
        })
      )}

      <Text style={styles.disclaimer}>
        Payment is deducted from your EVMOS wallet when you end a session. Wallet top-up is
        simulated for now — no real payment provider connected yet. A heads-up hold coordinates
        with other EVMOS drivers only — it can't stop a walk-up customer at the station.
      </Text>

      <Modal visible={showEndModal} transparent animationType="slide" onRequestClose={() => setShowEndModal(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>End charging session</Text>

            <Text style={styles.label}>How many kWh did you charge?</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. 12.5"
              keyboardType="decimal-pad"
              value={kwhInput}
              onChangeText={setKwhInput}
              placeholderTextColor={colors.textMuted}
              autoFocus
            />

            <Text style={styles.label}>Coupon code (optional)</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. WELCOME10"
              autoCapitalize="characters"
              value={couponInput}
              onChangeText={setCouponInput}
              placeholderTextColor={colors.textMuted}
            />

            <TouchableOpacity style={styles.primaryButton} onPress={handleConfirmEnd} disabled={ending}>
              {ending ? <ActivityIndicator color={colors.white} /> : <Text style={styles.primaryButtonText}>Confirm & pay</Text>}
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setShowEndModal(false)} disabled={ending}>
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <Modal visible={showReviewModal} transparent animationType="slide" onRequestClose={() => setShowReviewModal(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Rate this station</Text>
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
              value={reviewComment}
              onChangeText={setReviewComment}
              multiline
            />
            <TouchableOpacity style={styles.primaryButton} onPress={handleSubmitReview} disabled={submittingReview}>
              {submittingReview ? <ActivityIndicator color={colors.white} /> : <Text style={styles.primaryButtonText}>Submit review</Text>}
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setShowReviewModal(false)} disabled={submittingReview}>
              <Text style={styles.cancelText}>Skip</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </ScrollView>

  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  title: { fontSize: 22, fontWeight: "800", color: colors.navy },
  address: { fontSize: 13.5, color: colors.textMuted, marginTop: 2 },
  distance: { fontSize: 13.5, color: colors.teal, fontWeight: "600", marginTop: 4 },
  ratingText: { fontSize: 12.5, color: colors.amber, fontWeight: "700", marginTop: 4 },
  ratingTextMuted: { fontSize: 12, color: colors.textMuted, marginTop: 4 },
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
  navigateButton: {
    backgroundColor: colors.navy,
    borderRadius: radius.sm,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: spacing.md,
  },
  navigateButtonText: { color: colors.white, fontWeight: "700", fontSize: 15 },
  sectionTitle: { fontSize: 16, fontWeight: "700", color: colors.textDark, marginTop: spacing.lg, marginBottom: spacing.sm },
  mutedText: { color: colors.textMuted, fontSize: 13.5 },
  chargerCard: {
    backgroundColor: colors.card,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    flexDirection: "row",
    alignItems: "center",
    marginBottom: spacing.sm,
  },
  chargerType: { fontSize: 15, fontWeight: "700", color: colors.textDark },
  chargerMeta: { fontSize: 12.5, color: colors.textMuted, marginTop: 2 },
  noQueue: { color: colors.teal, fontWeight: "600" },
  startButton: { backgroundColor: colors.teal, borderRadius: radius.sm, paddingVertical: 10, paddingHorizontal: 14 },
  endButton: { backgroundColor: colors.danger, borderRadius: radius.sm, paddingVertical: 10, paddingHorizontal: 14 },
  actionButtonText: { color: colors.white, fontWeight: "700", fontSize: 12.5 },
  holdBadge: { fontSize: 10.5, color: "#8A6D00", marginTop: 4, maxWidth: 220 },
  holdBadgeMine: { fontSize: 10.5, color: colors.teal, fontWeight: "700", marginTop: 4 },
  holdButton: { marginTop: 6, paddingVertical: 6, paddingHorizontal: 10, borderWidth: 1, borderColor: colors.teal, borderRadius: radius.sm },
  holdButtonText: { color: colors.teal, fontWeight: "700", fontSize: 10.5 },
  disclaimer: { fontSize: 11.5, color: colors.textMuted, marginTop: spacing.lg, textAlign: "center", fontStyle: "italic" },
  modalOverlay: { flex: 1, backgroundColor: "rgba(11,31,58,0.5)", justifyContent: "flex-end" },
  modalCard: { backgroundColor: colors.card, borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg, padding: spacing.lg },
  modalTitle: { fontSize: 18, fontWeight: "800", color: colors.navy, marginBottom: spacing.md },
  label: { fontSize: 12.5, fontWeight: "600", color: colors.textDark, marginBottom: spacing.xs },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    fontSize: 16,
    color: colors.textDark,
    marginBottom: spacing.md,
  },
  primaryButton: { backgroundColor: colors.teal, borderRadius: radius.sm, paddingVertical: 14, alignItems: "center" },
  primaryButtonText: { color: colors.white, fontWeight: "700", fontSize: 15 },
  cancelText: { color: colors.textMuted, textAlign: "center", marginTop: spacing.md, fontSize: 13.5 },
});
