// Mapbox's role in map RENDERING (interactive maps, custom styling) is a
// CLIENT-SIDE SDK concern — the mobile app would render the map itself
// using a Mapbox React Native SDK (e.g. @rnmapbox/maps), not proxy tile
// requests through this backend. None of the three mobile apps use that
// yet (they use react-native-maps against the device's native provider).
// Nothing in this file changes that or implies it should.
//
// What this file DOES implement for real: geocoding and place search.
// Comparing Mapbox's geocoding against Google's (see mapService.js's
// `provider` param) is a legitimate, requested use case — Mapbox's geocoding free
// tier is far more generous than Google's (100k/month vs 10k/month as of
// this writing), and POI/address data quality genuinely varies by region,
// so testing both against real Abuja addresses before committing to one
// is the right call rather than guessing from global benchmarks.
//
// HONESTY NOTE — same standing caveat as googleProvider.js: this has NOT
// been tested against the live Mapbox API. No network access, no real
// token in this sandbox. Endpoint URLs and response shapes below match
// Mapbox's documented Geocoding API v6 and Search Box API contracts from
// training knowledge, not a live test. Verify against Mapbox's current
// docs (https://docs.mapbox.com/api/search/) before trusting this in
// production — API versions do change (Mapbox itself moved from v5 to v6
// geocoding within recent years).

const config = require("../config");

const GEOCODE_V6_BASE = "https://api.mapbox.com/search/geocode/v6";
const SEARCHBOX_FORWARD_URL = "https://api.mapbox.com/search/searchbox/v1/forward";
const STATIC_IMAGE_BASE = "https://api.mapbox.com/styles/v1/mapbox/streets-v12/static";

function featureToResult(feature) {
  const [lng, lat] = feature.geometry.coordinates;
  return {
    found: true,
    formatted_address: feature.properties.full_address || feature.properties.place_formatted || feature.properties.name,
    lat,
    lng,
    place_id: feature.properties.mapbox_id,
  };
}

async function geocodeAddress(address) {
  const token = config.getMapboxAccessToken();
  const url = `${GEOCODE_V6_BASE}/forward?q=${encodeURIComponent(address)}&access_token=${token}&limit=1`;
  const res = await fetch(url);
  const data = await res.json();

  if (!data.features || data.features.length === 0) {
    return { found: false, status: "ZERO_RESULTS" };
  }
  return featureToResult(data.features[0]);
}

async function reverseGeocode(lat, lng) {
  const token = config.getMapboxAccessToken();
  const url = `${GEOCODE_V6_BASE}/reverse?longitude=${lng}&latitude=${lat}&access_token=${token}&limit=1`;
  const res = await fetch(url);
  const data = await res.json();

  if (!data.features || data.features.length === 0) {
    return { found: false, status: "ZERO_RESULTS" };
  }
  return { found: true, formatted_address: data.features[0].properties.full_address };
}

async function searchPlaces(query, lat, lng) {
  const token = config.getMapboxAccessToken();
  let url = `${SEARCHBOX_FORWARD_URL}?q=${encodeURIComponent(query)}&access_token=${token}&limit=10`;
  if (lat != null && lng != null) {
    url += `&proximity=${lng},${lat}`;
  }

  const res = await fetch(url);
  const data = await res.json();

  if (!data.features || data.features.length === 0) {
    return { found: false, status: "ZERO_RESULTS", results: [] };
  }

  return {
    found: true,
    results: data.features.map((f) => ({
      name: f.properties.name,
      formatted_address: f.properties.full_address || f.properties.place_formatted,
      lat: f.geometry.coordinates[1],
      lng: f.geometry.coordinates[0],
      place_id: f.properties.mapbox_id,
    })),
  };
}

// The one server-side rendering use case noted at the top of this file —
// unrelated to the geocoding/search functions above, kept separate.
async function getStaticMapImageUrl(lat, lng, zoom = 14, width = 600, height = 400) {
  const token = config.getMapboxAccessToken();
  if (!token) return null;
  return `${STATIC_IMAGE_BASE}/pin-s+0F7A72(${lng},${lat})/${lng},${lat},${zoom}/${width}x${height}?access_token=${token}`;
}

module.exports = { geocodeAddress, reverseGeocode, searchPlaces, getStaticMapImageUrl };
