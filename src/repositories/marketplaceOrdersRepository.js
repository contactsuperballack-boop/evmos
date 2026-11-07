const db = require("../db");

function findById(orderId) {
  return db.prepare(`SELECT * FROM marketplace_orders WHERE id = ?`).get(orderId);
}

function create({ orderId, buyerId, productId, qty, total }) {
  db.prepare(
    `INSERT INTO marketplace_orders (id, buyer_id, product_id, qty, total, status) VALUES (?, ?, ?, ?, ?, 'paid')`
  ).run(orderId, buyerId, productId, qty, total);
  return findById(orderId);
}

function listForBuyer(buyerId) {
  return db
    .prepare(
      `SELECT o.*, p.name AS product_name, p.category
       FROM marketplace_orders o
       JOIN marketplace_products p ON p.id = o.product_id
       WHERE o.buyer_id = ? ORDER BY o.created_at DESC`
    )
    .all(buyerId);
}

module.exports = { findById, create, listForBuyer };
