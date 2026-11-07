import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Alert,
} from "react-native";
import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system";
import { api } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { colors, spacing, radius } from "../theme";

// Kept generous but bounded — a scanned certification PDF is typically a
// few hundred KB to a couple MB; this guards against someone picking a
// huge file and the upload silently hanging.
const MAX_FILE_SIZE_BYTES = 6 * 1024 * 1024;

export default function RegisterMechanicScreen({ navigation }) {
  const { token } = useAuth();
  const [docsUrl, setDocsUrl] = useState("");
  const [pickedFile, setPickedFile] = useState(null); // { name, uri, size, mimeType }
  const [picking, setPicking] = useState(false);
  const [saving, setSaving] = useState(false);

  async function handlePickDocument() {
    setPicking(true);
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: "application/pdf",
        copyToCacheDirectory: true,
      });
      if (result.canceled) return;

      const file = result.assets[0];
      if (file.size && file.size > MAX_FILE_SIZE_BYTES) {
        Alert.alert("File too large", "Please choose a PDF under 6MB.");
        return;
      }
      setPickedFile(file);
    } catch (e) {
      Alert.alert("Couldn't open file picker", e.message);
    } finally {
      setPicking(false);
    }
  }

  async function handleSubmit() {
    setSaving(true);
    try {
      const mechanic = await api.registerMechanic(token, docsUrl.trim() || undefined);

      if (pickedFile) {
        const base64 = await FileSystem.readAsStringAsync(pickedFile.uri, {
          encoding: FileSystem.EncodingType.Base64,
        });
        await api.uploadDocument(token, pickedFile.name, "application/pdf", base64);
      }

      navigation.replace("VerificationPending");
    } catch (e) {
      Alert.alert("Couldn't submit registration", e.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: spacing.lg }}>
      <Text style={styles.title}>Join the Mechanic Line</Text>
      <Text style={styles.subtitle}>
        Get matched to EV drivers nearby who need a callout. We manually verify every mechanic
        before you start receiving jobs — usually within a day or two.
      </Text>

      <Text style={styles.label}>Upload your certification or ID (PDF)</Text>
      <Text style={styles.hint}>
        This is what our team actually reviews to verify you — a link is a weak substitute for
        the real document, so upload it directly if you can.
      </Text>

      <TouchableOpacity style={styles.pickButton} onPress={handlePickDocument} disabled={picking}>
        {picking ? (
          <ActivityIndicator color={colors.teal} />
        ) : (
          <Text style={styles.pickButtonText}>{pickedFile ? "Choose a different PDF" : "Choose PDF"}</Text>
        )}
      </TouchableOpacity>

      {pickedFile ? (
        <View style={styles.fileChip}>
          <Text style={styles.fileChipText} numberOfLines={1}>
            📄 {pickedFile.name}
          </Text>
        </View>
      ) : null}

      <Text style={[styles.label, { marginTop: spacing.lg }]}>
        Or paste a link instead (optional, only if you can't upload right now)
      </Text>
      <TextInput
        style={styles.input}
        placeholder="https://…"
        placeholderTextColor={colors.textMuted}
        value={docsUrl}
        onChangeText={setDocsUrl}
        autoCapitalize="none"
      />

      <TouchableOpacity style={styles.primaryButton} onPress={handleSubmit} disabled={saving}>
        {saving ? <ActivityIndicator color={colors.white} /> : <Text style={styles.primaryButtonText}>Submit for review</Text>}
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  title: { fontSize: 22, fontWeight: "800", color: colors.navy },
  subtitle: { fontSize: 13.5, color: colors.textMuted, marginTop: spacing.xs, marginBottom: spacing.lg, lineHeight: 19 },
  label: { fontSize: 13, fontWeight: "600", color: colors.textDark, marginBottom: spacing.xs },
  hint: { fontSize: 12, color: colors.textMuted, marginBottom: spacing.sm, lineHeight: 17 },
  pickButton: {
    borderWidth: 1,
    borderColor: colors.teal,
    borderRadius: radius.sm,
    paddingVertical: 14,
    alignItems: "center",
  },
  pickButtonText: { color: colors.teal, fontWeight: "700", fontSize: 14 },
  fileChip: {
    backgroundColor: "#E7F3F1",
    borderRadius: radius.sm,
    paddingVertical: 10,
    paddingHorizontal: spacing.md,
    marginTop: spacing.sm,
  },
  fileChipText: { color: colors.teal, fontWeight: "600", fontSize: 13 },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    fontSize: 15,
    color: colors.textDark,
    backgroundColor: colors.card,
  },
  primaryButton: {
    backgroundColor: colors.teal,
    borderRadius: radius.sm,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: spacing.lg,
  },
  primaryButtonText: { color: colors.white, fontWeight: "700", fontSize: 15 },
});
