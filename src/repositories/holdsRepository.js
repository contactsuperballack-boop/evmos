const db = require("../db");
const { id } = require("../lib/util");

// Read-only batch method used by stationsService.listNearby — kept
// separate from the full CRUD below since it's a performance-critical
// batched query specific to that one view (see HARDENING_AND_SCOPE.md
// "Performance" section), not part of the hold lifecycle itself.
function listActiveByChargerIds(chargerIds) {
  const activeHoldByCharger = new Map();
  if (chargerIds.length === 0) return activeHoldByCharger;

  const placeholders = chargerIds.map(() => "?").join(",");
  const holdRows = db
    .prepare(`SELECT * FROM holds WHERE charger_id IN (${placeholders}) AND status = 'active'`)
    .all(...chargerIds);

  const now = new Date();
  for (const h of holdRows) {
    if (new Date(h.hold_until) >= now) {
      activeHoldByCharger.set(h.charger_id, { held_until: h.hold_until });
    }
  }
  return activeHoldByCharger;
}

function findById(holdId) {
  return db.prepare(`SELECT * FROM holds WHERE id = ?`).get(holdId);
}

function findActiveForCharger(chargerId) {
  return db.prepare(`SELECT * FROM holds WHERE charger_id = ? AND status = 'active'`).get(chargerId);
}

function findActiveForDriverAndCharger(chargerId, driverId) {
  return db
    .prepare(`SELECT * FROM holds WHERE charger_id = ? AND driver_id = ? AND status = 'active'`)
    .get(chargerId, driverId);
}

function listForDriver(driverId) {
  return db.prepare(`SELECT * FROM holds WHERE driver_id = ? ORDER BY created_at DESC`).all(driverId);
}

function create({ driverId, chargerId, holdUntil }) {
  const holdId = id("hld");
  db.prepare(`INSERT INTO holds (id, driver_id, charger_id, hold_until) VALUES (?, ?, ?, ?)`).run(
    holdId,
    driverId,
    chargerId,
    holdUntil
  );
  return findById(holdId);
}

function setStatus(holdId, status) {
  db.prepare(`UPDATE holds SET status = ? WHERE id = ?`).run(status, holdId);
  return findById(holdId);
}

module.exports = {
  listActiveByChargerIds,
  findById,
  findActiveForCharger,
  findActiveForDriverAndCharger,
  listForDriver,
  create,
  setStatus,
};

