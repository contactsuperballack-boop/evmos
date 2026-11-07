const db = require("../db");
const { id } = require("../lib/util");

// Every direct SQL statement touching `wallets` / `transactions` lives
// here and nowhere else. This is the layer that would change if this
// project ever moves off SQLite (per the MVP spec's own stated direction:
// "Move production persistence to PostgreSQL/PostGIS before scale") —
// the services above this never issue SQL themselves, so that migration
// touches this one file per aggregate, not every business-logic path.

function findByUserId(userId) {
  return db.prepare(`SELECT * FROM wallets WHERE user_id = ?`).get(userId);
}

function findById(walletId) {
  return db.prepare(`SELECT * FROM wallets WHERE id = ?`).get(walletId);
}

function create(userId) {
  const walletId = id("wal");
  db.prepare(`INSERT INTO wallets (id, user_id) VALUES (?, ?)`).run(walletId, userId);
  return findById(walletId);
}

function credit(walletId, amount) {
  db.prepare(`UPDATE wallets SET balance = balance + ? WHERE id = ?`).run(amount, walletId);
}

function debit(walletId, amount) {
  db.prepare(`UPDATE wallets SET balance = balance - ? WHERE id = ?`).run(amount, walletId);
}

function insertTransaction({ walletId, type, amount, reference, status, metadata }) {
  db.prepare(
    `INSERT INTO transactions (id, wallet_id, type, amount, reference, status, metadata)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run(id("tx"), walletId, type, amount, reference, status, JSON.stringify(metadata || {}));
}

function listTransactions(walletId, limit = 50) {
  return db
    .prepare(`SELECT * FROM transactions WHERE wallet_id = ? ORDER BY created_at DESC LIMIT ?`)
    .all(walletId, limit);
}

module.exports = { findByUserId, findById, create, credit, debit, insertTransaction, listTransactions };
