const stations = require("../repositories/stationsRepository");
const chargers = require("../repositories/chargersRepository");
const sessions = require("../repositories/sessionsRepository");
const featuredListings = require("../repositories/featuredListingsRepository");
const walletService = require("./walletService");
const { ForbiddenError, NotFoundError, AppError } = require("../domain/errors");

// PRICING NOTE: ₦500/day is a placeholder simulated rate, not a
// researched market price — easy to find/replace when there's real data
// on what station owners will actually pay for a boosted placement.
const FEATURED_LISTING_PRICE_PER_DAY = 500;
const MAX_FEATURED_DAYS = 30;

function assertOwnsStation(stationId, user) {
  const station = stations.findById(stationId);
  if (!station) throw new NotFoundError("Station not found");
  if (station.owner_id !== user.id) {
    throw new ForbiddenError("Only the station owner can view this");
  }
  return station;
}

function getAnalytics(user, stationId) {
  assertOwnsStation(stationId, user);

  const chargerIds = chargers.findByStation(stationId).map((c) => c.id);
  if (chargerIds.length === 0) {
    return { total_sessions: 0, total_revenue: 0, total_kwh_delivered: 0, peak_hour: null, sessions_by_charger: [] };
  }

  const totals = sessions.aggregateTotalsForChargers(chargerIds);
  const peakRow = sessions.peakHourForChargers(chargerIds);
  const sessionsByCharger = sessions.sessionStatsByStation(stationId);

  return {
    total_sessions: totals.total_sessions,
    total_revenue: totals.total_revenue,
    total_kwh_delivered: totals.total_kwh_delivered,
    peak_hour: peakRow ? `${peakRow.hour}:00` : null,
    sessions_by_charger: sessionsByCharger,
  };
}

function createFeaturedListing(user, stationId, days) {
  assertOwnsStation(stationId, user);

  const numDays = Math.min(Math.max(parseInt(days, 10) || 0, 1), MAX_FEATURED_DAYS);
  const amount = numDays * FEATURED_LISTING_PRICE_PER_DAY;

  const payment = walletService.debit(user.id, amount, "featured_listing", { station_id: stationId, days: numDays });
  if (!payment.ok) {
    throw new AppError(402, { error: "Insufficient wallet balance", balance: payment.balance, amount_due: amount });
  }

  const endsAt = new Date(Date.now() + numDays * 24 * 60 * 60 * 1000).toISOString();
  const listing = featuredListings.create({ stationId, endsAt, amountPaid: amount });

  return { ...listing, wallet_balance: payment.balance };
}

// NOTE: not called from anywhere else in the codebase as of this
// migration — stationsService.listNearby uses the batched
// featuredListingsRepository.listActiveStationIds directly instead (see
// the Sprint 1 N+1 fix). Kept here as the single-item equivalent in case
// a future single-station view needs it, rather than deleted, since it's
// harmless and cheap to keep.
function isStationFeatured(stationId) {
  return featuredListings.isActiveForStation(stationId);
}

module.exports = { getAnalytics, createFeaturedListing, isStationFeatured };
