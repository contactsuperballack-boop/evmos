// Covers the cross-user ownership checks that were the original security
// audit's core finding (any authenticated user could touch anyone's
// resource). One file, one domain per section, so a regression in any of
// them shows up here rather than only being caught by manual curl testing
// next time someone touches these files.
const { resetDb, makeAuthedUser, mockReq, mockRes, makeChecker } = require("../helpers/testHarness");

const db = resetDb();
const vehicles = require("../../src/http/vehiclesController");
const stations = require("../../src/http/stationsController");
const queue = require("../../src/http/queueController");
const { check, finish } = makeChecker();

async function run() {
  const driver1 = makeAuthedUser(db, { phone: "+2340002220001", name: "D1", role: "driver" });
  const driver2 = makeAuthedUser(db, { phone: "+2340002220002", name: "D2", role: "driver" });
  const owner1 = makeAuthedUser(db, { phone: "+2340002220003", name: "O1", role: "station_owner" });
  const owner2 = makeAuthedUser(db, { phone: "+2340002220004", name: "O2", role: "station_owner" });

  // --- VEHICLES: cross-user edit blocked ---
  const createRes = mockRes();
  await vehicles.createVehicle(mockReq(driver1.token, { make: "BYD", model: "Atto3" }), createRes);
  check("driver1 creates a vehicle (201)", createRes.statusCode === 201);
  const vehicleId = createRes.body.id;

  const hijackRes = mockRes();
  await vehicles.updateVehicle(mockReq(driver2.token, { model: "Hijacked" }), hijackRes, vehicleId);
  check("driver2 CANNOT edit driver1's vehicle (403)", hijackRes.statusCode === 403);

  const legitEditRes = mockRes();
  await vehicles.updateVehicle(mockReq(driver1.token, { model: "Atto3 Extended" }), legitEditRes, vehicleId);
  check("driver1 CAN edit their own vehicle (200)", legitEditRes.statusCode === 200);

  // --- STATIONS/CHARGERS: cross-owner update and activate blocked ---
  const stationRes = mockRes();
  await stations.createStation(
    mockReq(owner1.token, { name: "S1", lat: 9.05, lng: 7.49, address: "A" }),
    stationRes
  );
  check("owner1 creates a station (201)", stationRes.statusCode === 201);
  const stationId = stationRes.body.id;

  const chargerRes = mockRes();
  await stations.addCharger(
    mockReq(owner1.token, { connector_type: "CCS2", price_per_kwh: 100 }),
    chargerRes,
    stationId
  );
  check("owner1 adds a charger (201)", chargerRes.statusCode === 201);
  const chargerId = chargerRes.body.id;

  const crossUpdateRes = mockRes();
  await stations.updateCharger(mockReq(owner2.token, { price_per_kwh: 999 }), crossUpdateRes, chargerId);
  check("owner2 CANNOT update owner1's charger (403)", crossUpdateRes.statusCode === 403);

  const crossActivateRes = mockRes();
  await stations.activateStation(mockReq(owner2.token, {}), crossActivateRes, stationId);
  check("owner2 CANNOT activate owner1's station (403)", crossActivateRes.statusCode === 403);

  const legitActivateRes = mockRes();
  await stations.activateStation(mockReq(owner1.token, {}), legitActivateRes, stationId);
  check("owner1 CAN activate their own station (200)", legitActivateRes.statusCode === 200);

  // --- listChargers is intentionally PUBLIC — no auth required at all ---
  const publicRes = mockRes();
  await stations.listChargers(mockReq(null, {}), publicRes, stationId);
  check("listChargers works with NO auth token (200, not 401)", publicRes.statusCode === 200);

  // --- QUEUE: cross-owner update blocked ---
  const crossQueueRes = mockRes();
  await queue.updateQueue(mockReq(owner2.token, { current_wait_estimate_min: 15 }), crossQueueRes, chargerId);
  check("owner2 CANNOT update owner1's queue (403)", crossQueueRes.statusCode === 403);

  const legitQueueRes = mockRes();
  await queue.updateQueue(mockReq(owner1.token, { current_wait_estimate_min: 15 }), legitQueueRes, chargerId);
  check("owner1 CAN update their own queue (200)", legitQueueRes.statusCode === 200);

  finish();
}

run();
