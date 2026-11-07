import React, { useCallback, useState } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
  Alert,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { api } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { colors, spacing, radius } from "../theme";

export default function MarketplaceScreen({ navigation }) {
  const { token } = useAuth();
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [buyingId, setBuyingId] = useState(null);

  const load = useCallback(async () => {
    try {
      const result = await api.listProducts();
      setProducts(result);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  function handleRefresh() {
    setRefreshing(true);
    load();
  }

  async function handleBuy(product) {
    if (product.stock_qty <= 0) return;
    Alert.alert(
      product.name,
      `Buy 1 for ₦${product.price.toLocaleString()}? This will be deducted from your wallet.`,
      [
        { text: "Cancel", style: "cancel" },
        { text: "Buy", onPress: () => confirmBuy(product) },
      ]
    );
  }

  async function confirmBuy(product) {
    setBuyingId(product.id);
    try {
      const order = await api.createOrder(token, product.id, 1);
      Alert.alert(
        "Order placed",
        `₦${order.total.toLocaleString()} charged from your wallet. You earned ${order.points_earned} loyalty points.`
      );
      await load();
    } catch (e) {
      if (e.status === 402) {
        Alert.alert(
          "Wallet balance too low",
          "Top up your wallet to complete this purchase.",
          [
            { text: "Later", style: "cancel" },
            { text: "Top up now", onPress: () => navigation.navigate("Wallet") },
          ]
        );
      } else {
        Alert.alert("Couldn't place order", e.message);
      }
    } finally {
      setBuyingId(null);
    }
  }

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={colors.teal} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.subtitle}>EV-specific parts and accessories — cables, adapters, tyres, and more.</Text>
        <TouchableOpacity onPress={() => navigation.navigate("MyOrders")} style={styles.myOrdersLink}>
          <Text style={styles.headerLink}>My Orders →</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={products}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ padding: spacing.md }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.teal} />}
        ListEmptyComponent={
          <View style={styles.centered}>
            <Text style={styles.mutedText}>No products listed yet.</Text>
          </View>
        }
        renderItem={({ item }) => (
          <View style={styles.card}>
            <View style={{ flex: 1 }}>
              <Text style={styles.productName}>{item.name}</Text>
              <Text style={styles.productCategory}>{item.category}</Text>
              <Text style={styles.productPrice}>₦{item.price.toLocaleString()}</Text>
              <Text style={styles.productStock}>
                {item.stock_qty > 0 ? `${item.stock_qty} in stock` : "Out of stock"}
              </Text>
            </View>
            <TouchableOpacity
              style={[styles.buyButton, item.stock_qty <= 0 && styles.buyButtonDisabled]}
              onPress={() => handleBuy(item)}
              disabled={item.stock_qty <= 0 || buyingId === item.id}
            >
              {buyingId === item.id ? (
                <ActivityIndicator color={colors.white} size="small" />
              ) : (
                <Text style={styles.buyButtonText}>{item.stock_qty <= 0 ? "Sold out" : "Buy"}</Text>
              )}
            </TouchableOpacity>
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  centered: { flex: 1, alignItems: "center", justifyContent: "center", padding: spacing.lg },
  mutedText: { color: colors.textMuted },
  header: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
  },
  headerTitle: { fontSize: 20, fontWeight: "800", color: colors.navy },
  headerLink: { fontSize: 12.5, color: colors.teal, fontWeight: "700" },
  myOrdersLink: { alignSelf: "flex-end", marginTop: 4 },
  subtitle: { fontSize: 12.5, color: colors.textMuted, paddingBottom: spacing.sm },
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.sm,
    flexDirection: "row",
    alignItems: "center",
  },
  productName: { fontSize: 15, fontWeight: "700", color: colors.textDark },
  productCategory: { fontSize: 11, color: colors.textMuted, marginTop: 2, textTransform: "uppercase" },
  productPrice: { fontSize: 15, fontWeight: "800", color: colors.teal, marginTop: 4 },
  productStock: { fontSize: 11.5, color: colors.textMuted, marginTop: 2 },
  buyButton: { backgroundColor: colors.teal, borderRadius: radius.sm, paddingVertical: 10, paddingHorizontal: 18 },
  buyButtonDisabled: { backgroundColor: colors.border },
  buyButtonText: { color: colors.white, fontWeight: "700", fontSize: 13 },
});
