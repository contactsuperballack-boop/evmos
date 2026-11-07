import React, { useEffect } from "react";
import { View, ActivityIndicator } from "react-native";
import { api } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { colors } from "../theme";

export default function MechanicGateScreen({ navigation }) {
  const { token } = useAuth();

  useEffect(() => {
    (async () => {
      try {
        const mechanic = await api.myMechanicProfile(token);
        if (mechanic.status === "active") {
          navigation.replace("IncomingRequests");
        } else {
          navigation.replace("VerificationPending");
        }
      } catch (e) {
        // 404 — not registered yet
        navigation.replace("RegisterMechanic");
      }
    })();
  }, [token]);

  return (
    <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.navy }}>
      <ActivityIndicator size="large" color={colors.teal} />
    </View>
  );
}
