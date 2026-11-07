import React from "react";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { View, ActivityIndicator, Text } from "react-native";

import { useAuth } from "../context/AuthContext";
import { colors } from "../theme";

import OTPLoginScreen from "../screens/OTPLoginScreen";
import HomeGateScreen from "../screens/HomeGateScreen";
import VehicleRegistrationScreen from "../screens/VehicleRegistrationScreen";
import FindChargersScreen from "../screens/FindChargersScreen";
import StationDetailScreen from "../screens/StationDetailScreen";
import ChargingHistoryScreen from "../screens/ChargingHistoryScreen";
import RequestMechanicScreen from "../screens/RequestMechanicScreen";
import ServiceRequestStatusScreen from "../screens/ServiceRequestStatusScreen";
import WalletScreen from "../screens/WalletScreen";
import LoyaltyScreen from "../screens/LoyaltyScreen";
import MarketplaceScreen from "../screens/MarketplaceScreen";
import MyOrdersScreen from "../screens/MyOrdersScreen";
import ProfileScreen from "../screens/ProfileScreen";

// Intentionally NOT imported/registered (hardening/scope-reduction decision,
// see HARDENING_AND_SCOPE.md): MyHoldsScreen, RoutePlannerScreen.
// Files are left on disk ("hide, don't delete" — the backend logic and the
// screen code both stay available to re-wire later if the underlying data
// justifies it). Route Planner in particular should not be re-registered
// until it's backed by real road-aware routing, not straight-line distance.

const RootStack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();
const HomeStack = createNativeStackNavigator();
const TripsStack = createNativeStackNavigator();
const AssistStack = createNativeStackNavigator();
const VehicleStack = createNativeStackNavigator();
const ProfileStack = createNativeStackNavigator();

const screenOptions = {
  headerStyle: { backgroundColor: colors.navy },
  headerTintColor: colors.white,
  headerTitleStyle: { fontWeight: "700" },
};

// --- Tab 1: Home / Map (CHARGE pillar, P0) ---
function HomeTab() {
  return (
    <HomeStack.Navigator screenOptions={screenOptions}>
      <HomeStack.Screen name="FindChargers" component={FindChargersScreen} options={{ headerShown: false }} />
      <HomeStack.Screen name="StationDetail" component={StationDetailScreen} options={{ title: "Station Detail" }} />
    </HomeStack.Navigator>
  );
}

// --- Tab 2: Trips (charging history / journey records) ---
function TripsTab() {
  return (
    <TripsStack.Navigator screenOptions={screenOptions}>
      <TripsStack.Screen name="ChargingHistory" component={ChargingHistoryScreen} options={{ title: "Trips" }} />
    </TripsStack.Navigator>
  );
}

// --- Tab 3: Assist (ASSIST pillar, P1 — secondary safety layer) ---
function AssistTab() {
  return (
    <AssistStack.Navigator screenOptions={screenOptions}>
      <AssistStack.Screen name="RequestMechanic" component={RequestMechanicScreen} options={{ title: "Assist" }} />
      <AssistStack.Screen
        name="ServiceRequestStatus"
        component={ServiceRequestStatusScreen}
        options={{ title: "Mechanic Request" }}
      />
    </AssistStack.Navigator>
  );
}

// --- Tab 4: For Your Vehicle (STORE pillar, P1 — dropship, not marketplace) ---
function VehicleTab() {
  return (
    <VehicleStack.Navigator screenOptions={screenOptions}>
      <VehicleStack.Screen
        name="Marketplace"
        component={MarketplaceScreen}
        options={{ title: "For Your Vehicle" }}
      />
      <VehicleStack.Screen name="MyOrders" component={MyOrdersScreen} options={{ title: "My Orders" }} />
    </VehicleStack.Navigator>
  );
}

// --- Tab 5: Profile (vehicle, account, settings, support) ---
function ProfileTab() {
  return (
    <ProfileStack.Navigator screenOptions={screenOptions}>
      <ProfileStack.Screen name="ProfileHome" component={ProfileScreen} options={{ title: "Profile" }} />
    </ProfileStack.Navigator>
  );
}

// Simple text-label tab bar icon so this doesn't depend on an icon package
// being installed correctly on the very first run — swap for @expo/vector-icons
// (bundled with Expo) once the app has been confirmed running on a device.
function TabIcon({ label, focused }) {
  return (
    <Text style={{ fontSize: 11, fontWeight: focused ? "800" : "500", color: focused ? colors.teal : colors.textMuted }}>
      {label}
    </Text>
  );
}

function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.teal,
        tabBarInactiveTintColor: colors.textMuted,
      }}
    >
      <Tab.Screen
        name="HomeTab"
        component={HomeTab}
        options={{ title: "Home", tabBarIcon: ({ focused }) => <TabIcon label="🏠" focused={focused} /> }}
      />
      <Tab.Screen
        name="TripsTab"
        component={TripsTab}
        options={{ title: "Trips", tabBarIcon: ({ focused }) => <TabIcon label="🧭" focused={focused} /> }}
      />
      <Tab.Screen
        name="AssistTab"
        component={AssistTab}
        options={{ title: "Assist", tabBarIcon: ({ focused }) => <TabIcon label="🛠" focused={focused} /> }}
      />
      <Tab.Screen
        name="VehicleTab"
        component={VehicleTab}
        options={{ title: "For Your Vehicle", tabBarIcon: ({ focused }) => <TabIcon label="🚗" focused={focused} /> }}
      />
      <Tab.Screen
        name="ProfileTab"
        component={ProfileTab}
        options={{ title: "Profile", tabBarIcon: ({ focused }) => <TabIcon label="👤" focused={focused} /> }}
      />
    </Tab.Navigator>
  );
}

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
      <RootStack.Navigator screenOptions={screenOptions}>
        {!token ? (
          <RootStack.Screen name="Login" component={OTPLoginScreen} options={{ headerShown: false }} />
        ) : (
          <>
            <RootStack.Screen name="HomeGate" component={HomeGateScreen} options={{ headerShown: false }} />
            <RootStack.Screen
              name="VehicleRegistration"
              component={VehicleRegistrationScreen}
              options={{ title: "Register Your EV" }}
            />
            <RootStack.Screen name="MainTabs" component={MainTabs} options={{ headerShown: false }} />
            {/*
              Wallet and Loyalty are registered here at the root, not inside
              any single tab, so they stay reachable via navigation.navigate()
              from wherever they're actually needed (Profile tab, and the
              in-flow "top up" prompts in Station Detail / Marketplace
              checkout) without being a primary nav destination themselves.
            */}
            <RootStack.Screen name="Wallet" component={WalletScreen} options={{ title: "Wallet" }} />
            <RootStack.Screen name="Loyalty" component={LoyaltyScreen} options={{ title: "Loyalty Points" }} />
          </>
        )}
      </RootStack.Navigator>
    </NavigationContainer>
  );
}
