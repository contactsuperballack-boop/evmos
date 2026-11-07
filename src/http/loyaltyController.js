const { json } = require("../lib/util");
const { requireAuth } = require("../lib/auth");
const loyaltyService = require("../services/loyaltyService");

async function getLoyaltyAccount(req, res) {
  const user = requireAuth(req, res, json);
  if (!user) return;

  json(res, 200, loyaltyService.getAccountWithLedger(user.id));
}

module.exports = { getLoyaltyAccount };
