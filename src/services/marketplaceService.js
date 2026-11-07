const products = require("../repositories/marketplaceProductsRepository");
const orders = require("../repositories/marketplaceOrdersRepository");
const walletService = require("./walletService");
const loyaltyService = require("./loyaltyService");
const { id } = require("../lib/util");
const { AppError, ValidationError, ForbiddenError, NotFoundError } = require("../domain/errors");

// SCOPE NOTE (Phase 2 build spec 2.5 / master doc 3.3): this is
// deliberately narrow — EV-specific consumables only (cables, adapters,
// EV-rated tyres, diagnostic tools), not a general marketplace. It's also
// not an open self-serve seller platform yet: only station_owner accounts
// can list products, reusing the existing vetted-business role rather
// than building a separate seller-onboarding/verification system this
// early. Revisit if/when a distinct seller role is actually needed.

function createProduct(user, { name, category, description, price, stock_qty }) {
  if (user.role !== "station_owner") {
    throw new ForbiddenError("Only station_owner accounts can list marketplace products in Phase 2");
  }
  if (!name || !category || price == null) {
    throw new ValidationError("name, category, and price are required");
  }
  return products.create({ name, category, description, price, stockQty: stock_qty, sellerId: user.id });
}

function listActive(category) {
  return products.listActive(category);
}

function listMine(userId) {
  return products.listBySeller(userId);
}

function updateProduct(user, productId, updates) {
  const product = products.findById(productId);
  if (!product) throw new NotFoundError("Product not found");
  if (product.seller_id !== user.id) throw new ForbiddenError("Not your product");

  const updated = products.updateFields(productId, updates);
  if (!updated) throw new ValidationError("No valid fields to update");
  return updated;
}

// The actual checkout. Stock check, wallet debit, and stock decrement all
// need to agree with each other — order matters here: check stock and
// balance BEFORE touching either, so a failed payment never leaves stock
// decremented, and insufficient stock never gets to the payment step.
// NOTE: unlike sessionsService.end / serviceRequestsService.updateStatus,
// this function has never needed the "read body before any DB access"
// TOCTOU fix — the controller already reads the body first here, and nothing
// in this function re-reads a value it fetched earlier after any `await`
// (there are none; this whole function is synchronous). Worth keeping
// this way if it's ever changed.
function createOrder(user, { product_id, qty }) {
  if (!product_id || !qty || qty <= 0) {
    throw new ValidationError("product_id and a positive qty are required");
  }

  const product = products.findById(product_id);
  if (!product || product.status !== "active") {
    throw new NotFoundError("Product not found or no longer available");
  }
  if (product.stock_qty < qty) {
    throw new ValidationError(`Only ${product.stock_qty} in stock`);
  }

  const total = product.price * qty;

  // Generated once, used both for the wallet transaction's metadata and
  // as the actual order row's id — matches the pre-migration code, which
  // also generated a single `orderId` and used it for both, so the wallet
  // transaction and the order it paid for are traceable to the same id.
  const orderId = id("ord");

  const payment = walletService.debit(user.id, total, "marketplace_order", {
    order_id: orderId,
    product_id,
    qty,
  });
  if (!payment.ok) {
    throw new AppError(402, { error: "Insufficient wallet balance", balance: payment.balance, total_due: total });
  }

  products.decrementStock(product_id, qty);
  const order = orders.create({ orderId, buyerId: user.id, productId: product_id, qty, total });
  const loyalty = loyaltyService.awardPointsForPayment(user.id, total, `Marketplace order ${orderId}`);

  return { ...order, points_earned: loyalty.pointsEarned, wallet_balance: payment.balance };
}

function listMyOrders(userId) {
  return orders.listForBuyer(userId);
}

module.exports = { createProduct, listActive, listMine, updateProduct, createOrder, listMyOrders };
