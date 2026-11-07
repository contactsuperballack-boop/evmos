import React, { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import * as Location from "expo-location";
import MapView, { Marker } from "react-native-maps";
import { api } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { colors, spacing, radius } from "../theme";

// Default center: Abuja (Wuse) — used only if location permission is denied,
// so the screen isn't dead in the water during a demo.
const FALLBACK_REGION = { latitude: 9.0765, longitude: 7.3986, latitudeDelta: 0.08, longitudeDelta: 0.08 };

const FILTERS = [
  { key: "nearest", label: "Nearest" },
  { key: "cheapest", label: "Cheapest" },
  { key: "queue", label: "Shortest Queue" },
  { key: "recommended", label: "Recommended" },
];

function cheapestPriceFor(station) {
  return station.chargers?.length ? Math.min(...station.chargers.map((c) => c.price_per_kwh)) : Infinity;
}
function shortestWaitFor(station) {
  return station.chargers?.length ? Math.min(...station.chargers.map((c) => c.wait_estimate_min ?? 0)) : Infinity;
}

function sortStations(stations, filter) {
  const arr = [...stations];
  if (filter === "cheapest") arr.sort((a, b) => cheapestPriceFor(a) - cheapestPriceFor(b));
  else if (filter === "queue") arr.sort((a, b) => shortestWaitFor(a) - shortestWaitFor(b));
  else arr.sort((a, b) => a.distance_km - b.distance_km);
  return arr;
}

export default function FindChargersScreen({ navigation }) {
  const { token } = useAuth();
  const [view, setView] = useState("list"); // "list" | "map" — only applies to non-recommended filters
  const [filter, setFilter] = useState("nearest");
  const [location, setLocation] = useState(null);
  const [stations, setStations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);
  const [recommendation, setRecommendation] = useState(null);
  const [recLoading, setRecLoading] = useState(false);

  const loadStations = useCallback(async (lat, lng) => {
    try {
      const results = await api.nearbyStations(lat, lng, 15);
      setStations(results);
      setErrorMsg(null);
    } catch (e) {
      setErrorMsg(e.message);
    }
  }, []);

  const loadRecommendations = useCallback(
    async (lat, lng) => {
      setRecLoading(true);
      try {
        const result = await api.getRecommendations(token, lat, lng, 15);
        setRecommendation(result);
      } catch (e) {
        setErrorMsg(e.message);
      } finally {
        setRecLoading(false);
      }
    },
    [token]
  );

  useEffect(() => {
    (async () => {
      setLoading(true);
      let coords = { latitude: FALLBACK_REGION.latitude, longitude: FALLBACK_REGION.longitude };
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status === "granted") {
          const pos = await Location.getCurrentPositionAsync({});
          coords = { latitude: pos.coords.latitude, longitude: pos.coords.longitude };
        }
      } catch (e) {
        // fall back silently to Abuja center — location is a nice-to-have, not a blocker
      }
      setLocation(coords);
      await loadStations(coords.latitude, coords.longitude);
      setLoading(false);
    })();
  }, [loadStations]);

  async function loadRecommendationsForCurrentLocation() {
    if (!location) return;
    await loadRecommendations(location.latitude, location.longitude);
  }

  async function handleRefresh() {
    if (!location) return;
    setRefreshing(true);
    await loadStations(location.latitude, location.longitude);
    if (filter === "recommended") await loadRecommendationsForCurrentLocation();
    setRefreshing(false);
  }

  function handleSelectFilter(key) {
    setFilter(key);
    if (key === "recommended" && !recommendation && location) {
      loadRecommendationsForCurrentLocation();
    }
  }

  function resolveStationForCandidate(candidate) {
    const known = stations.find((s) => s.id === candidate.station_id);
    if (known) return known;
    // Fallback if this station fell outside the default stations fetch
    // for some reason — built from the candidate's own data, which now
    // includes station lat/lng specifically so this fallback is always
    // navigable, not a dead end.
    return {
      id: candidate.station_id,
      name: candidate.station_name,
      address: candidate.station_address,
      lat: candidate.station_lat,
      lng: candidate.station_lng,
      distance_km: candidate.distance_km,
      chargers: [
        {
          id: candidate.charger_id,
          connector_type: candidate.connector_type,
          price_per_kwh: candidate.price_per_kwh,
          wait_estimate_min: candidate.wait_estimate_min,
          is_available: 1,
        },
      ],
    };
  }

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={colors.teal} />
        <Text style={styles.mutedText}>Finding chargers near you…</Text>
      </View>
    );
  }

  const sortedList = sortStations(stations, filter);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Find Chargers</Text>
        {/*
          Scope note (hardening pass): this header used to link out to
          Wallet, My Holds, Marketplace, Route Planner, and Request Mechanic
          — five equal-weight links sitting on top of the P0 Charge screen.
          Per the Product Definition v1.0 nav spec (section 12) and the
          scope-reduction decision, those now live in their own tabs
          (Assist, For Your Vehicle, Profile) or are hidden entirely
          (Route Planner, My Holds). The Charge screen no longer links
          anywhere except into its own flow (Station Detail).
        */}

        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          data={FILTERS}
          keyExtractor={(f) => f.key}
          style={styles.filterRow}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[styles.filterChip, filter === item.key && styles.filterChipActive]}
              onPress={() => handleSelectFilter(item.key)}
            >
              <Text style={[styles.filterChipText, filter === item.key && styles.filterChipTextActive]}>{item.label}</Text>
            </TouchableOpacity>
          )}
        />

        {filter !== "recommended" ? (
          <View style={styles.toggleRow}>
            <ToggleButton label="List" active={view === "list"} onPress={() => setView("list")} />
            <ToggleButton label="Map" active={view === "map"} onPress={() => setView("map")} />
          </View>
        ) : null}
      </View>

      {errorMsg ? (
        <View style={styles.banner}>
          <Text style={styles.bannerText}>Couldn't refresh: {errorMsg}</Text>
        </View>
      ) : null}

      {filter === "recommended" ? (
        <RecommendedView
          loading={recLoading}
          recommendation={recommendation}
          onSelect={(candidate) => navigation.navigate("StationDetail", { station: resolveStationForCandidate(candidate) })}
          onRefresh={loadRecommendationsForCurrentLocation}
        />
      ) : view === "map" ? (
        <MapView
          style={{ flex: 1 }}
          initialRegion={{
            latitude: location?.latitude ?? FALLBACK_REGION.latitude,
            longitude: location?.longitude ?? FALLBACK_REGION.longitude,
            latitudeDelta: 0.08,
            longitudeDelta: 0.08,
          }}
        >
          {sortedList.map((s) => (
            <Marker
              key={s.id}
              coordinate={{ latitude: s.lat, longitude: s.lng }}
              title={s.name}
              description={`${s.distance_km} km away`}
              onCalloutPress={() => navigation.navigate("StationDetail", { station: s })}
              pinColor={colors.teal}
            />
          ))}
        </MapView>
      ) : (
        <FlatList
          data={sortedList}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ padding: spacing.md }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.teal} />}
          ListEmptyComponent={
            <View style={styles.centered}>
              <Text style={styles.mutedText}>No active stations nearby yet.</Text>
              <Text style={styles.mutedTextSmall}>Pull down to refresh, or widen your search radius.</Text>
            </View>
          }
          renderItem={({ item }) => <StationCard station={item} onPress={() => navigation.navigate("StationDetail", { station: item })} />}
        />
      )}
    </View>
  );
}

function RecommendedView({ loading, recommendation, onSelect, onRefresh }) {
  if (loading || !recommendation) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={colors.teal} />
        <Text style={styles.mutedText}>Scoring nearby chargers…</Text>
      </View>
    );
  }

  if (recommendation.candidates.length === 0) {
    return (
      <View style={styles.centered}>
        <Text style={styles.mutedText}>No available chargers nearby to recommend right now.</Text>
      </View>
    );
  }

  const top = recommendation.candidates.find((c) => c.charger_id === recommendation.recommended_charger_id);
  const rest = recommendation.candidates.filter((c) => c.charger_id !== recommendation.recommended_charger_id);

  return (
    <FlatList
      contentContainerStyle={{ padding: spacing.md }}
      refreshControl={<RefreshControl refreshing={false} onRefresh={onRefresh} tintColor={colors.teal} />}
      data={rest}
      keyExtractor={(item) => item.charger_id}
      ListHeaderComponent={
        <>
          <TouchableOpacity style={styles.aiCard} onPress={() => onSelect(top)}>
            <Text style={styles.aiBadge}>AI PICK</Text>
            <Text style={styles.aiStationName}>{top.station_name}</Text>
            <Text style={styles.aiJustification}>{recommendation.justification}</Text>
            <View style={styles.aiMetaRow}>
              <MetaPill label={`${top.distance_km} km`} light />
              <MetaPill label={`₦${top.price_per_kwh}/kWh`} light />
              <MetaPill label={top.wait_estimate_min === 0 ? "No queue" : `${top.wait_estimate_min} min wait`} light />
            </View>
          </TouchableOpacity>
          <Text style={styles.disclaimer}>
            This is a suggestion based on distance, queue, and price — not a guarantee. Manual
            filters above always show the raw sort if you'd rather decide yourself.
          </Text>
          {rest.length > 0 ? <Text style={styles.sectionTitle}>Other options</Text> : null}
        </>
      }
      renderItem={({ item }) => (
        <TouchableOpacity style={styles.altCard} onPress={() => onSelect(item)}>
          <View style={{ flex: 1 }}>
            <Text style={styles.altName}>{item.station_name}</Text>
            <View style={styles.cardMetaRow}>
              <MetaPill label={`${item.distance_km} km`} />
              <MetaPill label={`₦${item.price_per_kwh}/kWh`} />
              <MetaPill label={item.wait_estimate_min === 0 ? "No queue" : `${item.wait_estimate_min} min wait`} highlight={item.wait_estimate_min === 0} />
            </View>
          </View>
        </TouchableOpacity>
      )}
    />
  );
}

function ToggleButton({ label, active, onPress }) {
  return (
    <TouchableOpacity onPress={onPress} style={[styles.toggleBtn, active && styles.toggleBtnActive]}>
      <Text style={[styles.toggleBtnText, active && styles.toggleBtnTextActive]}>{label}</Text>
    </TouchableOpacity>
  );
}

function StationCard({ station, onPress }) {
  const cheapestPrice = station.chargers?.length
    ? Math.min(...station.chargers.map((c) => c.price_per_kwh))
    : null;
  const minWait = station.chargers?.length
    ? Math.min(...station.chargers.map((c) => c.wait_estimate_min ?? 0))
    : null;

  return (
    <TouchableOpacity style={styles.card} onPress={onPress}>
      <View style={{ flex: 1 }}>
        <Text style={styles.cardTitle}>{station.name}</Text>
        <Text style={styles.cardSubtitle}>{station.address || "Abuja"}</Text>
        <View style={styles.cardMetaRow}>
          <MetaPill label={`${station.distance_km} km`} />
          {cheapestPrice != null && <MetaPill label={`₦${cheapestPrice}/kWh`} />}
          {minWait != null && <MetaPill label={minWait === 0 ? "No queue" : `${minWait} min wait`} highlight={minWait === 0} />}
          {station.average_rating != null && <MetaPill label={`★ ${station.average_rating}`} highlight />}
        </View>
      </View>
    </TouchableOpacity>
  );
}

function MetaPill({ label, highlight, light }) {
  return (
    <View style={[styles.pill, highlight && styles.pillHighlight, light && styles.pillLight]}>
      <Text style={[styles.pillText, highlight && styles.pillTextHighlight, light && styles.pillTextLight]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  centered: { flex: 1, alignItems: "center", justifyContent: "center", padding: spacing.lg },
  mutedText: { color: colors.textMuted, marginTop: spacing.sm, fontSize: 14 },
  mutedTextSmall: { color: colors.textMuted, marginTop: spacing.xs, fontSize: 12 },
  header: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
    backgroundColor: colors.card,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerTitle: { fontSize: 20, fontWeight: "800", color: colors.navy },
  headerLinkRow: { flexDirection: "row", flexWrap: "wrap", marginTop: 4, marginBottom: spacing.sm },
  headerLinkText: { fontSize: 11.5, color: colors.teal, fontWeight: "700", marginRight: spacing.md, marginBottom: 4 },
  filterRow: { marginBottom: spacing.sm },
  filterChip: { backgroundColor: colors.bg, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 7, marginRight: 8 },
  filterChipActive: { backgroundColor: colors.navy },
  filterChipText: { fontSize: 12.5, fontWeight: "700", color: colors.textMuted },
  filterChipTextActive: { color: colors.white },
  toggleRow: { flexDirection: "row", backgroundColor: colors.bg, borderRadius: radius.sm, padding: 3, alignSelf: "flex-start" },
  toggleBtn: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: radius.sm - 2 },
  toggleBtnActive: { backgroundColor: colors.teal },
  toggleBtnText: { fontSize: 12.5, fontWeight: "600", color: colors.textMuted },
  toggleBtnTextActive: { color: colors.white },
  banner: { backgroundColor: "#FDECEA", padding: spacing.sm, paddingHorizontal: spacing.md },
  bannerText: { color: colors.danger, fontSize: 12.5 },
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
    flexDirection: "row",
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardTitle: { fontSize: 16, fontWeight: "700", color: colors.textDark },
  cardSubtitle: { fontSize: 12.5, color: colors.textMuted, marginTop: 2, marginBottom: spacing.sm },
  cardMetaRow: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  pill: { backgroundColor: colors.bg, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20, marginRight: 6 },
  pillHighlight: { backgroundColor: "#E7F3F1" },
  pillLight: { backgroundColor: "rgba(255,255,255,0.15)" },
  pillText: { fontSize: 11.5, color: colors.textMuted, fontWeight: "600" },
  pillTextHighlight: { color: colors.teal },
  pillTextLight: { color: colors.white },
  aiCard: { backgroundColor: colors.navy, borderRadius: radius.lg, padding: spacing.lg, marginBottom: spacing.sm },
  aiBadge: { color: colors.amber, fontWeight: "800", fontSize: 11, letterSpacing: 1, marginBottom: 4 },
  aiStationName: { color: colors.white, fontSize: 19, fontWeight: "800" },
  aiJustification: { color: "#CFE0DC", fontSize: 13, marginTop: 6, lineHeight: 18 },
  aiMetaRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: spacing.md },
  disclaimer: { fontSize: 11, color: colors.textMuted, fontStyle: "italic", marginBottom: spacing.md, lineHeight: 15 },
  sectionTitle: { fontSize: 14, fontWeight: "700", color: colors.textDark, marginBottom: spacing.sm },
  altCard: {
    backgroundColor: colors.card,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  altName: { fontSize: 14.5, fontWeight: "700", color: colors.textDark, marginBottom: 4 },
});
