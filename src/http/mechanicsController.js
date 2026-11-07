const { json, readBody } = require("../lib/util");
const { requireAuth } = require("../lib/auth");
const { AppError } = require("../domain/errors");
const mechanicsService = require("../services/mechanicsService");

function handle(res, fn) {
  try {
    return fn();
  } catch (err) {
    if (err instanceof AppError) return json(res, err.status, err.body);
    throw err;
  }
}

async function registerMechanic(req, res) {
  const user = requireAuth(req, res, json);
  if (!user) return;

  const { verification_docs_url } = await readBody(req);
  handle(res, () => json(res, 201, mechanicsService.register(user, verification_docs_url)));
}

async function myMechanicProfile(req, res) {
  const user = requireAuth(req, res, json);
  if (!user) return;

  handle(res, () => json(res, 200, mechanicsService.getMyProfile(user)));
}

async function uploadDocument(req, res) {
  const user = requireAuth(req, res, json);
  if (!user) return;

  const body = await readBody(req, mechanicsService.MAX_DOCUMENT_BASE64_LENGTH + 4096);
  handle(res, () => json(res, 201, mechanicsService.uploadDocument(user, body)));
}

module.exports = { registerMechanic, myMechanicProfile, uploadDocument };
