const db = require("../db");
const { id } = require("../lib/util");

function findById(vehicleId) {
  return db.prepare(`SELECT * FROM vehicles WHERE id = ?`).get(vehicleId);
}

function listForUser(userId) {
  return db.prepare(`SELECT * FROM vehicles WHERE user_id = ? ORDER BY created_at DESC`).all(userId);
}

function create({ userId, make, model, batteryCapacityKwh, year }) {
  const vehicleId = id("veh");
  db.prepare(
    `INSERT INTO vehicles (id, user_id, make, model, battery_capacity_kwh, year) VALUES (?, ?, ?, ?, ?, ?)`
  ).run(vehicleId, userId, make, model, batteryCapacityKwh || null, year || null);
  return findById(vehicleId);
}

function update(vehicleId, { make, model, batteryCapacityKwh, year }) {
  db.prepare(
    `UPDATE vehicles SET make = ?, model = ?, battery_capacity_kwh = ?, year = ? WHERE id = ?`
  ).run(make, model, batteryCapacityKwh || null, year || null, vehicleId);
  return findById(vehicleId);
}

module.exports = { findById, listForUser, create, update };
