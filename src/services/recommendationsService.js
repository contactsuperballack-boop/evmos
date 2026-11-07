const stations = require("../repositories/stationsRepository");
const chargers = require("../repositories/chargersRepository");
const queue = require("../repositories/queueRepository");
const aiLogs = require("../repositories/aiRecommendationLogsRepository");
const holdsService = require("./holdsService");
const { distanceKm } = require("../lib/util");
const { ValidationError } = require("../domain/errors");

// DESIGN NOTE (Phase 2 build spec, section 5): this is a hand-tuned,
// explainable scoring formula, not a trained model — exactly what a
// "beta" recommendation service should be before there's enough
// ai_recommendation_logs data (written by this very file) to justify
// something more sophisticated. Every number in the score is real data
// already in the database; nothing here is invented.
//
// HONESTY RULE: the justification text only ever states deltas actually
// computed from real values (queue minutes, distance, price per kWh).
// It deliberately does NOT estimate a driver's earnings or "money saved
// from your time" the way the original product vision's illustrative
// example did ("...earn an additional ₦8,000 today") — that would
// require driver income data this platform doesn't have and has no
// business fabricating. Real, modest numbers beat an invented impressive
// one. See DEFERRED_BACKLOG.md for what a real earnings-aware version
// would actually need.
//
// NOT batched the way stationsService.listNearby was (see
// HARDENING_AND_SCOPE.md "Performance" section) — this migration moved
// the logic as-is (one query per station for chargers, one per charger
// for queue state), on purpose. Applying the same N+1 fix here wasn't
// asked for and is a separate, deliberate follow-up if this endpoint's
// usage ever justifies it, not something to bundle silently into a
// structural migration.

const WEIGHTS = { distance: 0.3, wait: 0.4, price: 0.3 };

function normalize(value, min, max) {
  if (max === min) return 0;
  return (value - min) / (max - min);
}

function getRecommendations(user, lat, lng, radiusKm) {
  if (Number.isNaN(lat) || Number.isNaN(lng)) {
    throw new ValidationError("lat and lng query params are required");
  }

  const activeStations = stations.listActive();

  // Flatten to charger-level candidates — the recommendation is "which
  // charger," not just "which station."
  let candidates = [];
  for (const station of activeStations) {
    const distance = distanceKm(lat, lng, station.lat, station.lng);
    if (distance > radiusKm) continue;

    const availableChargers = chargers.findAvailableByStation(station.id);
    for (const charger of availableChargers) {
      const q = queue.findByChargerId(charger.id);
      candidates.push({
        charger_id: charger.id,
        station_id: station.id,
        station_name: station.name,
        station_address: station.address,
        station_lat: station.lat,
        station_lng: station.lng,
        connector_type: charger.connector_type,
        price_per_kwh: charger.price_per_kwh,
        wait_estimate_min: q ? q.current_wait_estimate_min : 0,
        distance_km: Number(distance.toFixed(2)),
        active_hold: holdsService.getActiveHoldForCharger(charger.id),
      });
    }
  }

  if (candidates.length === 0) {
    return { candidates: [], recommended_charger_id: null, justification: null };
  }

  const distances = candidates.map((c) => c.distance_km);
  const waits = candidates.map((c) => c.wait_estimate_min);
  const prices = candidates.map((c) => c.price_per_kwh);
  const bounds = {
    distance: [Math.min(...distances), Math.max(...distances)],
    wait: [Math.min(...waits), Math.max(...waits)],
    price: [Math.min(...prices), Math.max(...prices)],
  };

  candidates = candidates
    .map((c) => {
      const score =
        WEIGHTS.distance * normalize(c.distance_km, ...bounds.distance) +
        WEIGHTS.wait * normalize(c.wait_estimate_min, ...bounds.wait) +
        WEIGHTS.price * normalize(c.price_per_kwh, ...bounds.price);
      return { ...c, score: Number(score.toFixed(4)) };
    })
    .sort((a, b) => a.score - b.score);

  const recommended = candidates[0];
  const nearest = [...candidates].sort((a, b) => a.distance_km - b.distance_km)[0];

  const justification = buildJustification(recommended, nearest);

  // Log every recommendation shown — this is the data flywheel. Whether
  // the driver takes the advice or not gets filled in later, from
  // sessionsService.start, when they actually start charging.
  const logId = aiLogs.insert(
    user.id,
    candidates.map((c) => c.charger_id),
    recommended.charger_id
  );

  return {
    candidates,
    recommended_charger_id: recommended.charger_id,
    justification,
    recommendation_log_id: logId,
  };
}

function buildJustification(recommended, nearest) {
  if (recommended.charger_id === nearest.charger_id) {
    return `${recommended.station_name} is both the closest option and the best overall balance of queue time and price.`;
  }

  const parts = [];
  const waitDiff = nearest.wait_estimate_min - recommended.wait_estimate_min;
  const distanceDiff = Number((recommended.distance_km - nearest.distance_km).toFixed(1));
  const priceDiff = Number((nearest.price_per_kwh - recommended.price_per_kwh).toFixed(0));

  if (waitDiff > 0) {
    parts.push(
      recommended.wait_estimate_min === 0
        ? `no queue, vs. ${nearest.wait_estimate_min} min at the nearest station`
        : `${waitDiff} min shorter queue than the nearest station`
    );
  }
  if (priceDiff > 0) {
    parts.push(`₦${priceDiff} cheaper per kWh`);
  }

  let sentence = `${recommended.station_name} — ${parts.join(" and ")}`;
  if (distanceDiff > 0) {
    sentence += `, for ${distanceDiff} km more driving than the nearest option`;
  }
  return sentence + ".";
}

// Called from sessionsService.start — links a driver's actual choice back
// to the most recent recommendation they were shown, if any. This is what
// turns a one-off recommendation into a learning signal.
function recordSelection(driverId, chargerId) {
  const recent = aiLogs.findMostRecentUnselectedForDriver(driverId);
  if (!recent) return;

  // Only attribute the selection if it happened reasonably soon after the
  // recommendation was shown — a session started an hour later isn't
  // meaningfully "in response to" that recommendation.
  const ageMinutes = (Date.now() - new Date(recent.created_at + "Z").getTime()) / 60000;
  if (ageMinutes > 30) return;

  aiLogs.recordSelectedCharger(recent.id, chargerId);
}

module.exports = { getRecommendations, recordSelection };
