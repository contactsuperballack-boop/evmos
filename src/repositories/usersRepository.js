const db = require("../db");
const { id } = require("../lib/util");

function findByPhone(phone) {
  return db.prepare(`SELECT * FROM users WHERE phone = ?`).get(phone);
}

function findById(userId) {
  return db.prepare(`SELECT * FROM users WHERE id = ?`).get(userId);
}

function create({ phone, name, role }) {
  const userId = id("usr");
  db.prepare(`INSERT INTO users (id, phone, name, role) VALUES (?, ?, ?, ?)`).run(userId, phone, name || null, role);
  return findById(userId);
}

module.exports = { findByPhone, findById, create };
