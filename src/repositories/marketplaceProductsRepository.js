const db = require("../db");
const { id } = require("../lib/util");

function findById(productId) {
  return db.prepare(`SELECT * FROM marketplace_products WHERE id = ?`).get(productId);
}

function listActive(category) {
  const conditions = ["status = 'active'"];
  const params = [];
  if (category) {
    conditions.push("category = ?");
    params.push(category);
  }
  return db
    .prepare(`SELECT * FROM marketplace_products WHERE ${conditions.join(" AND ")} ORDER BY created_at DESC`)
    .all(...params);
}

function listBySeller(sellerId) {
  return db.prepare(`SELECT * FROM marketplace_products WHERE seller_id = ? ORDER BY created_at DESC`).all(sellerId);
}

function create({ name, category, description, price, stockQty, sellerId }) {
  const productId = id("prd");
  db.prepare(
    `INSERT INTO marketplace_products (id, name, category, description, price, stock_qty, seller_id)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run(productId, name, category, description || null, price, stockQty || 0, sellerId);
  return findById(productId);
}

function updateFields(productId, updates) {
  const fields = [];
  const values = [];
  for (const field of ["price", "stock_qty", "status", "description"]) {
    if (updates[field] !== undefined) {
      fields.push(`${field} = ?`);
      values.push(updates[field]);
    }
  }
  if (fields.length === 0) return null;

  values.push(productId);
  db.prepare(`UPDATE marketplace_products SET ${fields.join(", ")} WHERE id = ?`).run(...values);
  return findById(productId);
}

function decrementStock(productId, qty) {
  db.prepare(`UPDATE marketplace_products SET stock_qty = stock_qty - ? WHERE id = ?`).run(qty, productId);
}

module.exports = { findById, listActive, listBySeller, create, updateFields, decrementStock };
