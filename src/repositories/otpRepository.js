const db = require("../db");

function findByPhone(phone) {
  return db.prepare(`SELECT * FROM otp_codes WHERE phone = ?`).get(phone);
}

// Starts a fresh rate-limit window for this phone — either it's never
// requested a code before, or its previous window has expired. Uses
// ON CONFLICT rather than a separate exists-check-then-insert/update,
// since a phone number is the primary key and this needs to behave
// correctly whether or not a (possibly stale) row already exists.
function resetWindow(phone, code, expiresAt) {
  db.prepare(
    `INSERT INTO otp_codes (phone, code, expires_at, request_count, window_started_at, last_requested_at, verify_attempts)
     VALUES (?, ?, ?, 1, datetime('now'), datetime('now'), 0)
     ON CONFLICT(phone) DO UPDATE SET
       code = excluded.code, expires_at = excluded.expires_at,
       request_count = 1, window_started_at = datetime('now'),
       last_requested_at = datetime('now'), verify_attempts = 0`
  ).run(phone, code, expiresAt);
}

// Same rate-limit window continues — increments the request count rather
// than resetting it, so the hourly cap actually accumulates.
function incrementInWindow(phone, code, expiresAt) {
  db.prepare(
    `UPDATE otp_codes SET code = ?, expires_at = ?, request_count = request_count + 1,
     last_requested_at = datetime('now'), verify_attempts = 0 WHERE phone = ?`
  ).run(code, expiresAt, phone);
}

function incrementVerifyAttempts(phone) {
  db.prepare(`UPDATE otp_codes SET verify_attempts = verify_attempts + 1 WHERE phone = ?`).run(phone);
}

function deleteByPhone(phone) {
  db.prepare(`DELETE FROM otp_codes WHERE phone = ?`).run(phone);
}

module.exports = { findByPhone, resetWindow, incrementInWindow, incrementVerifyAttempts, deleteByPhone };
