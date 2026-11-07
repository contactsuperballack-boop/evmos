const { json, readBody } = require("../lib/util");
const { requireAuth } = require("../lib/auth");
const { AppError } = require("../domain/errors");
const vehiclesService = require("../services/vehiclesService");

function handle(res, fn) {
  try {
    return fn();
  } catch (err) {
    if (err instanceof AppError) return json(res, err.status, err.body);
    throw err;
  }
}

async function createVehicle(req, res) {
  const user = requireAuth(req, res, json);
  if (!user) return;

  const body = await readBody(req);
  handle(res, () => json(res, 201, vehiclesService.create(user.id, body)));
}

async function listVehicles(req, res) {
  const user = requireAuth(req, res, json);
  if (!user) return;

  json(res, 200, vehiclesService.listForUser(user.id));
}

// See the comment on vehiclesService.update — body must be awaited here,
// before calling the service, for the TOCTOU fix to hold.
async function updateVehicle(req, res, vehicleId) {
  const user = requireAuth(req, res, json);
  if (!user) return;

  const body = await readBody(req);
  handle(res, () => json(res, 200, vehiclesService.update(user, vehicleId, body)));
}

module.exports = { createVehicle, listVehicles, updateVehicle };
