const { json, readBody } = require("../lib/util");
const { requireAuth } = require("../lib/auth");
const { AppError } = require("../domain/errors");
const sessionsService = require("../services/sessionsService");

// Every handler here does the same three things and nothing else:
// authenticate, gather input, call the service, translate the result (or
// AppError) into a wire response. No business rule lives in this file —
// if you're tempted to add an `if` that checks a business condition here,
// it belongs in sessionsService instead.

async function startSession(req, res) {
  const user = requireAuth(req, res, json);
  if (!user) return;

  const { charger_id } = await readBody(req);
  try {
    const session = sessionsService.start(user, charger_id);
    json(res, 201, session);
  } catch (err) {
    if (err instanceof AppError) return json(res, err.status, err.body);
    throw err;
  }
}

async function endSession(req, res, sessionId) {
  const user = requireAuth(req, res, json);
  if (!user) return;

  // Body must be fully read and awaited HERE, before calling into the
  // service — sessionsService.end() is written to run its entire
  // fetch-check-charge-write sequence synchronously with no `await` in
  // between, which is what actually closes the double-billing race (see
  // the comment at the top of sessionsService.js). Awaiting the body
  // first, in the controller, is what makes that guarantee hold.
  const body = await readBody(req);
  try {
    const result = sessionsService.end(user, sessionId, body);
    json(res, 200, result);
  } catch (err) {
    if (err instanceof AppError) return json(res, err.status, err.body);
    throw err;
  }
}

async function listSessions(req, res) {
  const user = requireAuth(req, res, json);
  if (!user) return;

  json(res, 200, sessionsService.listForDriver(user.id));
}

module.exports = { startSession, endSession, listSessions };
