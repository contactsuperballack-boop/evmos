const { json, readBody } = require("../lib/util");
const { requireAuth } = require("../lib/auth");
const { AppError } = require("../domain/errors");
const walletService = require("../services/walletService");

async function getWallet(req, res) {
  const user = requireAuth(req, res, json);
  if (!user) return;

  json(res, 200, walletService.getWalletWithTransactions(user.id));
}

async function topupWallet(req, res) {
  const user = requireAuth(req, res, json);
  if (!user) return;

  const { amount } = await readBody(req);
  try {
    json(res, 200, walletService.topup(user.id, amount));
  } catch (err) {
    if (err instanceof AppError) return json(res, err.status, err.body);
    throw err;
  }
}

module.exports = { getWallet, topupWallet };
