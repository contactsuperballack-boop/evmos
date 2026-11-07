const serviceRequests = require("../repositories/serviceRequestsRepository");
const mechanics = require("../repositories/mechanicsRepository");
const { distanceKm } = require("../lib/util");
const { ValidationError, ForbiddenError, NotFoundError, ConflictError } = require("../domain/errors");

function create(user, faultType, lat, lng) {
  if (!faultType || lat == null || lng == null) {
    throw new ValidationError("fault_type, lat, and lng are required");
  }
  return serviceRequests.create(user.id, faultType, lat, lng);
}

function get(user, requestId) {
  const request = serviceRequests.findByIdWithMechanic(requestId);
  if (!request) throw new NotFoundError("Service request not found");

  if (request.driver_id !== user.id && request.mechanic_user_id !== user.id) {
    throw new ForbiddenError("Not authorized to view this request");
  }

  const rating = request.mechanic_id
    ? mechanics.ratingSummary(request.mechanic_id)
    : { review_count: 0, average_rating: null };
  const alreadyReviewed = !!mechanics.findReviewByRequestId(requestId);

  return { ...request, ...rating, already_reviewed: alreadyReviewed };
}

// THE TOCTOU-CRITICAL FUNCTION. See HARDENING_AND_SCOPE.md "TOCTOU race
// conditions" for the full history: two mechanics racing to accept the
// same job used to both get a 200. The fix's invariant, preserved exactly
// through this migration: the caller (http/serviceRequestsController.js)
// must have ALREADY awaited the request body before calling this
// function, and this function itself must perform the entire
// fetch-check-write sequence with zero `await` points, so nothing else
// can interleave through it. Do not add an `await` anywhere in this
// function without re-reading that history first.
function updateStatus(user, requestId, status) {
  const allowed = ["requested", "accepted", "completed", "cancelled"];
  if (!status || !allowed.includes(status)) {
    throw new ValidationError(`status is required and must be one of: ${allowed.join(", ")}`);
  }

  const request = serviceRequests.findById(requestId);
  if (!request) throw new NotFoundError("Service request not found");

  const callerMechanic = mechanics.findByUserId(user.id);

  if (status === "accepted") {
    if (request.status !== "requested") {
      throw new ConflictError(`Request is already ${request.status}`);
    }
    if (!callerMechanic || callerMechanic.status !== "active") {
      throw new ForbiddenError("Only a verified, active mechanic can accept a request");
    }
    // mechanic_id is ALWAYS derived from the authenticated caller, never
    // trusted from client input — closes the spoofing vector where a
    // driver (or another mechanic) could assign the job to someone else.
    return serviceRequests.accept(requestId, callerMechanic.id);
  }

  if (status === "completed") {
    if (!callerMechanic || request.mechanic_id !== callerMechanic.id) {
      throw new ForbiddenError("Only the assigned mechanic can complete this request");
    }
    if (request.status !== "accepted") {
      throw new ConflictError(`Request must be accepted before it can be completed (currently ${request.status})`);
    }
    return serviceRequests.complete(requestId);
  }

  if (status === "cancelled") {
    const isOwnerDriver = request.driver_id === user.id;
    const isAssignedMechanic = callerMechanic && request.mechanic_id === callerMechanic.id;
    if (!isOwnerDriver && !isAssignedMechanic) {
      throw new ForbiddenError("Only the requesting driver or the assigned mechanic can cancel this request");
    }
    if (request.status === "completed") {
      throw new ConflictError("Cannot cancel a completed request");
    }
    return serviceRequests.cancel(requestId);
  }

  // status === "requested" — not a valid transition target via this endpoint
  throw new ValidationError("Cannot manually set status back to 'requested'");
}

function listNearby(user, lat, lng) {
  const mechanic = mechanics.findByUserId(user.id);
  if (!mechanic) {
    throw new ForbiddenError("Only registered mechanics can view nearby requests");
  }
  if (Number.isNaN(lat) || Number.isNaN(lng)) {
    throw new ValidationError("lat and lng query params are required");
  }

  return serviceRequests
    .listOpen()
    .map((r) => ({ ...r, distance_km: Number(distanceKm(lat, lng, r.lat, r.lng).toFixed(2)) }))
    .sort((a, b) => a.distance_km - b.distance_km);
}

function listMine(user) {
  const mechanic = mechanics.findByUserId(user.id);
  if (!mechanic) throw new NotFoundError("Not registered as a mechanic yet");
  return serviceRequests.listForMechanic(mechanic.id);
}

function review(user, { service_request_id, rating, comment }) {
  if (!service_request_id || !rating) {
    throw new ValidationError("service_request_id and rating are required");
  }
  if (rating < 1 || rating > 5) {
    throw new ValidationError("rating must be between 1 and 5");
  }

  const request = serviceRequests.findById(service_request_id);
  if (!request) throw new NotFoundError("Service request not found");
  if (request.driver_id !== user.id) {
    throw new ForbiddenError("Only the driver who made this request can review it");
  }
  if (request.status !== "completed") {
    throw new ValidationError("Can only review a completed job");
  }
  if (!request.mechanic_id) {
    throw new ValidationError("This request has no assigned mechanic to review");
  }

  try {
    return mechanics.insertReview({
      mechanicId: request.mechanic_id,
      driverId: user.id,
      serviceRequestId: service_request_id,
      rating,
      comment,
    });
  } catch (e) {
    if (String(e.message).includes("UNIQUE")) {
      throw new ConflictError("You've already reviewed this job");
    }
    throw e;
  }
}

function listReviewsForMechanic(mechanicId) {
  return { ...mechanics.ratingSummary(mechanicId), reviews: mechanics.listReviewsForMechanic(mechanicId) };
}

module.exports = { create, get, updateStatus, listNearby, listMine, review, listReviewsForMechanic };
