// Covers the OTP hardening behavior from HARDENING_AND_SCOPE.md: resend
// cooldown, verify-attempt lockout, dev_code gating, and session
// revocation via logout. These were verified manually with curl during
// the auth.js migration; this makes that verification permanent.
const { resetDb, mockReq, mockRes, makeChecker } = require("../helpers/testHarness");

const db = resetDb();
const auth = require("../../src/http/authController");
const { check, finish } = makeChecker();

async function run() {
  const PHONE = "+2340001110001";

  // --- dev_code hidden by default ---
  const req1 = mockReq(null, { phone: PHONE });
  const res1 = mockRes();
  await auth.otpRequest(req1, res1);
  check("first OTP request succeeds", res1.statusCode === 200);
  check("dev_code NOT present by default", res1.body.dev_code === undefined);

  // Pull the real code from the DB directly (mirrors reading it from the
  // server log in manual testing, since dev_code isn't in the response).
  const otpRow = db.prepare(`SELECT * FROM otp_codes WHERE phone = ?`).get(PHONE);
  const realCode = otpRow.code;

  // --- resend cooldown ---
  const req2 = mockReq(null, { phone: PHONE });
  const res2 = mockRes();
  await auth.otpRequest(req2, res2);
  check("immediate second request is rate-limited (429)", res2.statusCode === 429);

  // --- 5 wrong verify attempts, then lockout (even for the correct code) ---
  for (let i = 0; i < 5; i++) {
    const reqWrong = mockReq(null, { phone: PHONE, code: "000000", name: "X", role: "driver" });
    const resWrong = mockRes();
    await auth.otpVerify(reqWrong, resWrong);
    check(`wrong attempt ${i + 1} rejected with 401`, resWrong.statusCode === 401);
  }
  const reqCorrect = mockReq(null, { phone: PHONE, code: realCode, name: "X", role: "driver" });
  const resCorrect = mockRes();
  await auth.otpVerify(reqCorrect, resCorrect);
  check("correct code REJECTED after 5 wrong attempts (429 lockout)", resCorrect.statusCode === 429);

  // --- legitimate login flow, then logout revokes the token ---
  const PHONE2 = "+2340001110002";
  const reqReq2 = mockReq(null, { phone: PHONE2 });
  const resReq2 = mockRes();
  await auth.otpRequest(reqReq2, resReq2);
  const code2 = db.prepare(`SELECT code FROM otp_codes WHERE phone = ?`).get(PHONE2).code;

  const reqVerify2 = mockReq(null, { phone: PHONE2, code: code2, name: "Legit", role: "driver" });
  const resVerify2 = mockRes();
  await auth.otpVerify(reqVerify2, resVerify2);
  check("legitimate verify succeeds (200)", resVerify2.statusCode === 200);
  const token = resVerify2.body.token;
  check("a real token was issued", !!token);

  const reqLogout = mockReq(token, {});
  const resLogout = mockRes();
  await auth.logout(reqLogout, resLogout);
  check("logout succeeds (200)", resLogout.statusCode === 200);

  const revokedRow = db.prepare(`SELECT * FROM sessions_tokens WHERE token = ?`).get(token);
  check("token is marked revoked in the DB", !!revokedRow.revoked_at);

  finish();
}

run();
