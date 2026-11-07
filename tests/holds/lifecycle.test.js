// Covers the "heads-up hold" lifecycle — duplicate-hold blocking,
// cross-user cancel rejection, and the lazy-expiry semantics
// (effectiveStatus treats an unexpired-looking DB row as expired once
// hold_until has passed, since nothing proactively expires it).
const { resetDb, makeAuthedUser, mockReq, mockRes, makeChecker } = require("../helpers/testHarness");

const db = resetDb();
const stations = require("../../src/http/stationsController");
const holds = require("../../src/http/holdsController");
const { check, finish } = makeChecker();

async function run() {
  const owner = makeAuthedUser(db, { phone: "+2340004440001", name: "Owner", role: "station_owner" });
  const driver1 = makeAuthedUser(db, { phone: "+2340004440002", name: "D1", role: "driver" });
  const driver2 = makeAuthedUser(db, { phone: "+2340004440003", name: "D2", role: "driver" });

  const stationRes = mockRes();
  await stations.createStation(mockReq(owner.token, { name: "S", lat: 9.05, lng: 7.49, address: "A" }), stationRes);
  const stationId = stationRes.body.id;
  const chargerRes = mockRes();
  await stations.addCharger(mockReq(owner.token, { connector_type: "CCS2", price_per_kwh: 100 }), chargerRes, stationId);
  const chargerId = chargerRes.body.id;

  const holdRes = mockRes();
  await holds.createHold(mockReq(driver1.token, { charger_id: chargerId }), holdRes);
  check("driver1 creates a hold (201)", holdRes.statusCode === 201);
  check("hold response carries the non-guarantee disclaimer", typeof holdRes.body.disclaimer === "string");
  const holdId = holdRes.body.id;

  const duplicateRes = mockRes();
  await holds.createHold(mockReq(driver2.token, { charger_id: chargerId }), duplicateRes);
  check("driver2 CANNOT hold the same charger while driver1's is active (409)", duplicateRes.statusCode === 409);

  const selfDuplicateRes = mockRes();
  await holds.createHold(mockReq(driver1.token, { charger_id: chargerId }), selfDuplicateRes);
  check("driver1 also can't double-hold their own already-held charger (409)", selfDuplicateRes.statusCode === 409);

  const crossCancelRes = mockRes();
  await holds.cancelHold(mockReq(driver2.token, {}), crossCancelRes, holdId);
  check("driver2 CANNOT cancel driver1's hold (403)", crossCancelRes.statusCode === 403);

  const legitCancelRes = mockRes();
  await holds.cancelHold(mockReq(driver1.token, {}), legitCancelRes, holdId);
  check("driver1 CAN cancel their own hold (200)", legitCancelRes.statusCode === 200);

  const doubleCancelRes = mockRes();
  await holds.cancelHold(mockReq(driver1.token, {}), doubleCancelRes, holdId);
  check("cancelling an already-cancelled hold is rejected (400)", doubleCancelRes.statusCode === 400);

  // --- lazy expiry: manually backdate a hold's hold_until, confirm a new
  //     hold on the same charger is now allowed even though the DB row
  //     still says status='active' ---
  const secondHoldRes = mockRes();
  await holds.createHold(mockReq(driver2.token, { charger_id: chargerId }), secondHoldRes);
  const secondHoldId = secondHoldRes.body.id;
  db.prepare(`UPDATE holds SET hold_until = datetime('now', '-1 minute') WHERE id = ?`).run(secondHoldId);

  const afterExpiryRes = mockRes();
  await holds.createHold(mockReq(driver1.token, { charger_id: chargerId }), afterExpiryRes);
  check(
    "a new hold succeeds once the previous one's hold_until has lazily expired (201, not 409)",
    afterExpiryRes.statusCode === 201
  );

  const myHoldsRes = mockRes();
  await holds.myHolds(mockReq(driver2.token, {}), myHoldsRes);
  const expiredEntry = myHoldsRes.body.find((h) => h.id === secondHoldId);
  check(
    "myHolds reports the lazily-expired hold's status as 'expired', not the stale 'active' DB value",
    expiredEntry && expiredEntry.status === "expired"
  );

  finish();
}

run();
