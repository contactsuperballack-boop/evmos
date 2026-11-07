const db = require("../db");
const { id } = require("../lib/util");

// Batch method used by stationsService.listNearby — kept separate from
// the rest since it's a performance-critical grouped query specific to
// that one view (see HARDENING_AND_SCOPE.md "Performance" section). This
// full CRUD file supersedes the earlier minimal read-only version created
// during the Sprint 1 stations/queue migration, now that stationReviews.js
// itself is migrated.
function ratingsForStations(stationIds) {
  const ratingByStation = new Map();
  if (stationIds.length === 0) return ratingByStation;

  const placeholders = stationIds.map(() => "?").join(",");
  const rows = db
    .prepare(
      `SELECT station_id, COUNT(*) AS count, AVG(rating) AS avg
       FROM station_reviews WHERE station_id IN (${placeholders})
       GROUP BY station_id`
    )
    .all(...stationIds);

  for (const r of rows) {
    ratingByStation.set(r.station_id, {
      review_count: r.count,
      average_rating: r.avg != null ? Math.round(r.avg * 10) / 10 : null,
    });
  }
  return ratingByStation;
}

function ratingSummary(stationId) {
  const row = db
    .prepare(`SELECT COUNT(*) AS count, AVG(rating) AS avg FROM station_reviews WHERE station_id = ?`)
    .get(stationId);
  return {
    review_count: row.count,
    average_rating: row.avg != null ? Math.round(row.avg * 10) / 10 : null,
  };
}

function listForStation(stationId) {
  return db
    .prepare(
      `SELECT r.*, u.name AS driver_name
       FROM station_reviews r
       JOIN users u ON u.id = r.driver_id
       WHERE r.station_id = ?
       ORDER BY r.created_at DESC`
    )
    .all(stationId);
}

function create({ stationId, driverId, sessionId, rating, comment }) {
  const reviewId = id("srev");
  db.prepare(
    `INSERT INTO station_reviews (id, station_id, driver_id, session_id, rating, comment)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).run(reviewId, stationId, driverId, sessionId, rating, comment || null);
  return db.prepare(`SELECT * FROM station_reviews WHERE id = ?`).get(reviewId);
}

module.exports = { ratingsForStations, ratingSummary, listForStation, create };
