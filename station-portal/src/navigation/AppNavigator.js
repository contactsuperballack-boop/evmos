import React from "react";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { View, ActivityIndicator } from "react-native";

import { useAuth } from "../context/AuthContext";
import { colors } from "../theme";

import OTPLoginScreen from "../screens/OTPLoginScreen";
import MyStationsScreen from "../screens/MyStationsScreen";
import RegisterStationScreen from "../screens/RegisterStationScreen";
import StationManageScreen from "../screens/StationManageScreen";
import PaymentLogScreen from "../screens/PaymentLogScreen";
import AnalyticsScreen from "../screens/AnalyticsScreen";
// WalletScreen intentionally NOT imported/registered — hardening/
// scope-reduction pass. Unlike the Driver App's Wallet (kept reachable
// for a real P1 dependency: Store checkout), this Wallet exists only to
// pay for Featured Listings, which is Phase 2 monetization per every
// source doc and the founder's own scope decision. File stays on disk
// per "hide, don't delete" — see HARDENING_AND_SCOPE.md.

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
            <Stack.Screen name="MyStations" component={MyStationsScreen} options={{ headerShown: false }} />
            <Stack.Screen name="RegisterStation" component={RegisterStationScreen} options={{ title: "Register Station" }} />
            <Stack.Screen name="StationManage" component={StationManageScreen} options={{ title: "Manage Station" }} />
            <Stack.Screen name="PaymentLog" component={PaymentLogScreen} options={{ title: "Payment Log" }} />
            <Stack.Screen name="Analytics" component={AnalyticsScreen} options={{ title: "Analytics" }} />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
