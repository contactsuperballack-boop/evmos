const otp = require("../repositories/otpRepository");
const users = require("../repositories/usersRepository");
const sessionTokens = require("../repositories/sessionTokensRepository");
const { AppError, ValidationError } = require("../domain/errors");

// PRODUCTION NOTE: requestOtp should call the SMS provider (Termii /
// Africa's Talking per the build spec) to actually deliver the code. For
// local dev, the code is logged to the console so the flow is testable
// without an SMS integration.

// Hardening pass — OTP rate limiting (unchanged from the pre-migration
// values, moved here verbatim):
// - RESEND_COOLDOWN_MS: minimum gap between two "send me a code" requests
//   for the same phone number, so a script can't hammer the SMS provider
//   (or, pre-SMS-integration, the DB) in a tight loop.
// - MAX_REQUESTS_PER_WINDOW / REQUEST_WINDOW_MS: caps total requests per
//   phone in a rolling window, independent of the cooldown.
// - MAX_VERIFY_ATTEMPTS: caps guesses against a single issued code before
//   it's invalidated outright, so a 6-digit code can't be brute-forced
//   (1,000,000 possibilities is not a real barrier against unlimited tries).
const RESEND_COOLDOWN_MS = 30 * 1000;
const MAX_REQUESTS_PER_WINDOW = 5;
const REQUEST_WINDOW_MS = 60 * 60 * 1000;
const MAX_VERIFY_ATTEMPTS = 5;
const SESSION_TTL_SQL_OFFSET = "+30 days";

// dev_code is only ever included in the response when explicitly opted
// into via env var — never by default, and never in anything resembling
// production. It still gets console.logged unconditionally so the local
// dev flow (and this project's own live-testing discipline) keeps working
// by reading the server log instead of trusting the client-visible response.
const EXPOSE_DEV_OTP = process.env.EVMOS_EXPOSE_DEV_OTP === "true";

function requestOtp(phone) {
  if (!phone) throw new ValidationError("phone is required");

  const now = Date.now();
  const existing = otp.findByPhone(phone);

  if (existing) {
    const lastRequestedMs = new Date(existing.last_requested_at + "Z").getTime();
    if (now - lastRequestedMs < RESEND_COOLDOWN_MS) {
      const waitSec = Math.ceil((RESEND_COOLDOWN_MS - (now - lastRequestedMs)) / 1000);
      throw new AppError(429, `Please wait ${waitSec}s before requesting another code`);
    }

    const windowStartMs = new Date(existing.window_started_at + "Z").getTime();
    const windowExpired = now - windowStartMs > REQUEST_WINDOW_MS;
    if (!windowExpired && existing.request_count >= MAX_REQUESTS_PER_WINDOW) {
      throw new AppError(429, "Too many OTP requests — please try again later");
    }
  }

  const code = String(Math.floor(100000 + Math.random() * 900000));
  const expiresAt = new Date(now + 5 * 60 * 1000).toISOString();

  if (!existing || now - new Date(existing.window_started_at + "Z").getTime() > REQUEST_WINDOW_MS) {
    otp.resetWindow(phone, code, expiresAt);
  } else {
    otp.incrementInWindow(phone, code, expiresAt);
  }

  console.log(`[OTP] ${phone} -> ${code} (expires ${expiresAt})`);

  const response = { message: "OTP sent" };
  if (EXPOSE_DEV_OTP) response.dev_code = code;
  return response;
}

function verifyOtp(phone, code, name, role) {
  if (!phone || !code) throw new ValidationError("phone and code are required");

  const record = otp.findByPhone(phone);
  if (!record) {
    throw new AppError(401, "Invalid or expired code");
  }
  if (record.verify_attempts >= MAX_VERIFY_ATTEMPTS) {
    otp.deleteByPhone(phone);
    throw new AppError(429, "Too many incorrect attempts — request a new code");
  }
  if (new Date(record.expires_at) < new Date()) {
    throw new AppError(401, "Code expired — request a new one");
  }
  if (record.code !== code) {
    otp.incrementVerifyAttempts(phone);
    throw new AppError(401, "Invalid or expired code");
  }

  let user = users.findByPhone(phone);
  if (!user) {
    if (!role || !["driver", "station_owner", "mechanic"].includes(role)) {
      throw new ValidationError("New user — role is required (driver, station_owner, or mechanic)");
    }
    user = users.create({ phone, name, role });
  }

  otp.deleteByPhone(phone);
  const token = sessionTokens.create(user.id, SESSION_TTL_SQL_OFFSET);

  return { token, user };
}

function logout(token) {
  if (!token) throw new ValidationError("No token provided");
  sessionTokens.revoke(token);
  return { message: "Signed out" };
}

module.exports = { requestOtp, verifyOtp, logout };
