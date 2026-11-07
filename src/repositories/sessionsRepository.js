const db = require("../db");
const { id } = require("../lib/util");

function findById(sessionId) {
  return db.prepare(`SELECT * FROM charging_sessions WHERE id = ?`).get(sessionId);
}

function findActiveForDriver(driverId) {
  return db.prepare(`SELECT id FROM charging_sessions WHERE driver_id = ? AND ended_at IS NULL`).get(driverId);
}

function listForDriver(driverId) {
  return db.prepare(`SELECT * FROM charging_sessions WHERE driver_id = ? ORDER BY started_at DESC`).all(driverId);
}

function create(driverId, chargerId) {
  const sessionId = id("chgs");
  db.prepare(`INSERT INTO charging_sessions (id, driver_id, charger_id) VALUES (?, ?, ?)`).run(
    sessionId,
    driverId,
    chargerId
  );
  return findById(sessionId);
}

function markEnded(sessionId, { kwhEstimate, paymentStatus, amountCharged }) {
  db.prepare(
    `UPDATE charging_sessions
     SET ended_at = datetime('now'), kwh_estimate = ?, payment_status = ?, amount_charged = ?
     WHERE id = ?`
  ).run(kwhEstimate, paymentStatus, amountCharged, sessionId);
  return findById(sessionId);
}

function listForStation(stationId) {
  return db
    .prepare(
      `SELECT cs.*, c.connector_type, c.price_per_kwh, u.name AS driver_name, u.phone AS driver_phone
       FROM charging_sessions cs
       JOIN chargers c ON c.id = cs.charger_id
       JOIN users u ON u.id = cs.driver_id
       WHERE c.station_id = ?
       ORDER BY cs.started_at DESC`
    )
    .all(stationId);
}

// Analytics aggregations (station-owner-facing, Phase 2 build spec 8:
// "Analytics Dashboard — utilization, revenue, peak-demand charts").
// Grouped here since they're fundamentally sessions aggregations,
// parameterized by charger ids or joined to a station.
function aggregateTotalsForChargers(chargerIds) {
  if (chargerIds.length === 0) {
    return { total_sessions: 0, total_revenue: 0, total_kwh_delivered: 0 };
  }
  const placeholders = chargerIds.map(() => "?").join(",");
  return db
    .prepare(
      `SELECT COUNT(*) AS total_sessions,
              COALESCE(SUM(CASE WHEN payment_status = 'paid' THEN amount_charged ELSE 0 END), 0) AS total_revenue,
              COALESCE(SUM(kwh_estimate), 0) AS total_kwh_delivered
       FROM charging_sessions
       WHERE charger_id IN (${placeholders}) AND ended_at IS NOT NULL`
    )
    .get(...chargerIds);
}

// Peak demand: which hour of day (0-23, local to the server clock) sees
// the most session starts. Good enough for a first-pass "when is it
// busiest" signal without needing a proper analytics warehouse.
function peakHourForChargers(chargerIds) {
  if (chargerIds.length === 0) return null;
  const placeholders = chargerIds.map(() => "?").join(",");
  return db
    .prepare(
      `SELECT strftime('%H', started_at) AS hour, COUNT(*) AS cnt
       FROM charging_sessions
       WHERE charger_id IN (${placeholders})
       GROUP BY hour
       ORDER BY cnt DESC
       LIMIT 1`
    )
    .get(...chargerIds);
}

function sessionStatsByStation(stationId) {
  return db
    .prepare(
      `SELECT c.id AS charger_id, c.connector_type,
              COUNT(cs.id) AS session_count,
              COALESCE(SUM(CASE WHEN cs.payment_status = 'paid' THEN cs.amount_charged ELSE 0 END), 0) AS revenue
       FROM chargers c
       LEFT JOIN charging_sessions cs ON cs.charger_id = c.id AND cs.ended_at IS NOT NULL
       WHERE c.station_id = ?
       GROUP BY c.id`
    )
    .all(stationId);
}

module.exports = {
  findById,
  findActiveForDriver,
  listForDriver,
  listForStation,
  create,
  markEnded,
  aggregateTotalsForChargers,
  peakHourForChargers,
  sessionStatsByStation,
};
