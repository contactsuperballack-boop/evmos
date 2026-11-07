const wallets = require("../repositories/walletsRepository");
const { id } = require("../lib/util");
const { ValidationError } = require("../domain/errors");

// PRODUCTION NOTE (carried over from the old src/routes/wallet.js — see
// Phase 2 build spec sections 2 & 6.1): this is a deliberately simulated
// payment flow. `topup` credits the wallet immediately with no real money
// involved — there is no Paystack/Flutterwave integration yet. Before
// this touches real money:
//   1. Replace the simulated credit with a real charge request to the
//      payment provider's SDK, returning a redirect/authorization URL
//      instead of crediting immediately.
//   2. Implement the payments webhook to verify the provider's signature
//      and only credit once the provider confirms success.
//   3. Add idempotency handling keyed on the provider's transaction
//      reference so a retried webhook can't double-credit.

function getOrCreateWallet(userId) {
  return wallets.findByUserId(userId) || wallets.create(userId);
}

function getWalletWithTransactions(userId) {
  const wallet = getOrCreateWallet(userId);
  const transactions = wallets.listTransactions(wallet.id, 50);
  return { ...wallet, transactions };
}

function topup(userId, amount) {
  if (!amount || amount <= 0) {
    throw new ValidationError("amount must be a positive number");
  }
  const wallet = getOrCreateWallet(userId);
  const reference = id("txn");

  // SIMULATED: real integration replaces this block with an API call to
  // the payment provider and defers the credit to the webhook handler.
  wallets.credit(wallet.id, amount);
  wallets.insertTransaction({
    walletId: wallet.id,
    type: "top_up",
    amount,
    reference,
    status: "completed",
    metadata: { simulated: true },
  });

  const updated = wallets.findById(wallet.id);
  return {
    ...updated,
    reference,
    note: "Simulated top-up — no real payment provider wired up yet (see PRODUCTION NOTE in walletService.js)",
  };
}

// Generic wallet debit, shared by every "pay for something" flow (charging
// sessions, marketplace orders, mechanic payments later). Centralizing
// this means the insufficient-balance check and the debit + transaction
// write can't drift between call sites. Returns a result object rather
// than throwing on insufficient balance — that's an expected outcome for
// callers (e.g. a charging session still ends successfully with
// payment_status "insufficient_balance"), not an exceptional one.
function debit(userId, amount, type, metadata) {
  const wallet = getOrCreateWallet(userId);
  if (wallet.balance < amount) {
    return { ok: false, reason: "insufficient_balance", balance: wallet.balance };
  }

  wallets.debit(wallet.id, amount);
  wallets.insertTransaction({
    walletId: wallet.id,
    type,
    amount,
    reference: id("txn"),
    status: "completed",
    metadata,
  });

  const updated = wallets.findById(wallet.id);
  return { ok: true, balance: updated.balance };
}

function chargeForSession(userId, amount, sessionId) {
  return debit(userId, amount, "charge_payment", { session_id: sessionId });
}

module.exports = { getOrCreateWallet, getWalletWithTransactions, topup, debit, chargeForSession };
