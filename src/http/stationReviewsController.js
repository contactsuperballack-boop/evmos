const { json, readBody } = require("../lib/util");
const { requireAuth } = require("../lib/auth");
const { AppError } = require("../domain/errors");
const stationReviewsService = require("../services/stationReviewsService");

async function createStationReview(req, res) {
  const user = requireAuth(req, res, json);
  if (!user) return;

  const body = await readBody(req);
  try {
    json(res, 201, stationReviewsService.create(user, body));
  } catch (err) {
    if (err instanceof AppError) return json(res, err.status, err.body);
    throw err;
  }
}

async function listStationReviews(req, res, stationId) {
  json(res, 200, stationReviewsService.listForStation(stationId));
}

module.exports = { createStationReview, listStationReviews };
