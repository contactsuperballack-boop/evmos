const db = require("../db");
const { id } = require("../lib/util");

// Same note as chargersRepository.js — minimal, scoped to what
// sessionsService needs, expanded now that stations.js is migrated too.
function findById(stationId) {
  return db.prepare(`SELECT * FROM stations WHERE id = ?`).get(stationId);
}

function findByOwner(ownerId) {
  return db.prepare(`SELECT * FROM stations WHERE owner_id = ? ORDER BY created_at DESC`).all(ownerId);
}

function listActive() {
  return db.prepare(`SELECT * FROM stations WHERE status = 'active'`).all();
}

function create({ ownerId, name, lat, lng, address }) {
  const stationId = id("stn");
  db.prepare(`INSERT INTO stations (id, owner_id, name, lat, lng, address) VALUES (?, ?, ?, ?, ?, ?)`).run(
    stationId,
    ownerId,
    name,
    lat,
    lng,
    address || null
  );
  return findById(stationId);
}

function activate(stationId) {
  db.prepare(`UPDATE stations SET status = 'active' WHERE id = ?`).run(stationId);
  return findById(stationId);
}

module.exports = { findById, findByOwner, listActive, create, activate };
