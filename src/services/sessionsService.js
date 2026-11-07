const sessions = require("../repositories/sessionsRepository");
const chargers = require("../repositories/chargersRepository");
const stations = require("../repositories/stationsRepository");
const walletService = require("./walletService");
const couponService = require("./couponService");
const loyaltyService = require("./loyaltyService");
const holdsService = require("../services/holdsService");
const { recordSelection } = require("./recommendationsService");
const { ValidationError, ForbiddenError, NotFoundError, ConflictError } = require("../domain/errors");

// SECURITY HARDENING HISTORY (see HARDENING_AND_SCOPE.md for full detail —
// preserved here because it's exactly the logic this function is
// responsible for getting right, not just historical trivia):
//   1. A negative kwh_estimate used to pass a truthy check and produce a
//      negative charge amount, which the wallet's insufficient-balance
//      check never caught for a negative amount — net effect: ending a
//      session with negative kWh CREDITED the driver's wallet.
//   2. endSession didn't check whether a session was already completed,
//      so calling it twice reprocessed payment, coupons, and loyalty a
//      second time — first fixed as a sequential-call check, then found
//      to still be vulnerable to two CONCURRENT calls (a real TOCTOU
//      race, empirically confirmed to double-charge a wallet) and fixed
//      again by ensuring nothing awaits between the completed-check and
//      the write. That ordering requirement is why `end()` below takes
//      the already-parsed body as a plain argument rather than reading it
//      itself — the HTTP controller is responsible for awaiting the body
//      BEFORE calling into this service, so this function's entire
//      fetch-check-charge-write sequence runs synchronously with no yield
//      point for another request to interleave through.
const MAX_KWH_PER_SESSION = 250; // generous upper bound for any real EV charge; guards against fat-finger or malicious input, not a real vehicle limit

function start(user, chargerId) {
  if (user.role !== "driver") {
    throw new ForbiddenError("Only driver accounts can start a charging session");
  }
  if (!chargerId) throw new ValidationError("charger_id is required");

  const charger = chargers.findById(chargerId);
  if (!charger) throw new NotFoundError("Charger not found");
  if (!charger.is_available) {
    throw new ValidationError("This charger is currently marked offline");
  }

  const station = stations.findById(charger.station_id);
  if (!station || station.status !== "active") {
    throw new ValidationError("This charger's station is not currently active");
  }

  const existingActive = sessions.findActiveForDriver(user.id);
  if (existingActive) {
    throw new ConflictError({
      error: "You already have an active charging session — end it before starting another",
      active_session_id: existingActive.id,
    });
  }

  const session = sessions.create(user.id, chargerId);
  holdsService.fulfillIfPresent(user.id, chargerId);
  recordSelection(user.id, chargerId);
  return session;
}

// IMPORTANT: caller (the HTTP controller) must have already awaited the
// request body and pass it in as `body` — see the TOCTOU comment above.
// This function must not itself perform any `await` before its final
// write, or the race it was specifically fixed to close comes back.
function end(user, sessionId, body) {
  const { kwh_estimate, coupon_code } = body;

  const session = sessions.findById(sessionId);
  if (!session) throw new NotFoundError("Session not found");
  if (session.driver_id !== user.id) {
    throw new ForbiddenError("Not your session");
  }
  if (session.ended_at) {
    throw new ConflictError({
      error: "SESSION_ALREADY_COMPLETED",
      message: "This session has already been completed and cannot be billed again.",
    });
  }

  // Validation fix — this is the negative-kWh fix. Must be a finite
  // positive number under the sanity cap, or the session simply logs
  // with no payment attempt (kwh_estimate omitted entirely is still a
  // valid "just log it" case, same as before).
  let validatedKwh = null;
  if (kwh_estimate !== undefined && kwh_estimate !== null) {
    const n = Number(kwh_estimate);
    if (!Number.isFinite(n) || n <= 0 || n > MAX_KWH_PER_SESSION) {
      throw new ValidationError(`kwh_estimate must be a positive number no greater than ${MAX_KWH_PER_SESSION}`);
    }
    validatedKwh = n;
  }

  let paymentStatus = "unpaid";
  let amountCharged = null;
  let discountApplied = 0;
  let couponResult = null;
  let pointsEarned = 0;

  if (validatedKwh) {
    const charger = chargers.findById(session.charger_id);
    let amount = validatedKwh * (charger ? charger.price_per_kwh : 0);

    if (coupon_code) {
      couponResult = couponService.redeem(coupon_code, user.id, "charging", amount, sessionId);
      if (couponResult.applied) {
        discountApplied = couponResult.discount;
        amount = Math.max(0, amount - discountApplied);
      }
    }

    const result = walletService.chargeForSession(user.id, amount, sessionId);
    if (result.ok) {
      paymentStatus = "paid";
      amountCharged = amount;
      const loyalty = loyaltyService.awardPointsForPayment(user.id, amount, `Charging session ${sessionId}`);
      pointsEarned = loyalty.pointsEarned;
    } else {
      paymentStatus = "insufficient_balance";
    }
  }

  const updated = sessions.markEnded(sessionId, {
    kwhEstimate: validatedKwh,
    paymentStatus,
    amountCharged,
  });

  return {
    ...updated,
    discount_applied: discountApplied,
    coupon_status: couponResult ? (couponResult.applied ? "applied" : couponResult.reason) : undefined,
    points_earned: pointsEarned,
  };
}

function listForDriver(userId) {
  return sessions.listForDriver(userId);
}

module.exports = { start, end, listForDriver };
