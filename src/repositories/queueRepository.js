const db = require("../db");

// PRODUCTION NOTE (build spec, section 2.2): in production this state lives
// in Redis and pushes updates to connected clients over WebSocket within
// ~3 seconds. SQLite is a fine stand-in for local dev — swap in the Redis
// + WebSocket layer before this needs to serve real concurrent load.

function findByChargerId(chargerId) {
  return db.prepare(`SELECT * FROM queue_state WHERE charger_id = ?`).get(chargerId);
}

// Batch read used by stationsService.listNearby.
function listByChargerIds(chargerIds) {
  if (chargerIds.length === 0) return [];
  const placeholders = chargerIds.map(() => "?").join(",");
  return db.prepare(`SELECT * FROM queue_state WHERE charger_id IN (${placeholders})`).all(...chargerIds);
}

function createForCharger(chargerId) {
  db.prepare(`INSERT INTO queue_state (charger_id, current_wait_estimate_min) VALUES (?, 0)`).run(chargerId);
}

function updateWait(chargerId, waitMin) {
  db.prepare(
    `UPDATE queue_state SET current_wait_estimate_min = ?, updated_at = datetime('now') WHERE charger_id = ?`
  ).run(waitMin, chargerId);
  return findByChargerId(chargerId);
}

module.exports = { findByChargerId, listByChargerIds, createForCharger, updateWait };
