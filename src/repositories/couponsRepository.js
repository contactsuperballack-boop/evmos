const db = require("../db");
const { id } = require("../lib/util");

function findByCode(code) {
  return db.prepare(`SELECT * FROM coupons WHERE code = ?`).get(code);
}

function findById(couponId) {
  return db.prepare(`SELECT * FROM coupons WHERE id = ?`).get(couponId);
}

function findByCreator(userId) {
  return db.prepare(`SELECT * FROM coupons WHERE created_by = ? ORDER BY created_at DESC`).all(userId);
}

function create({ code, discountType, discountValue, usageCap, expiresAt, scope, createdBy }) {
  const couponId = id("cpn");
  db.prepare(
    `INSERT INTO coupons (id, code, discount_type, discount_value, usage_cap, expires_at, scope, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(couponId, code, discountType, discountValue, usageCap ?? null, expiresAt ?? null, scope || "all", createdBy);
  return findById(couponId);
}

function incrementUsedCount(couponId) {
  db.prepare(`UPDATE coupons SET used_count = used_count + 1 WHERE id = ?`).run(couponId);
}

function findRedemption(couponId, userId) {
  return db.prepare(`SELECT 1 FROM coupon_redemptions WHERE coupon_id = ? AND user_id = ?`).get(couponId, userId);
}

function insertRedemption({ couponId, userId, sessionId, discountApplied }) {
  db.prepare(
    `INSERT INTO coupon_redemptions (id, coupon_id, user_id, session_id, discount_applied) VALUES (?, ?, ?, ?, ?)`
  ).run(id("rdm"), couponId, userId, sessionId ?? null, discountApplied);
}

module.exports = { findByCode, findById, findByCreator, create, incrementUsedCount, findRedemption, insertRedemption };
