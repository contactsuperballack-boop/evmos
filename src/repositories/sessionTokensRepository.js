const db = require("../db");
const { id } = require("../lib/util");

// The READ side of session tokens (looking up who a bearer token belongs
// to) deliberately stays in src/lib/auth.js, not here. That's a
// cross-cutting concern every single controller needs synchronously via
// requireAuth() — same category as json()/readBody() in lib/util.js — not
// a business flow specific to the auth domain's own service. This
// repository only owns the write side: issuing and revoking tokens,
// which only authService actually does.
function create(userId, ttlSqlOffset) {
  const token = id("tok");
  db.prepare(`INSERT INTO sessions_tokens (token, user_id, expires_at) VALUES (?, ?, datetime('now', ?))`).run(
    token,
    userId,
    ttlSqlOffset
  );
  return token;
}

function revoke(token) {
  db.prepare(`UPDATE sessions_tokens SET revoked_at = datetime('now') WHERE token = ?`).run(token);
}

module.exports = { create, revoke };
