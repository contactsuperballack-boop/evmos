const db = require("../db");
const { id } = require("../lib/util");

// Deliberately minimal — this exists so sessionsService doesn't reach
// past its own layer straight into `db` for a charger lookup. It is NOT
// yet the single home for all charger queries; src/routes/stations.js and
// src/routes/queue.js still own the rest of the charger/station read and
// write paths until they're migrated the same way sessions/wallet/coupons/
// loyalty were. See HARDENING_AND_SCOPE.md "Clean architecture migration"
// section for what's migrated vs. still pending.
function findById(chargerId) {
  return db.prepare(`SELECT * FROM chargers WHERE id = ?`).get(chargerId);
}

function findByStation(stationId) {
  return db.prepare(`SELECT * FROM chargers WHERE station_id = ?`).all(stationId);
}

// Batch read used by stationsService.listNearby — one query for every
// charger belonging to any of the given stations, instead of one query
// per station. See the "Performance" section in HARDENING_AND_SCOPE.md
// for why this shape matters.
function listByStationIds(stationIds) {
  if (stationIds.length === 0) return [];
  const placeholders = stationIds.map(() => "?").join(",");
  return db.prepare(`SELECT * FROM chargers WHERE station_id IN (${placeholders})`).all(...stationIds);
}

function create({ stationId, connectorType, pricePerKwh }) {
  const chargerId = id("chg");
  db.prepare(`INSERT INTO chargers (id, station_id, connector_type, price_per_kwh) VALUES (?, ?, ?, ?)`).run(
    chargerId,
    stationId,
    connectorType,
    pricePerKwh
  );
  return findById(chargerId);
}

function updateFields(chargerId, updates) {
  const fields = [];
  const values = [];
  for (const field of ["price_per_kwh", "is_available", "connector_type"]) {
    if (updates[field] !== undefined) {
      fields.push(`${field} = ?`);
      values.push(updates[field]);
    }
  }
  if (fields.length === 0) return null;

  values.push(chargerId);
  db.prepare(`UPDATE chargers SET ${fields.join(", ")} WHERE id = ?`).run(...values);
  return findById(chargerId);
}

function findAvailableByStation(stationId) {
  return db.prepare(`SELECT * FROM chargers WHERE station_id = ? AND is_available = 1`).all(stationId);
}

module.exports = { findById, findByStation, findAvailableByStation, listByStationIds, create, updateFields };

