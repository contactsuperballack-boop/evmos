const { json, readBody } = require("../lib/util");
const { requireAuth } = require("../lib/auth");
const { AppError } = require("../domain/errors");
const holdsService = require("../services/holdsService");

function handle(res, fn) {
  try {
    return fn();
  } catch (err) {
    if (err instanceof AppError) return json(res, err.status, err.body);
    throw err;
  }
}

async function createHold(req, res) {
  const user = requireAuth(req, res, json);
  if (!user) return;

  const { charger_id, duration_minutes } = await readBody(req);
  handle(res, () => json(res, 201, holdsService.create(user, charger_id, duration_minutes)));
}

async function myHolds(req, res) {
  const user = requireAuth(req, res, json);
  if (!user) return;

  json(res, 200, holdsService.listMine(user.id));
}

async function cancelHold(req, res, holdId) {
  const user = requireAuth(req, res, json);
  if (!user) return;

  handle(res, () => json(res, 200, holdsService.cancel(user, holdId)));
}

module.exports = { createHold, myHolds, cancelHold };
