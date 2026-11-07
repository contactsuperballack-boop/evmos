// Domain-level errors. Services throw these; nothing in src/services or
// src/repositories imports `json`/`res`/status codes directly — that
// coupling is exactly what made the old src/routes/*.js files hard to
// reuse or test in isolation (every business rule was welded to an HTTP
// response). The http/ controllers are the only place that knows how to
// turn one of these into a wire response.
//
// `payload` can be a plain string (becomes `{ error: <string> }`, the
// shape almost every endpoint in this API already used) or a full object
// for the handful of endpoints whose error body has extra fields — e.g.
// the "already have an active session" 409 also returns
// `active_session_id`, and the "already completed" 409 returns an error
// *code* in the `error` field plus a separate human-readable `message`.
// Passing the object straight through preserves those exact shapes rather
// than forcing every error into a single generic format and silently
// changing the API's existing contract.
class AppError extends Error {
  constructor(status, payload) {
    const body = typeof payload === "string" ? { error: payload } : payload;
    super(body.message || body.error || "Request failed");
    this.status = status;
    this.body = body;
  }
}

class ValidationError extends AppError {
  constructor(payload) {
    super(400, payload);
  }
}

class ForbiddenError extends AppError {
  constructor(payload) {
    super(403, payload);
  }
}

class NotFoundError extends AppError {
  constructor(payload) {
    super(404, payload);
  }
}

class ConflictError extends AppError {
  constructor(payload) {
    super(409, payload);
  }
}

module.exports = { AppError, ValidationError, ForbiddenError, NotFoundError, ConflictError };
