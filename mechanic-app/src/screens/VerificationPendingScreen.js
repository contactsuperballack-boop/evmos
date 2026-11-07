import React, { useState, useCallback } from "react";
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, RefreshControl, ScrollView } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { api } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { colors, spacing, radius } from "../theme";

export default function VerificationPendingScreen({ navigation }) {
  const { token, signOut } = useAuth();
  const [checking, setChecking] = useState(false);

  const checkStatus = useCallback(async () => {
    setChecking(true);
    try {
      const mechanic = await api.myMechanicProfile(token);
      if (mechanic.status === "active") {
        navigation.replace("IncomingRequests");
      }
    } catch (e) {
      // stay on this screen
    } finally {
      setChecking(false);
    }
  }, [token]);

  useFocusEffect(
    useCallback(() => {
      checkStatus();
    }, [checkStatus])
  );

  return (
    <ScrollView
      contentContainerStyle={styles.container}
      refreshControl={<RefreshControl refreshing={checking} onRefresh={checkStatus} tintColor={colors.teal} />}
    >
      <View style={styles.badge}>
        <Text style={styles.badgeText}>PENDING</Text>
      </View>
      <Text style={styles.title}>Your application is under review</Text>
      <Text style={styles.body}>
        We manually verify every mechanic before they can receive job requests — this is
        deliberate for Phase 1, not automated yet. This usually takes a day or two.
      </Text>
      <Text style={styles.body}>Pull down to check for an update, or we'll notify you once you're approved.</Text>

      <TouchableOpacity style={styles.refreshButton} onPress={checkStatus} disabled={checking}>
        {checking ? <ActivityIndicator color={colors.white} /> : <Text style={styles.refreshButtonText}>Check status now</Text>}
      </TouchableOpacity>

      <TouchableOpacity onPress={signOut}>
        <Text style={styles.signOut}>Sign out</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, backgroundColor: colors.bg, alignItems: "center", justifyContent: "center", padding: spacing.xl },
  badge: { backgroundColor: "#FFF3D6", paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20, marginBottom: spacing.lg },
  badgeText: { color: "#8A6D00", fontWeight: "800", fontSize: 12, letterSpacing: 1 },
  title: { fontSize: 20, fontWeight: "800", color: colors.navy, textAlign: "center", marginBottom: spacing.sm },
  body: { fontSize: 13.5, color: colors.textMuted, textAlign: "center", marginBottom: spacing.md, lineHeight: 19 },
  refreshButton: { backgroundColor: colors.teal, borderRadius: radius.sm, paddingVertical: 12, paddingHorizontal: 24, marginTop: spacing.md },
  refreshButtonText: { color: colors.white, fontWeight: "700", fontSize: 14 },
  signOut: { color: colors.textMuted, marginTop: spacing.lg, fontSize: 13 },
});
