const reviews = require("../repositories/stationReviewsRepository");
const sessions = require("../repositories/sessionsRepository");
const chargers = require("../repositories/chargersRepository");
const { ValidationError, NotFoundError, ForbiddenError, ConflictError } = require("../domain/errors");

// Driver reviews a station after a completed charging session there —
// same enforcement pattern as mechanic reviews: must be the driver who
// actually had the session, the session must actually be finished, and a
// DB UNIQUE constraint backstops "once per session" even under a race.
function create(user, { session_id, rating, comment }) {
  if (!session_id || !rating) {
    throw new ValidationError("session_id and rating are required");
  }
  if (rating < 1 || rating > 5) {
    throw new ValidationError("rating must be between 1 and 5");
  }

  const session = sessions.findById(session_id);
  if (!session) throw new NotFoundError("Charging session not found");
  if (session.driver_id !== user.id) {
    throw new ForbiddenError("Only the driver who had this session can review it");
  }
  if (!session.ended_at) {
    throw new ValidationError("Can only review a completed charging session");
  }

  const charger = chargers.findById(session.charger_id);
  if (!charger) throw new NotFoundError("Charger for this session no longer exists");

  try {
    return reviews.create({
      stationId: charger.station_id,
      driverId: user.id,
      sessionId: session_id,
      rating,
      comment,
    });
  } catch (e) {
    if (String(e.message).includes("UNIQUE")) {
      throw new ConflictError("You've already reviewed this session");
    }
    throw e;
  }
}

function listForStation(stationId) {
  return { ...reviews.ratingSummary(stationId), reviews: reviews.listForStation(stationId) };
}

module.exports = { create, listForStation, ratingSummary: reviews.ratingSummary, ratingsForStations: reviews.ratingsForStations };
