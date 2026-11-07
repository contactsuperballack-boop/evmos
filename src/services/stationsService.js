const stations = require("../repositories/stationsRepository");
const chargers = require("../repositories/chargersRepository");
const queue = require("../repositories/queueRepository");
const featuredListings = require("../repositories/featuredListingsRepository");
const holds = require("../repositories/holdsRepository");
const stationReviewsRepo = require("../repositories/stationReviewsRepository");
const sessions = require("../repositories/sessionsRepository");
const { ratingSummary } = require("../services/stationReviewsService"); // cross-domain call, same pattern as sessionsService -> holdsService/recommendations
const { distanceKm } = require("../lib/util");
const { ValidationError, ForbiddenError, NotFoundError } = require("../domain/errors");

function listMine(userId) {
  return stations.findByOwner(userId).map((station) => ({
    ...station,
    chargers: chargers.findByStation(station.id),
    ...ratingSummary(station.id),
  }));
}

function create(user, { name, lat, lng, address }) {
  if (user.role !== "station_owner") {
    throw new ForbiddenError("Only station_owner accounts can register a station");
  }
  if (!name || lat == null || lng == null) {
    throw new ValidationError("name, lat, and lng are required");
  }
  return stations.create({ ownerId: user.id, name, lat, lng, address });
}

// GET /stations/nearby — the single most important read in the whole
// Phase 1 app. See HARDENING_AND_SCOPE.md "Performance" section for the
// full history: this used to run `1 + 3N + 2NC` queries for N in-range
// stations averaging C chargers; now runs a constant 6 regardless of N/C,
// via one batched query per aggregate instead of one query per row.
// Moved here verbatim from the old routes/stations.js during the clean-
// architecture migration — behavior, not just query count, is unchanged;
// see tests/performance/nearby_stations_query_batching.test.js.
function listNearby(lat, lng, radiusKm) {
  if (Number.isNaN(lat) || Number.isNaN(lng)) {
    throw new ValidationError("lat and lng query params are required");
  }

  const inRange = stations
    .listActive()
    .map((s) => ({ ...s, distance_km: Number(distanceKm(lat, lng, s.lat, s.lng).toFixed(2)) }))
    .filter((s) => s.distance_km <= radiusKm);

  if (inRange.length === 0) return [];

  const stationIds = inRange.map((s) => s.id);
  const featuredSet = featuredListings.listActiveStationIds(stationIds);

  const allChargers = chargers.listByStationIds(stationIds);
  const chargersByStation = new Map();
  for (const c of allChargers) {
    if (!chargersByStation.has(c.station_id)) chargersByStation.set(c.station_id, []);
    chargersByStation.get(c.station_id).push(c);
  }

  const chargerIds = allChargers.map((c) => c.id);
  const queueRows = queue.listByChargerIds(chargerIds);
  const queueByCharger = new Map(queueRows.map((q) => [q.charger_id, q]));
  const activeHoldByCharger = holds.listActiveByChargerIds(chargerIds);
  const ratingByStation = stationReviewsRepo.ratingsForStations(stationIds);

  return inRange
    .map((station) => {
      const stationChargers = (chargersByStation.get(station.id) || []).map((c) => {
        const q = queueByCharger.get(c.id);
        return {
          ...c,
          wait_estimate_min: q ? q.current_wait_estimate_min : 0,
          active_hold: activeHoldByCharger.get(c.id) || null,
        };
      });
      return {
        ...station,
        is_featured: featuredSet.has(station.id),
        chargers: stationChargers,
        ...(ratingByStation.get(station.id) || { review_count: 0, average_rating: null }),
      };
    })
    .sort((a, b) => {
      if (a.is_featured !== b.is_featured) return a.is_featured ? -1 : 1;
      return a.distance_km - b.distance_km;
    });
}

// Public — no auth required, same as the original. Anyone can browse a
// station's charger list without being logged in.
function listChargersForStation(stationId) {
  return chargers.findByStation(stationId);
}

function addCharger(user, stationId, { connector_type, price_per_kwh }) {
  const station = stations.findById(stationId);
  if (!station) throw new NotFoundError("Station not found");
  if (station.owner_id !== user.id) {
    throw new ForbiddenError("Only the station owner can add chargers");
  }
  if (!connector_type || price_per_kwh == null) {
    throw new ValidationError("connector_type and price_per_kwh are required");
  }

  const charger = chargers.create({ stationId, connectorType: connector_type, pricePerKwh: price_per_kwh });
  queue.createForCharger(charger.id);
  return charger;
}

function updateCharger(user, chargerId, updates) {
  const charger = chargers.findById(chargerId);
  if (!charger) throw new NotFoundError("Charger not found");

  const station = stations.findById(charger.station_id);
  if (station.owner_id !== user.id) {
    throw new ForbiddenError("Only the station owner can update this charger");
  }

  const updated = chargers.updateFields(chargerId, updates);
  if (!updated) throw new ValidationError("No valid fields to update");
  return updated;
}

function activate(user, stationId) {
  const station = stations.findById(stationId);
  if (!station) throw new NotFoundError("Station not found");
  if (station.owner_id !== user.id) {
    throw new ForbiddenError("Only the station owner can activate this station");
  }
  return stations.activate(stationId);
}

// Phase 1 has no in-app payment yet — this is a manual reconciliation
// view over logged charging sessions, per the build spec's "Basic
// Payment Log" screen. Uses sessionsRepository (a station-owner-facing
// view keyed off the station, sitting alongside the driver-facing
// lifecycle sessionsService owns — a deliberate boundary, not an
// oversight; the two services share the underlying table but not logic).
function listStationSessions(user, stationId) {
  const station = stations.findById(stationId);
  if (!station) throw new NotFoundError("Station not found");
  if (station.owner_id !== user.id) {
    throw new ForbiddenError("Only the station owner can view this station's sessions");
  }
  return sessions.listForStation(stationId);
}

module.exports = {
  listMine,
  create,
  listNearby,
  listChargersForStation,
  addCharger,
  updateCharger,
  activate,
  listStationSessions,
};
