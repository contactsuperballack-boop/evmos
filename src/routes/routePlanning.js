const db = require("../db");
const { json, readBody, distanceKm } = require("../lib/util");
const { requireAuth } = require("../lib/auth");
const { getActiveHoldForCharger } = require("../services/holdsService");

// HONESTY NOTE — read before extending this file:
// There is no mapping/directions API integration here (no network access
// to Google/Mapbox Directions in this environment, and no API key even
// if there were). This does NOT compute real road distance or real
// travel time. It computes straight-line ("as the crow flies") distance
// between points and uses simple geometry to guess which stations sit
// roughly "on the way." Actual roads are never straight lines, so this
// will sometimes suggest a detour that's worse in practice than it looks
// on paper. The UI must say this plainly, not present it as real
// navigation — turn-by-turn still hands off to native maps, same as
// Station Detail already does. This is tracked as a real limitation in
// DEFERRED_BACKLOG.md, not a secret.

async function planRoute(req, res) {
  const user = requireAuth(req, res, json);
  if (!user) return;

  const { origin_lat, origin_lng, destination_lat, destination_lng, remaining_range_km } = await readBody(req);

  if ([origin_lat, origin_lng, destination_lat, destination_lng, remaining_range_km].some((v) => v == null)) {
    return json(res, 400, {
      error: "origin_lat, origin_lng, destination_lat, destination_lng, and remaining_range_km are all required",
    });
  }

  const directDistanceKm = Number(distanceKm(origin_lat, origin_lng, destination_lat, destination_lng).toFixed(2));
  const needsChargingStop = directDistanceKm > remaining_range_km;

  let suggestedStops = [];
  if (needsChargingStop) {
    const stations = db.prepare(`SELECT * FROM stations WHERE status = 'active'`).all();

    suggestedStops = stations
      .map((s) => {
        const distFromOrigin = distanceKm(origin_lat, origin_lng, s.lat, s.lng);
        const distToDestination = distanceKm(s.lat, s.lng, destination_lat, destination_lng);
        const detourKm = Number((distFromOrigin + distToDestination - directDistanceKm).toFixed(2));
        return { station: s, distFromOrigin, distToDestination, detourKm };
      })
      // Must be reachable from the origin on the range the driver has now.
      .filter((c) => c.distFromOrigin <= remaining_range_km)
      .sort((a, b) => a.detourKm - b.detourKm)
      .slice(0, 5)
      .map((c) => {
        const chargers = db
          .prepare(`SELECT * FROM chargers WHERE station_id = ?`)
          .all(c.station.id)
          .map((charger) => {
            const q = db
              .prepare(`SELECT current_wait_estimate_min FROM queue_state WHERE charger_id = ?`)
              .get(charger.id);
            return {
              ...charger,
              wait_estimate_min: q ? q.current_wait_estimate_min : 0,
              active_hold: getActiveHoldForCharger(charger.id),
            };
          });
        return {
          ...c.station,
          chargers,
          distance_km: Number(c.distFromOrigin.toFixed(2)),
          detour_km: c.detourKm,
        };
      });
  }

  json(res, 200, {
    direct_distance_km: directDistanceKm,
    distance_is_straight_line_estimate: true,
    needs_charging_stop: needsChargingStop,
    suggested_stops: suggestedStops,
  });
}

module.exports = { planRoute };
