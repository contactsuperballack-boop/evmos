const { json, readBody } = require("../lib/util");
const { currentToken } = require("../lib/auth");
const { AppError } = require("../domain/errors");
const authService = require("../services/authService");

function handle(res, fn) {
  try {
    return fn();
  } catch (err) {
    if (err instanceof AppError) return json(res, err.status, err.body);
    throw err;
  }
}

async function otpRequest(req, res) {
  const { phone } = await readBody(req);
  handle(res, () => json(res, 200, authService.requestOtp(phone)));
}

async function otpVerify(req, res) {
  const { phone, code, name, role } = await readBody(req);
  handle(res, () => json(res, 200, authService.verifyOtp(phone, code, name, role)));
}

async function logout(req, res) {
  const token = currentToken(req);
  handle(res, () => json(res, 200, authService.logout(token)));
}

module.exports = { otpRequest, otpVerify, logout };
