const loyalty = require("../repositories/loyaltyRepository");

// Simple, explainable rule set (per Phase 2 spec 4.3): 1 point per ₦100
// spent on a completed charging payment. Tier thresholds are intentionally
// round numbers for a first pass — tune once there's real spend data.
const POINTS_PER_NAIRA = 1 / 100;
const TIERS = [
  { name: "gold", minPoints: 5000 },
  { name: "silver", minPoints: 1000 },
  { name: "standard", minPoints: 0 },
];

function tierForPoints(points) {
  return TIERS.find((t) => points >= t.minPoints).name;
}

function getOrCreateAccount(userId) {
  return loyalty.findByUserId(userId) || loyalty.create(userId);
}

// Called from sessionsService after a successful wallet charge.
function awardPointsForPayment(userId, amountPaid, reason) {
  const account = getOrCreateAccount(userId);
  const pointsEarned = Math.floor(amountPaid * POINTS_PER_NAIRA);
  if (pointsEarned <= 0) return { account, pointsEarned: 0 };

  const newBalance = account.points_balance + pointsEarned;
  const newTier = tierForPoints(newBalance);

  loyalty.updateBalance(account.id, newBalance, newTier);
  loyalty.insertLedgerEntry(account.id, pointsEarned, reason);

  return { account: loyalty.findById(account.id), pointsEarned };
}

function getAccountWithLedger(userId) {
  const account = getOrCreateAccount(userId);
  const ledger = loyalty.listLedger(account.id, 50);

  // Show what's needed to reach the next tier — small thing, but this is
  // exactly the kind of visible-progress detail that makes a loyalty
  // program feel real rather than a hidden number.
  const currentTierIndex = TIERS.findIndex((t) => t.name === account.tier);
  const nextTier = TIERS[currentTierIndex - 1] || null; // TIERS is sorted highest-first

  return {
    ...account,
    ledger,
    next_tier: nextTier ? { name: nextTier.name, points_needed: nextTier.minPoints - account.points_balance } : null,
  };
}

module.exports = { getOrCreateAccount, awardPointsForPayment, getAccountWithLedger, tierForPoints };
