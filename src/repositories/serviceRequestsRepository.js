const db = require("../db");
const { id } = require("../lib/util");

function findById(requestId) {
  return db.prepare(`SELECT * FROM service_requests WHERE id = ?`).get(requestId);
}

// Joined view used by getServiceRequest — includes the assigned mechanic's
// public info (if any) in one query rather than a separate lookup.
function findByIdWithMechanic(requestId) {
  return db
    .prepare(
      `SELECT sr.*, m.id AS mechanic_id_full, m.tier AS mechanic_tier, m.user_id AS mechanic_user_id,
              u.name AS mechanic_name, u.phone AS mechanic_phone
       FROM service_requests sr
       LEFT JOIN mechanics m ON m.id = sr.mechanic_id
       LEFT JOIN users u ON u.id = m.user_id
       WHERE sr.id = ?`
    )
    .get(requestId);
}

function create(driverId, faultType, lat, lng) {
  const requestId = id("svc");
  db.prepare(`INSERT INTO service_requests (id, driver_id, fault_type, lat, lng) VALUES (?, ?, ?, ?, ?)`).run(
    requestId,
    driverId,
    faultType,
    lat,
    lng
  );
  return findById(requestId);
}

function listOpen() {
  return db.prepare(`SELECT * FROM service_requests WHERE status = 'requested'`).all();
}

function listForMechanic(mechanicId) {
  return db
    .prepare(
      `SELECT sr.*, u.name AS driver_name, u.phone AS driver_phone
       FROM service_requests sr
       JOIN users u ON u.id = sr.driver_id
       WHERE sr.mechanic_id = ?
       ORDER BY sr.created_at DESC`
    )
    .all(mechanicId);
}

function accept(requestId, mechanicId) {
  db.prepare(`UPDATE service_requests SET status = 'accepted', mechanic_id = ? WHERE id = ?`).run(mechanicId, requestId);
  return findById(requestId);
}

function complete(requestId) {
  db.prepare(`UPDATE service_requests SET status = 'completed' WHERE id = ?`).run(requestId);
  return findById(requestId);
}

function cancel(requestId) {
  db.prepare(`UPDATE service_requests SET status = 'cancelled' WHERE id = ?`).run(requestId);
  return findById(requestId);
}

module.exports = { findById, findByIdWithMechanic, create, listOpen, listForMechanic, accept, complete, cancel };
