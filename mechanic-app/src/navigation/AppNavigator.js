import React from "react";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { View, ActivityIndicator } from "react-native";

import { useAuth } from "../context/AuthContext";
import { colors } from "../theme";

import OTPLoginScreen from "../screens/OTPLoginScreen";
import MechanicGateScreen from "../screens/MechanicGateScreen";
import RegisterMechanicScreen from "../screens/RegisterMechanicScreen";
import VerificationPendingScreen from "../screens/VerificationPendingScreen";
import IncomingRequestsScreen from "../screens/IncomingRequestsScreen";
import ActiveJobScreen from "../screens/ActiveJobScreen";

const Stack = createNativeStackNavigator();

const screenOptions = {
  headerStyle: { backgroundColor: colors.navy },
  headerTintColor: colors.white,
  headerTitleStyle: { fontWeight: "700" },
};

export default function AppNavigator() {
  const { token, isLoading } = useAuth();

  if (isLoading) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.navy }}>
        <ActivityIndicator size="large" color={colors.teal} />
      </View>
    );
  }

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={screenOptions}>
        {!token ? (
          <Stack.Screen name="Login" component={OTPLoginScreen} options={{ headerShown: false }} />
        ) : (
          <>
            <Stack.Screen name="MechanicGate" component={MechanicGateScreen} options={{ headerShown: false }} />
            <Stack.Screen
              name="RegisterMechanic"
              component={RegisterMechanicScreen}
              options={{ title: "Join the Mechanic Line" }}
            />
            <Stack.Screen
              name="VerificationPending"
              component={VerificationPendingScreen}
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="IncomingRequests"
              component={IncomingRequestsScreen}
              options={{ headerShown: false }}
            />
            <Stack.Screen name="ActiveJob" component={ActiveJobScreen} options={{ title: "Active Job" }} />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
