// The rest of the codebase should call THIS file, never the provider
// files directly. That's the whole point of a service layer: if EVMOS
// ever switches geocoding providers, only this file and the provider
// file need to change — every route handler and every mobile screen
// that calls /maps/* stays untouched.
//
// CRITICAL SAFETY RULE: when a provider isn't configured, these functions
// return a clear "not configured" result — they NEVER fabricate a
// plausible-looking coordinate or address. That distinction matters. This
// build has simulated things elsewhere (OTP codes, wallet top-ups)
// because a fake ₦5,000 credit in a local dev database is harmless. A
// fake GPS coordinate presented as if it were real is not — it could
// send a driver to the wrong place. Faking money is a safe shortcut;
// faking location data is not, so this file refuses to do it.

const config = require("./config");
const googleProvider = require("./providers/googleProvider");
const mapboxProvider = require("./providers/mapboxProvider");

const PROVIDERS = { google: googleProvider, mapbox: mapboxProvider };
const DEFAULT_PROVIDER = "google";

function isConfigured(providerName) {
  return providerName === "mapbox" ? config.isMapboxConfigured() : config.isGoogleConfigured();
}

function providerLabel(providerName) {
  return providerName === "mapbox" ? "Mapbox" : "Google Maps Platform";
}

function notConfigured(providerName) {
  return {
    found: false,
    configured: false,
    provider: providerName,
    error: `${providerLabel(providerName)} is not configured. Set the required API key as an environment variable — see src/services/maps/README.md.`,
  };
}

function resolveProvider(requested) {
  const name = requested && PROVIDERS[requested] ? requested : DEFAULT_PROVIDER;
  return { name, impl: PROVIDERS[name] };
}

async function geocodeAddress(address, providerName) {
  if (!address) return { found: false, error: "address is required" };
  const { name, impl } = resolveProvider(providerName);
  if (!isConfigured(name)) return notConfigured(name);

  try {
    const result = await impl.geocodeAddress(address);
    return { ...result, provider: name };
  } catch (e) {
    return { found: false, provider: name, error: `Geocoding request failed: ${e.message}` };
  }
}

async function reverseGeocode(lat, lng, providerName) {
  if (lat == null || lng == null) return { found: false, error: "lat and lng are required" };
  const { name, impl } = resolveProvider(providerName);
  if (!isConfigured(name)) return notConfigured(name);

  try {
    const result = await impl.reverseGeocode(lat, lng);
    return { ...result, provider: name };
  } catch (e) {
    return { found: false, provider: name, error: `Reverse geocoding request failed: ${e.message}` };
  }
}

async function searchPlaces(query, lat, lng, providerName) {
  if (!query) return { found: false, results: [], error: "query is required" };
  const { name, impl } = resolveProvider(providerName);
  if (!isConfigured(name)) return notConfigured(name);

  try {
    const result = await impl.searchPlaces(query, lat, lng);
    return { ...result, provider: name };
  } catch (e) {
    return { found: false, provider: name, results: [], error: `Place search request failed: ${e.message}` };
  }
}

// The actual A/B testing helper: runs the same geocode against both
// providers at once and returns both results side by side, so comparing
// accuracy on a real Abuja address is one call instead of two manual
// ones. Each side independently reports "not configured" if that
// provider's key isn't set — doesn't fail the whole comparison just
// because only one key is available yet.
async function compareGeocodeAddress(address) {
  const [google, mapbox] = await Promise.all([
    geocodeAddress(address, "google"),
    geocodeAddress(address, "mapbox"),
  ]);
  return { address, google, mapbox };
}

module.exports = {
  geocodeAddress,
  reverseGeocode,
  searchPlaces,
  compareGeocodeAddress,
};
