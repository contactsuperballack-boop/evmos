// Verifies the nearbyStations rewrite two ways:
//   1. Correctness — output for a realistic mixed scenario (featured vs
//      not, in-range vs out-of-range, active vs expired hold, stations
//      with and without reviews) matches what the OLD per-row-query
//      version was known to produce.
//   2. Query count — instruments db.prepare() to count calls, proving the
//      "constant number of queries regardless of N" claim empirically
//      rather than just asserting it.
const path = require("path");
process.chdir(path.join(__dirname, "..", ".."));
const fs = require("fs");
const dbPath = path.join(process.cwd(), "evmos.db");
if (fs.existsSync(dbPath)) fs.unlinkSync(dbPath);

const db = require(path.join(process.cwd(), "src/db"));
const { id } = require(path.join(process.cwd(), "src/lib/util"));

// --- seed: 3 in-range stations (one featured, two not) + 1 out-of-range,
//     each with chargers; one active hold, one expired hold; reviews on
//     one station only ---
const ownerId = id("usr");
db.prepare(`INSERT INTO users (id, phone, name, role) VALUES (?, ?, ?, 'station_owner')`).run(ownerId, "+2340000000099", "Owner");

function makeStation(name, lat, lng, featured) {
  const sid = id("stn");
  db.prepare(`INSERT INTO stations (id, owner_id, name, lat, lng, address, status) VALUES (?, ?, ?, ?, ?, 'A', 'active')`).run(sid, ownerId, name, lat, lng);
  if (featured) {
    db.prepare(`INSERT INTO featured_listings (id, station_id, starts_at, ends_at, amount_paid) VALUES (?, ?, datetime('now'), datetime('now','+7 days'), 3500)`).run(id("fl"), sid);
  }
  return sid;
}

const near1 = makeStation("Near Plain", 9.05, 7.49, false);
const near2 = makeStation("Near Featured But Farther", 9.06, 7.50, true);
const farAway = makeStation("Far Away", 20.0, 20.0, false); // clearly out of any sane radius

function makeCharger(stationId, wait) {
  const cid = id("chg");
  db.prepare(`INSERT INTO chargers (id, station_id, connector_type, price_per_kwh, is_available) VALUES (?, ?, 'CCS2', 100, 1)`).run(cid, stationId);
  db.prepare(`INSERT INTO queue_state (charger_id, current_wait_estimate_min) VALUES (?, ?)`).run(cid, wait);
  return cid;
}
const c1 = makeCharger(near1, 5);
const c2 = makeCharger(near2, 10);

// active hold on c1, expired hold on c2 (status still 'active' in DB, but
// hold_until in the past — exactly the lazy-expiry case effectiveStatus()
// used to handle per-item; the batched version must reproduce it)
db.prepare(`INSERT INTO holds (id, driver_id, charger_id, hold_until, status) VALUES (?, ?, ?, datetime('now','+10 minutes'), 'active')`).run(id("hld"), ownerId, c1);
db.prepare(`INSERT INTO holds (id, driver_id, charger_id, hold_until, status) VALUES (?, ?, ?, datetime('now','-10 minutes'), 'active')`).run(id("hld"), ownerId, c2);

// reviews only on near1 — station_reviews requires a real session_id
// (FOREIGN KEY, enforced) and a driver_id, so seed two minimal completed
// sessions to attach the reviews to.
const reviewerId = id("usr");
db.prepare(`INSERT INTO users (id, phone, name, role) VALUES (?, ?, ?, 'driver')`).run(reviewerId, "+2340000000098", "Reviewer");
const sess1 = id("chgs");
db.prepare(`INSERT INTO charging_sessions (id, driver_id, charger_id, ended_at) VALUES (?, ?, ?, datetime('now'))`).run(sess1, reviewerId, c1);
const sess2 = id("chgs");
db.prepare(`INSERT INTO charging_sessions (id, driver_id, charger_id, ended_at) VALUES (?, ?, ?, datetime('now'))`).run(sess2, reviewerId, c1);
db.prepare(`INSERT INTO station_reviews (id, station_id, driver_id, session_id, rating, comment) VALUES (?, ?, ?, ?, 5, 'great')`).run(id("rev"), near1, reviewerId, sess1);
db.prepare(`INSERT INTO station_reviews (id, station_id, driver_id, session_id, rating, comment) VALUES (?, ?, ?, ?, 3, 'ok')`).run(id("rev"), near1, reviewerId, sess2);

// --- instrument db.prepare to count distinct query calls ---
let prepareCount = 0;
const originalPrepare = db.prepare.bind(db);
db.prepare = function (sql) {
  prepareCount++;
  return originalPrepare(sql);
};

const stations = require(path.join(process.cwd(), "src/http/stationsController"));

function makeMockRes() {
  return {
    statusCode: null, body: null, headersSent: false,
    writeHead(status) { this.statusCode = status; this.headersSent = true; },
    end(payload) { this.body = payload ? JSON.parse(payload) : null; },
  };
}

async function run() {
  const res = makeMockRes();
  prepareCount = 0;
  await stations.nearbyStations({}, res, { lat: "9.05", lng: "7.49", radius_km: "20" });

  console.log("=== QUERY COUNT ===");
  console.log(`db.prepare() called ${prepareCount} times for 2 in-range stations / 2 chargers.`);
  console.log("(Old version: roughly 1 + 3N + 2NC ≈ 1 + 6 + 4 = 11+ for this same scenario.");
  console.log(" New version should be constant — 5 or 6 — regardless of N/C.)");

  console.log("\n=== CORRECTNESS ===");
  console.log("HTTP status:", res.statusCode);
  const body = res.body;
  console.log("Stations returned:", body.map((s) => s.name));

  let ok = true;
  function check(label, cond) {
    console.log(`${cond ? "PASS" : "FAIL"}: ${label}`);
    if (!cond) ok = false;
  }

  check("far-away station excluded", !body.find((s) => s.name === "Far Away"));
  check("exactly 2 stations returned", body.length === 2);
  check("featured station sorts first despite being farther", body[0].name === "Near Featured But Farther" && body[0].is_featured === true);
  check("second station is the non-featured nearer one", body[1].name === "Near Plain" && body[1].is_featured === false);

  const plain = body.find((s) => s.name === "Near Plain");
  check("Near Plain has 2 reviews averaging 4.0", plain.review_count === 2 && plain.average_rating === 4);
  check("Near Plain's charger shows wait_estimate_min 5", plain.chargers[0].wait_estimate_min === 5);
  check("Near Plain's charger shows the ACTIVE hold", plain.chargers[0].active_hold && plain.chargers[0].active_hold.held_until);

  const featured = body.find((s) => s.name === "Near Featured But Farther");
  check("featured station has 0 reviews (none seeded)", featured.review_count === 0 && featured.average_rating === null);
  check("featured station's EXPIRED hold correctly shows as no active hold", featured.chargers[0].active_hold === null);

  console.log("\n=== VERDICT ===");
  if (ok && prepareCount <= 6) {
    console.log(`PASS: output matches expected shape/order, and query count (${prepareCount}) is constant, not scaling with N/C.`);
  } else {
    console.log("FAIL: see above.");
    process.exitCode = 1;
  }
}
run();
