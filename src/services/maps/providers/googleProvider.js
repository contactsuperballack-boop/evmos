// Real Google Maps Platform API calls — Geocoding API and Places API
// (legacy Text Search endpoint, chosen over the newer Places API (New)
// for a simpler, well-documented request/response shape).
//
// HONESTY NOTE: this has NOT been tested against the live Google API.
// This sandbox has no network access and no real API key. The endpoint
// URLs, parameter names, and response shape below are written to match
// Google's documented API contract from training knowledge, but until
// someone runs this against a real key, treat it as "should work,
// unverified" — same standing caveat this whole build has been explicit
// about for anything that can't be tested here. Verify against Google's
// current docs (https://developers.google.com/maps/documentation) before
// trusting it in production, since API contracts do drift over time.

const config = require("../config");

const GEOCODE_URL = "https://maps.googleapis.com/maps/api/geocode/json";
const PLACES_TEXT_SEARCH_URL = "https://maps.googleapis.com/maps/api/place/textsearch/json";

async function geocodeAddress(address) {
  const apiKey = config.getGoogleApiKey();
  const url = `${GEOCODE_URL}?address=${encodeURIComponent(address)}&key=${apiKey}`;
  const res = await fetch(url);
  const data = await res.json();

  if (data.status !== "OK" || !data.results.length) {
    return { found: false, status: data.status, error_message: data.error_message || null };
  }

  const top = data.results[0];
  return {
    found: true,
    formatted_address: top.formatted_address,
    lat: top.geometry.location.lat,
    lng: top.geometry.location.lng,
    place_id: top.place_id,
  };
}

async function reverseGeocode(lat, lng) {
  const apiKey = config.getGoogleApiKey();
  const url = `${GEOCODE_URL}?latlng=${lat},${lng}&key=${apiKey}`;
  const res = await fetch(url);
  const data = await res.json();

  if (data.status !== "OK" || !data.results.length) {
    return { found: false, status: data.status, error_message: data.error_message || null };
  }

  return { found: true, formatted_address: data.results[0].formatted_address };
}

async function searchPlaces(query, lat, lng) {
  const apiKey = config.getGoogleApiKey();
  let url = `${PLACES_TEXT_SEARCH_URL}?query=${encodeURIComponent(query)}&key=${apiKey}`;
  if (lat != null && lng != null) {
    // Bias toward the driver's area without hard-restricting to it —
    // radius in meters, 20km is a reasonable "same city" bias.
    url += `&location=${lat},${lng}&radius=20000`;
  }

  const res = await fetch(url);
  const data = await res.json();

  if (data.status !== "OK") {
    return { found: false, status: data.status, error_message: data.error_message || null, results: [] };
  }

  return {
    found: true,
    results: data.results.slice(0, 10).map((r) => ({
      name: r.name,
      formatted_address: r.formatted_address,
      lat: r.geometry.location.lat,
      lng: r.geometry.location.lng,
      place_id: r.place_id,
    })),
  };
}

module.exports = { geocodeAddress, reverseGeocode, searchPlaces };
