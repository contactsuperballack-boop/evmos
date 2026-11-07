const db = require("../db");
const { id } = require("../lib/util");

function insert(driverId, optionsShown, chargerRecommended) {
  const logId = id("airec");
  db.prepare(
    `INSERT INTO ai_recommendation_logs (id, driver_id, options_shown, charger_recommended)
     VALUES (?, ?, ?, ?)`
  ).run(logId, driverId, JSON.stringify(optionsShown), chargerRecommended);
  return logId;
}

function findMostRecentUnselectedForDriver(driverId) {
  return db
    .prepare(
      `SELECT * FROM ai_recommendation_logs
       WHERE driver_id = ? AND charger_selected IS NULL
       ORDER BY created_at DESC LIMIT 1`
    )
    .get(driverId);
}

function recordSelectedCharger(logId, chargerId) {
  db.prepare(`UPDATE ai_recommendation_logs SET charger_selected = ? WHERE id = ?`).run(chargerId, logId);
}

module.exports = { insert, findMostRecentUnselectedForDriver, recordSelectedCharger };
