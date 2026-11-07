const { json } = require("../lib/util");
const { requireAuth } = require("../lib/auth");
const mapService = require("../services/maps/mapService");

async function geocode(req, res, query) {
  const user = requireAuth(req, res, json);
  if (!user) return;

  const result = await mapService.geocodeAddress(query.address, query.provider);
  json(res, result.found ? 200 : result.configured === false ? 501 : 422, result);
}

async function reverseGeocode(req, res, query) {
  const user = requireAuth(req, res, json);
  if (!user) return;

  const lat = query.lat ? parseFloat(query.lat) : null;
  const lng = query.lng ? parseFloat(query.lng) : null;
  const result = await mapService.reverseGeocode(lat, lng, query.provider);
  json(res, result.found ? 200 : result.configured === false ? 501 : 422, result);
}

async function searchPlaces(req, res, query) {
  const user = requireAuth(req, res, json);
  if (!user) return;

  const lat = query.lat ? parseFloat(query.lat) : null;
  const lng = query.lng ? parseFloat(query.lng) : null;
  const result = await mapService.searchPlaces(query.q, lat, lng, query.provider);
  json(res, result.found ? 200 : result.configured === false ? 501 : 422, result);
}

// A/B testing endpoint: one call, both providers, side by side. This is
// the whole point of building the Mapbox provider — comparing accuracy
// on real Abuja addresses without hand-running two separate requests.
async function compareGeocode(req, res, query) {
  const user = requireAuth(req, res, json);
  if (!user) return;

  if (!query.address) {
    return json(res, 400, { error: "address is required" });
  }

  const result = await mapService.compareGeocodeAddress(query.address);
  json(res, 200, result);
}

module.exports = { geocode, reverseGeocode, searchPlaces, compareGeocode };
