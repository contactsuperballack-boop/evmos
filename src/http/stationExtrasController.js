const { json, readBody } = require("../lib/util");
const { requireAuth } = require("../lib/auth");
const { AppError } = require("../domain/errors");
const stationExtrasService = require("../services/stationExtrasService");

function handle(res, fn) {
  try {
    return fn();
  } catch (err) {
    if (err instanceof AppError) return json(res, err.status, err.body);
    throw err;
  }
}

async function getAnalytics(req, res, stationId) {
  const user = requireAuth(req, res, json);
  if (!user) return;

  handle(res, () => json(res, 200, stationExtrasService.getAnalytics(user, stationId)));
}

async function createFeaturedListing(req, res, stationId) {
  const user = requireAuth(req, res, json);
  if (!user) return;

  const { days } = await readBody(req);
  handle(res, () => json(res, 201, stationExtrasService.createFeaturedListing(user, stationId, days)));
}

module.exports = { getAnalytics, createFeaturedListing };
