const holds = require("../repositories/holdsRepository");
const chargers = require("../repositories/chargersRepository");
const { ValidationError, ForbiddenError, NotFoundError, ConflictError } = require("../domain/errors");

// IMPORTANT — read before touching this file:
// EVMOS does not own or control any charger, and there is no hardware/IoT
// integration that lets the app physically lock a charger. A "hold" here
// is a SOFT, IN-APP-ONLY signal: it coordinates EVMOS's own driver
// traffic against itself (so two EVMOS drivers don't both drive to the
// same charger expecting it free), but it has zero power over a walk-up
// customer who never opened the app. Never let copy anywhere — API
// responses, mobile UI, docs — call this a "reservation" or imply it's
// guaranteed. See the framing discussion logged in DEFERRED_BACKLOG.md /
// PHASE2_PROGRESS.md for why this shape was chosen over a real
// reservation system.

const MAX_HOLD_MINUTES = 20;
const DEFAULT_HOLD_MINUTES = 15;

// A hold can still say status='active' in the DB after hold_until has
// passed — nothing proactively expires it (lazy expiry, checked here at
// read time). Every place that reads a hold's status must go through
// this function rather than trusting the raw `status` column, or a
// long-expired hold will look active forever.
function effectiveStatus(hold) {
  if (hold.status === "active" && new Date(hold.hold_until) < new Date()) {
    return "expired";
  }
  return hold.status;
}

function create(user, chargerId, durationMinutes) {
  if (!chargerId) throw new ValidationError("charger_id is required");

  const charger = chargers.findById(chargerId);
  if (!charger) throw new NotFoundError("Charger not found");
  if (!charger.is_available) {
    throw new ValidationError("This charger is currently marked offline by the station");
  }

  const minutes = Math.min(durationMinutes || DEFAULT_HOLD_MINUTES, MAX_HOLD_MINUTES);

  // Only one active in-app hold per charger at a time — this is the whole
  // point (coordinate EVMOS's own drivers), not a guarantee against
  // walk-up customers, who this check has no visibility into at all.
  const existing = holds.findActiveForCharger(chargerId);
  if (existing && effectiveStatus(existing) === "active") {
    if (existing.driver_id === user.id) {
      throw new ConflictError("You already have an active hold on this charger");
    }
    throw new ConflictError({
      error: "Another EVMOS driver has a heads-up hold on this charger right now",
      held_until: existing.hold_until,
    });
  }

  const holdUntil = new Date(Date.now() + minutes * 60 * 1000).toISOString();
  const hold = holds.create({ driverId: user.id, chargerId, holdUntil });

  return {
    ...hold,
    disclaimer:
      "This holds your spot with other EVMOS drivers only — it can't stop a walk-up customer at the station from using the charger.",
  };
}

function listMine(userId) {
  return holds.listForDriver(userId).map((h) => ({ ...h, status: effectiveStatus(h) }));
}

function cancel(user, holdId) {
  const hold = holds.findById(holdId);
  if (!hold) throw new NotFoundError("Hold not found");
  if (hold.driver_id !== user.id) throw new ForbiddenError("Not your hold");

  const status = effectiveStatus(hold);
  if (status !== "active") {
    throw new ValidationError(`Hold is already ${status}`);
  }

  return holds.setStatus(holdId, "cancelled");
}

// Called from sessionsService.start — if the driver starting a session
// has their own active hold on that charger, mark it fulfilled. Silent
// no-op otherwise (including if someone ELSE holds it — that's not
// enforced, per the whole point of this feature).
function fulfillIfPresent(driverId, chargerId) {
  const hold = holds.findActiveForDriverAndCharger(chargerId, driverId);
  if (hold && effectiveStatus(hold) === "active") {
    holds.setStatus(hold.id, "fulfilled");
  }
}

// Single-charger lookup, used by routePlanning.js (not yet migrated) so
// drivers can see a hold before choosing a charger along a route — the
// batched equivalent used by stationsService.listNearby lives directly on
// the repository (listActiveByChargerIds) since that's a performance-
// specific concern, not part of the hold lifecycle this service owns.
function getActiveHoldForCharger(chargerId) {
  const hold = holds.findActiveForCharger(chargerId);
  if (!hold || effectiveStatus(hold) !== "active") return null;
  return { held_until: hold.hold_until };
}

module.exports = { create, listMine, cancel, fulfillIfPresent, getActiveHoldForCharger };
