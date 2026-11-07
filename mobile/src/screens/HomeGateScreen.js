import React, { useEffect } from "react";
import { View, ActivityIndicator } from "react-native";
import { api } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { colors } from "../theme";

// Decides where a logged-in driver lands: straight to the main tab bar
// (Home/Map first) if they've already registered a vehicle, or Vehicle
// Registration first if this is their first time through.
export default function HomeGateScreen({ navigation }) {
  const { token } = useAuth();

  useEffect(() => {
    (async () => {
      try {
        const vehicles = await api.listVehicles(token);
        navigation.replace(vehicles.length > 0 ? "MainTabs" : "VehicleRegistration");
      } catch (e) {
        // If the check fails for any reason, don't strand the user — send
        // them into the main tab bar; vehicle registration can be revisited
        // later from Profile.
        navigation.replace("MainTabs");
      }
    })();
  }, [token]);

  return (
    <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.navy }}>
      <ActivityIndicator size="large" color={colors.teal} />
    </View>
  );
}
