const { json } = require("../lib/util");
const { requireAuth } = require("../lib/auth");
const { AppError } = require("../domain/errors");
const recommendationsService = require("../services/recommendationsService");

async function getRecommendations(req, res, query) {
  const user = requireAuth(req, res, json);
  if (!user) return;

  const lat = parseFloat(query.lat);
  const lng = parseFloat(query.lng);
  const radiusKm = query.radius_km ? parseFloat(query.radius_km) : 15;

  try {
    json(res, 200, recommendationsService.getRecommendations(user, lat, lng, radiusKm));
  } catch (err) {
    if (err instanceof AppError) return json(res, err.status, err.body);
    throw err;
  }
}

module.exports = { getRecommendations };
