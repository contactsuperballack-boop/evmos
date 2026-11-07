const { json, readBody } = require("../lib/util");
const { requireAuth } = require("../lib/auth");
const { AppError } = require("../domain/errors");
const queueService = require("../services/queueService");

function handle(res, fn) {
  try {
    return fn();
  } catch (err) {
    if (err instanceof AppError) return json(res, err.status, err.body);
    throw err;
  }
}

async function getQueue(req, res, chargerId) {
  handle(res, () => json(res, 200, queueService.getQueue(chargerId)));
}

async function updateQueue(req, res, chargerId) {
  const user = requireAuth(req, res, json);
  if (!user) return;

  const { current_wait_estimate_min } = await readBody(req);
  handle(res, () => json(res, 200, queueService.updateQueue(user, chargerId, current_wait_estimate_min)));
}

module.exports = { getQueue, updateQueue };
