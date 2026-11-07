const db = require("../db");

// Phase 1 auth is deliberately simple: opaque bearer tokens issued at OTP
// verification, looked up against the sessions_tokens table. No JWT/refresh
// complexity yet — that's a reasonable Phase 2+ upgrade once there's a real
// reason (e.g. stateless scaling across multiple API instances) to need it.
//
// Hardening pass: tokens now carry expires_at + revoked_at (see db.js).
// currentUser() only returns a user for a token that exists, hasn't been
// revoked, and hasn't expired. It does not distinguish "no token", "bad
// token", "expired token", and "revoked token" in its return value on
// purpose — all of those should look identical (401) to the caller; giving
// different signals back would leak information about token validity to
// anyone probing the API.
function currentUser(req) {
  const authHeader = req.headers["authorization"] || "";
  const token = authHeader.replace(/^Bearer\s+/i, "").trim();
  if (!token) return null;

  const row = db
    .prepare(
      `SELECT u.* FROM sessions_tokens s
       JOIN users u ON u.id = s.user_id
       WHERE s.token = ?
         AND s.revoked_at IS NULL
         AND s.expires_at > datetime('now')`
    )
    .get(token);

  return row || null;
}

function requireAuth(req, res, json) {
  const user = currentUser(req);
  if (!user) {
    json(res, 401, { error: "Unauthorized — missing or invalid token" });
    return null;
  }
  return user;
}

// Extracts the raw bearer token from the request, for routes (like logout)
// that need to act on the token itself rather than just the user it maps to.
function currentToken(req) {
  const authHeader = req.headers["authorization"] || "";
  const token = authHeader.replace(/^Bearer\s+/i, "").trim();
  return token || null;
}

module.exports = { currentUser, requireAuth, currentToken };
