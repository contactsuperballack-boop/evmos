const db = require("../db");
const { id } = require("../lib/util");

function findByUserId(userId) {
  return db.prepare(`SELECT * FROM mechanics WHERE user_id = ?`).get(userId);
}

function findById(mechanicId) {
  return db.prepare(`SELECT * FROM mechanics WHERE id = ?`).get(mechanicId);
}

function create(userId, verificationDocsUrl) {
  const mechanicId = id("mch");
  db.prepare(`INSERT INTO mechanics (id, user_id, verification_docs_url) VALUES (?, ?, ?)`).run(
    mechanicId,
    userId,
    verificationDocsUrl || null
  );
  return findById(mechanicId);
}

function listDocuments(mechanicId) {
  return db
    .prepare(`SELECT id, filename, mime_type, uploaded_at FROM mechanic_documents WHERE mechanic_id = ?`)
    .all(mechanicId);
}

function insertDocument({ mechanicId, filename, mimeType, contentBase64 }) {
  const docId = id("doc");
  db.prepare(
    `INSERT INTO mechanic_documents (id, mechanic_id, filename, mime_type, content_base64)
     VALUES (?, ?, ?, ?, ?)`
  ).run(docId, mechanicId, filename, mimeType, contentBase64);
  return docId;
}

function ratingSummary(mechanicId) {
  const row = db
    .prepare(`SELECT COUNT(*) AS count, AVG(rating) AS avg FROM mechanic_reviews WHERE mechanic_id = ?`)
    .get(mechanicId);
  return {
    review_count: row.count,
    average_rating: row.avg != null ? Math.round(row.avg * 10) / 10 : null,
  };
}

function findReviewByRequestId(serviceRequestId) {
  return db.prepare(`SELECT 1 FROM mechanic_reviews WHERE service_request_id = ?`).get(serviceRequestId);
}

function insertReview({ mechanicId, driverId, serviceRequestId, rating, comment }) {
  const reviewId = id("rev");
  db.prepare(
    `INSERT INTO mechanic_reviews (id, mechanic_id, driver_id, service_request_id, rating, comment)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).run(reviewId, mechanicId, driverId, serviceRequestId, rating, comment || null);
  return db.prepare(`SELECT * FROM mechanic_reviews WHERE id = ?`).get(reviewId);
}

function listReviewsForMechanic(mechanicId) {
  return db
    .prepare(
      `SELECT r.*, u.name AS driver_name
       FROM mechanic_reviews r
       JOIN users u ON u.id = r.driver_id
       WHERE r.mechanic_id = ?
       ORDER BY r.created_at DESC`
    )
    .all(mechanicId);
}

module.exports = {
  findByUserId,
  findById,
  create,
  listDocuments,
  insertDocument,
  ratingSummary,
  findReviewByRequestId,
  insertReview,
  listReviewsForMechanic,
};
