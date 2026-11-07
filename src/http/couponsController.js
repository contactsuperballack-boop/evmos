const { json, readBody } = require("../lib/util");
const { requireAuth } = require("../lib/auth");
const { AppError } = require("../domain/errors");
const couponService = require("../services/couponService");

async function createCoupon(req, res) {
  const user = requireAuth(req, res, json);
  if (!user) return;

  const body = await readBody(req);
  try {
    json(res, 201, couponService.create(user.id, body));
  } catch (err) {
    if (err instanceof AppError) return json(res, err.status, err.body);
    throw err;
  }
}

async function myCoupons(req, res) {
  const user = requireAuth(req, res, json);
  if (!user) return;

  json(res, 200, couponService.listMine(user.id));
}

async function validateCoupon(req, res) {
  const user = requireAuth(req, res, json);
  if (!user) return;

  const { code, scope } = await readBody(req);
  try {
    json(res, 200, couponService.validate(user.id, code, scope));
  } catch (err) {
    if (err instanceof AppError) return json(res, err.status, err.body);
    throw err;
  }
}

module.exports = { createCoupon, myCoupons, validateCoupon };
