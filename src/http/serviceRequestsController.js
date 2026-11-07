const { json, readBody } = require("../lib/util");
const { requireAuth } = require("../lib/auth");
const { AppError } = require("../domain/errors");
const serviceRequestsService = require("../services/serviceRequestsService");

function handle(res, fn) {
  try {
    return fn();
  } catch (err) {
    if (err instanceof AppError) return json(res, err.status, err.body);
    throw err;
  }
}

async function createServiceRequest(req, res) {
  const user = requireAuth(req, res, json);
  if (!user) return;

  const { fault_type, lat, lng } = await readBody(req);
  handle(res, () => json(res, 201, serviceRequestsService.create(user, fault_type, lat, lng)));
}

async function getServiceRequest(req, res, requestId) {
  const user = requireAuth(req, res, json);
  if (!user) return;

  handle(res, () => json(res, 200, serviceRequestsService.get(user, requestId)));
}

// See the long comment at the top of serviceRequestsService.updateStatus —
// the body MUST be fully awaited here, before calling into the service,
// for the TOCTOU fix to hold. Do not move this `await` or add another one
// between it and the service call.
async function updateServiceRequest(req, res, requestId) {
  const user = requireAuth(req, res, json);
  if (!user) return;

  const { status } = await readBody(req);
  handle(res, () => json(res, 200, serviceRequestsService.updateStatus(user, requestId, status)));
}

async function nearbyRequests(req, res, query) {
  const user = requireAuth(req, res, json);
  if (!user) return;

  const lat = parseFloat(query.lat);
  const lng = parseFloat(query.lng);
  handle(res, () => json(res, 200, serviceRequestsService.listNearby(user, lat, lng)));
}

async function myAssignedRequests(req, res) {
  const user = requireAuth(req, res, json);
  if (!user) return;

  handle(res, () => json(res, 200, serviceRequestsService.listMine(user)));
}

async function createReview(req, res) {
  const user = requireAuth(req, res, json);
  if (!user) return;

  const body = await readBody(req);
  handle(res, () => json(res, 201, serviceRequestsService.review(user, body)));
}

async function listMechanicReviews(req, res, mechanicId) {
  handle(res, () => json(res, 200, serviceRequestsService.listReviewsForMechanic(mechanicId)));
}

module.exports = {
  createServiceRequest,
  getServiceRequest,
  updateServiceRequest,
  nearbyRequests,
  myAssignedRequests,
  createReview,
  listMechanicReviews,
};
