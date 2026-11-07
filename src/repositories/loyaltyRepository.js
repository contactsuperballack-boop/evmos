const db = require("../db");
const { id } = require("../lib/util");

function findByUserId(userId) {
  return db.prepare(`SELECT * FROM loyalty_accounts WHERE user_id = ?`).get(userId);
}

function findById(accountId) {
  return db.prepare(`SELECT * FROM loyalty_accounts WHERE id = ?`).get(accountId);
}

function create(userId) {
  const accountId = id("loy");
  db.prepare(`INSERT INTO loyalty_accounts (id, user_id) VALUES (?, ?)`).run(accountId, userId);
  return findById(accountId);
}

function updateBalance(accountId, pointsBalance, tier) {
  db.prepare(`UPDATE loyalty_accounts SET points_balance = ?, tier = ? WHERE id = ?`).run(
    pointsBalance,
    tier,
    accountId
  );
}

function insertLedgerEntry(accountId, pointsDelta, reason) {
  db.prepare(
    `INSERT INTO loyalty_ledger (id, loyalty_account_id, points_delta, reason) VALUES (?, ?, ?, ?)`
  ).run(id("loyl"), accountId, pointsDelta, reason);
}

function listLedger(accountId, limit = 50) {
  return db
    .prepare(`SELECT * FROM loyalty_ledger WHERE loyalty_account_id = ? ORDER BY created_at DESC LIMIT ?`)
    .all(accountId, limit);
}

module.exports = { findByUserId, findById, create, updateBalance, insertLedgerEntry, listLedger };
