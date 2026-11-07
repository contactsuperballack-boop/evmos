import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
} from "react-native";
import { api } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { colors, spacing, radius } from "../theme";

const STEPS = { PHONE: "phone", CODE: "code" };

export default function OTPLoginScreen() {
  const { signIn } = useAuth();
  const [step, setStep] = useState(STEPS.PHONE);
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [devCode, setDevCode] = useState(null);

  async function handleRequestOtp() {
    if (!phone.trim()) return Alert.alert("Enter your phone number");
    setLoading(true);
    try {
      const res = await api.requestOtp(phone.trim());
      setDevCode(res.dev_code || null);
      setStep(STEPS.CODE);
    } catch (e) {
      Alert.alert("Couldn't send code", e.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleVerify() {
    if (!code.trim()) return Alert.alert("Enter the code sent to your phone");
    setLoading(true);
    try {
      const res = await api.verifyOtp(phone.trim(), code.trim(), name.trim() || undefined, "mechanic");
      await signIn(res.token, res.user);
    } catch (e) {
      Alert.alert("Verification failed", e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <View style={styles.brandBlock}>
        <View style={styles.logoDot} />
        <Text style={styles.brand}>EVMOS</Text>
        <Text style={styles.tagline}>Mechanic Line — get matched to nearby EV callouts.</Text>
      </View>

      {step === STEPS.PHONE ? (
        <View style={styles.card}>
          <Text style={styles.label}>Phone number</Text>
          <TextInput
            style={styles.input}
            placeholder="+234 801 234 5678"
            placeholderTextColor={colors.textMuted}
            keyboardType="phone-pad"
            value={phone}
            onChangeText={setPhone}
            autoFocus
          />
          <TouchableOpacity style={styles.primaryButton} onPress={handleRequestOtp} disabled={loading}>
            {loading ? <ActivityIndicator color={colors.white} /> : <Text style={styles.primaryButtonText}>Send code</Text>}
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.card}>
          <Text style={styles.label}>Enter the code sent to {phone}</Text>
          <TextInput
            style={styles.input}
            placeholder="6-digit code"
            placeholderTextColor={colors.textMuted}
            keyboardType="number-pad"
            value={code}
            onChangeText={setCode}
            autoFocus
          />
          {devCode ? (
            <Text style={styles.devHint}>Dev mode — code is: {devCode} (no SMS provider wired up yet)</Text>
          ) : null}

          <Text style={[styles.label, { marginTop: spacing.md }]}>Your name (first time only)</Text>
          <TextInput
            style={styles.input}
            placeholder="Emeka"
            placeholderTextColor={colors.textMuted}
            value={name}
            onChangeText={setName}
          />

          <TouchableOpacity style={styles.primaryButton} onPress={handleVerify} disabled={loading}>
            {loading ? <ActivityIndicator color={colors.white} /> : <Text style={styles.primaryButtonText}>Verify & continue</Text>}
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setStep(STEPS.PHONE)}>
            <Text style={styles.linkText}>Use a different number</Text>
          </TouchableOpacity>
        </View>
      )}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.navy, justifyContent: "center", padding: spacing.lg },
  brandBlock: { alignItems: "center", marginBottom: spacing.xl },
  logoDot: { width: 56, height: 56, borderRadius: 28, backgroundColor: colors.teal, marginBottom: spacing.md },
  brand: { color: colors.white, fontSize: 34, fontWeight: "800", letterSpacing: 1 },
  tagline: { color: "#CFE0DC", fontSize: 14, marginTop: spacing.xs, textAlign: "center" },
  card: { backgroundColor: colors.card, borderRadius: radius.lg, padding: spacing.lg },
  label: { color: colors.textDark, fontSize: 13, fontWeight: "600", marginBottom: spacing.xs },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    fontSize: 16,
    color: colors.textDark,
    marginBottom: spacing.sm,
  },
  devHint: { color: colors.teal, fontSize: 12, marginBottom: spacing.sm },
  primaryButton: {
    backgroundColor: colors.teal,
    borderRadius: radius.sm,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: spacing.sm,
  },
  primaryButtonText: { color: colors.white, fontWeight: "700", fontSize: 15 },
  linkText: { color: colors.textMuted, textAlign: "center", marginTop: spacing.md, fontSize: 13 },
});
