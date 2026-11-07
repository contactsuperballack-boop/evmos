const queue = require("../repositories/queueRepository");
const chargers = require("../repositories/chargersRepository");
const stations = require("../repositories/stationsRepository");
const { ValidationError, ForbiddenError, NotFoundError } = require("../domain/errors");

function getQueue(chargerId) {
  const q = queue.findByChargerId(chargerId);
  if (!q) throw new NotFoundError("No queue state for this charger");
  return q;
}

// Hardening pass history (see HARDENING_AND_SCOPE.md): previously any
// authenticated user could update any charger's queue state. Ownership
// check mirrors stationsService.updateCharger. Also reordered so the body
// is read before any DB access — consistent with the TOCTOU-fix pattern
// used elsewhere, even though this specific field (station.owner_id) is
// immutable and wasn't actually exploitable.
function updateQueue(user, chargerId, waitMin) {
  if (waitMin == null) {
    throw new ValidationError("current_wait_estimate_min is required");
  }

  const charger = chargers.findById(chargerId);
  if (!charger) throw new NotFoundError("Charger not found");

  const station = stations.findById(charger.station_id);
  if (!station || station.owner_id !== user.id) {
    throw new ForbiddenError("Only the station owner can update this charger's queue");
  }

  return queue.updateWait(chargerId, waitMin);
}

module.exports = { getQueue, updateQueue };
