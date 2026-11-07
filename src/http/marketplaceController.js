const { json, readBody } = require("../lib/util");
const { requireAuth } = require("../lib/auth");
const { AppError } = require("../domain/errors");
const marketplaceService = require("../services/marketplaceService");

function handle(res, fn) {
  try {
    return fn();
  } catch (err) {
    if (err instanceof AppError) return json(res, err.status, err.body);
    throw err;
  }
}

async function createProduct(req, res) {
  const user = requireAuth(req, res, json);
  if (!user) return;

  const body = await readBody(req);
  handle(res, () => json(res, 201, marketplaceService.createProduct(user, body)));
}

async function listProducts(req, res, query) {
  json(res, 200, marketplaceService.listActive(query.category));
}

async function myProducts(req, res) {
  const user = requireAuth(req, res, json);
  if (!user) return;

  json(res, 200, marketplaceService.listMine(user.id));
}

async function updateProduct(req, res, productId) {
  const user = requireAuth(req, res, json);
  if (!user) return;

  const updates = await readBody(req);
  handle(res, () => json(res, 200, marketplaceService.updateProduct(user, productId, updates)));
}

async function createOrder(req, res) {
  const user = requireAuth(req, res, json);
  if (!user) return;

  const body = await readBody(req);
  handle(res, () => json(res, 201, marketplaceService.createOrder(user, body)));
}

async function myOrders(req, res) {
  const user = requireAuth(req, res, json);
  if (!user) return;

  json(res, 200, marketplaceService.listMyOrders(user.id));
}

module.exports = { createProduct, listProducts, myProducts, updateProduct, createOrder, myOrders };
