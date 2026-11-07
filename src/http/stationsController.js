const { json, readBody } = require("../lib/util");
const { requireAuth } = require("../lib/auth");
const { AppError } = require("../domain/errors");
const stationsService = require("../services/stationsService");

function handle(res, fn) {
  try {
    return fn();
  } catch (err) {
    if (err instanceof AppError) return json(res, err.status, err.body);
    throw err;
  }
}

async function myStations(req, res) {
  const user = requireAuth(req, res, json);
  if (!user) return;

  json(res, 200, stationsService.listMine(user.id));
}

async function createStation(req, res) {
  const user = requireAuth(req, res, json);
  if (!user) return;

  const body = await readBody(req);
  handle(res, () => json(res, 201, stationsService.create(user, body)));
}

async function nearbyStations(req, res, query) {
  const lat = parseFloat(query.lat);
  const lng = parseFloat(query.lng);
  const radiusKm = query.radius_km ? parseFloat(query.radius_km) : 10;
  handle(res, () => json(res, 200, stationsService.listNearby(lat, lng, radiusKm)));
}

// Public — no auth, matching the original endpoint exactly.
async function listChargers(req, res, stationId) {
  json(res, 200, stationsService.listChargersForStation(stationId));
}

async function addCharger(req, res, stationId) {
  const user = requireAuth(req, res, json);
  if (!user) return;

  const body = await readBody(req);
  handle(res, () => json(res, 201, stationsService.addCharger(user, stationId, body)));
}

async function updateCharger(req, res, chargerId) {
  const user = requireAuth(req, res, json);
  if (!user) return;

  const updates = await readBody(req);
  handle(res, () => json(res, 200, stationsService.updateCharger(user, chargerId, updates)));
}

async function activateStation(req, res, stationId) {
  const user = requireAuth(req, res, json);
  if (!user) return;

  handle(res, () => json(res, 200, stationsService.activate(user, stationId)));
}

async function stationSessions(req, res, stationId) {
  const user = requireAuth(req, res, json);
  if (!user) return;

  handle(res, () => json(res, 200, stationsService.listStationSessions(user, stationId)));
}

module.exports = {
  myStations,
  createStation,
  nearbyStations,
  listChargers,
  addCharger,
  updateCharger,
  activateStation,
  stationSessions,
};
