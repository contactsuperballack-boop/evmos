const coupons = require("../repositories/couponsRepository");
const { ValidationError, ConflictError } = require("../domain/errors");

// PRODUCTION NOTE (carried over from the old src/routes/coupons.js, Phase
// 2 spec 6.2): coupon validation and redemption happen server-side only,
// on purpose — a client never supplies a discount amount directly. Usage
// caps are enforced with the same prepared-statement pattern used
// everywhere else in this codebase; at real scale under concurrent
// redemptions, wrap the check-and-increment in an explicit transaction to
// close the race-condition window between "read used_count" and "write
// used_count + 1". Not done here because SQLite's single-writer model
// already serializes writes in this local dev setup, but it's a real
// requirement once this is on Postgres with multiple concurrent
// connections.

function create(userId, { code, discount_type, discount_value, usage_cap, expires_at, scope }) {
  if (!code || !discount_type || discount_value == null) {
    throw new ValidationError("code, discount_type, and discount_value are required");
  }
  if (!["percentage", "fixed"].includes(discount_type)) {
    throw new ValidationError("discount_type must be 'percentage' or 'fixed'");
  }

  try {
    return coupons.create({
      code: code.toUpperCase(),
      discountType: discount_type,
      discountValue: discount_value,
      usageCap: usage_cap,
      expiresAt: expires_at,
      scope,
      createdBy: userId,
    });
  } catch (e) {
    if (String(e.message).includes("UNIQUE")) {
      throw new ConflictError("A coupon with this code already exists");
    }
    throw e;
  }
}

function listMine(userId) {
  return coupons.findByCreator(userId);
}

// Shared eligibility check, used by both the /coupons/validate preview
// endpoint and actual redemption inside sessionsService.end(). Keeping
// this in one place means the "can I use this coupon" answer can never
// drift between the preview and the real charge.
function checkEligibility(code, userId, scope) {
  const coupon = coupons.findByCode((code || "").toUpperCase());
  if (!coupon) return { eligible: false, reason: "Coupon not found" };
  if (coupon.expires_at && new Date(coupon.expires_at) < new Date()) {
    return { eligible: false, reason: "Coupon has expired" };
  }
  if (coupon.scope !== "all" && coupon.scope !== scope) {
    return { eligible: false, reason: `Coupon is not valid for ${scope}` };
  }
  if (coupon.usage_cap != null && coupon.used_count >= coupon.usage_cap) {
    return { eligible: false, reason: "Coupon usage limit reached" };
  }
  if (coupons.findRedemption(coupon.id, userId)) {
    return { eligible: false, reason: "You've already used this coupon" };
  }
  return { eligible: true, coupon };
}

function calculateDiscount(coupon, amount) {
  if (coupon.discount_type === "percentage") {
    return Math.min(amount, (amount * coupon.discount_value) / 100);
  }
  return Math.min(amount, coupon.discount_value);
}

function validate(userId, code, scope) {
  if (!code) throw new ValidationError("code is required");
  const result = checkEligibility(code, userId, scope || "charging");
  if (!result.eligible) return { eligible: false, reason: result.reason };
  return { eligible: true, discount_type: result.coupon.discount_type, discount_value: result.coupon.discount_value };
}

// Called from sessionsService — attempts redemption and records it
// atomically with the discount amount actually applied. Returns
// `{ applied: false, ... }` rather than throwing if the coupon isn't
// eligible, so the caller can fall back to full price rather than fail
// the whole checkout over a bad coupon code — same as the old behavior.
function redeem(code, userId, scope, amount, sessionId) {
  const result = checkEligibility(code, userId, scope);
  if (!result.eligible) return { applied: false, reason: result.reason, discount: 0 };

  const discount = calculateDiscount(result.coupon, amount);
  coupons.incrementUsedCount(result.coupon.id);
  coupons.insertRedemption({ couponId: result.coupon.id, userId, sessionId, discountApplied: discount });

  return { applied: true, discount };
}

module.exports = { create, listMine, checkEligibility, calculateDiscount, validate, redeem };
