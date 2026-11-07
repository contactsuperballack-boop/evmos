const vehicles = require("../repositories/vehiclesRepository");
const { ValidationError, ForbiddenError, NotFoundError } = require("../domain/errors");

function create(userId, { make, model, battery_capacity_kwh, year }) {
  if (!make || !model) {
    throw new ValidationError("make and model are required");
  }
  return vehicles.create({ userId, make, model, batteryCapacityKwh: battery_capacity_kwh, year });
}

function listForUser(userId) {
  return vehicles.listForUser(userId);
}

// TOCTOU fix history (same pattern as sessionsService/serviceRequestsService):
// the controller must await the body BEFORE calling this function. This
// function's whole fetch-check-write sequence then runs with zero `await`
// points — closes a lost-update race (two concurrent edits from two
// devices), lower severity than the sessions/mechanics bugs since it's
// single-owner data with no cross-user authorization impact, but same
// root cause and same fix.
function update(user, vehicleId, body) {
  const existing = vehicles.findById(vehicleId);
  if (!existing) throw new NotFoundError("Vehicle not found");
  if (existing.user_id !== user.id) throw new ForbiddenError("Not your vehicle");

  const make = body.make ?? existing.make;
  const model = body.model ?? existing.model;
  const battery_capacity_kwh = body.battery_capacity_kwh ?? existing.battery_capacity_kwh;
  const year = body.year ?? existing.year;

  if (!make || !model) {
    throw new ValidationError("make and model are required");
  }

  return vehicles.update(vehicleId, { make, model, batteryCapacityKwh: battery_capacity_kwh, year });
}

module.exports = { create, listForUser, update };
