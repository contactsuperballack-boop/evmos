const db = require("../db");
const { id } = require("../lib/util");

// Batch read used by stationsService.listNearby.
function listActiveStationIds(stationIds) {
  if (stationIds.length === 0) return new Set();
  const placeholders = stationIds.map(() => "?").join(",");
  const rows = db
    .prepare(`SELECT station_id FROM featured_listings WHERE station_id IN (${placeholders}) AND ends_at > datetime('now')`)
    .all(...stationIds);
  return new Set(rows.map((r) => r.station_id));
}

function isActiveForStation(stationId) {
  const row = db
    .prepare(`SELECT 1 FROM featured_listings WHERE station_id = ? AND ends_at > datetime('now')`)
    .get(stationId);
  return !!row;
}

function create({ stationId, endsAt, amountPaid }) {
  const listingId = id("feat");
  db.prepare(`INSERT INTO featured_listings (id, station_id, ends_at, amount_paid) VALUES (?, ?, ?, ?)`).run(
    listingId,
    stationId,
    endsAt,
    amountPaid
  );
  return db.prepare(`SELECT * FROM featured_listings WHERE id = ?`).get(listingId);
}

module.exports = { listActiveStationIds, isActiveForStation, create };
