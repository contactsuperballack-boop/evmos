// Proves whether the "duplicate session completion" fix (claimed FIXED
// earlier this project) actually holds under CONCURRENT double-completion,
// not just sequential double-completion (which is all the earlier live
// curl tests exercised — one call finishes, THEN the second is made).
const path = require("path");
process.chdir(path.join(__dirname, "..", ".."));

const fs = require("fs");
const dbPath = path.join(process.cwd(), "evmos.db");
if (fs.existsSync(dbPath)) fs.unlinkSync(dbPath);

const db = require(path.join(process.cwd(), "src/db"));
const { id } = require(path.join(process.cwd(), "src/lib/util"));
const sessions = require(path.join(process.cwd(), "src/http/sessionsController"));

const driverId = id("usr");
db.prepare(`INSERT INTO users (id, phone, name, role) VALUES (?, ?, ?, 'driver')`).run(driverId, "+2340000000010", "Driver");
db.prepare(`INSERT INTO wallets (id, user_id, balance, currency) VALUES (?, ?, 5000, 'NGN')`).run(id("wal"), driverId);

const ownerId = id("usr");
db.prepare(`INSERT INTO users (id, phone, name, role) VALUES (?, ?, ?, 'station_owner')`).run(ownerId, "+2340000000011", "Owner");
const stationId = id("stn");
db.prepare(`INSERT INTO stations (id, owner_id, name, lat, lng, address, status) VALUES (?, ?, 'S', 9.05, 7.49, 'A', 'active')`).run(stationId, ownerId);
const chargerId = id("chg");
db.prepare(`INSERT INTO chargers (id, station_id, connector_type, price_per_kwh, is_available) VALUES (?, ?, 'CCS2', 100, 1)`).run(chargerId, stationId);
db.prepare(`INSERT INTO queue_state (charger_id, current_wait_estimate_min) VALUES (?, 0)`).run(chargerId);

const sessionId = id("chgs");
db.prepare(`INSERT INTO charging_sessions (id, driver_id, charger_id) VALUES (?, ?, ?)`).run(sessionId, driverId, chargerId);

const tokenId = id("tok");
db.prepare(`INSERT INTO sessions_tokens (token, user_id, expires_at) VALUES (?, ?, datetime('now','+30 days'))`).run(tokenId, driverId);

console.log("Seeded session:", sessionId, "wallet balance: 5000, price: 100/kWh");

function makeMockReq(bodyObj, delayMs) {
  const EventEmitter = require("events");
  const req = new EventEmitter();
  req.headers = { authorization: `Bearer ${tokenId}` };
  setTimeout(() => {
    req.emit("data", Buffer.from(JSON.stringify(bodyObj)));
    req.emit("end");
  }, delayMs);
  return req;
}
function makeMockRes() {
  return {
    statusCode: null, body: null, headersSent: false,
    writeHead(status) { this.statusCode = status; this.headersSent = true; },
    end(payload) { this.body = payload ? JSON.parse(payload) : null; },
  };
}

async function run() {
  const resA = makeMockRes();
  const resB = makeMockRes();
  // Two "end session" calls for the SAME session, arriving close together
  // — a very ordinary real scenario (e.g. a flaky connection causing the
  // driver's app to retry a slow request while the first is still in
  // flight), no malice required.
  const reqA = makeMockReq({ kwh_estimate: 10 }, 40);
  const reqB = makeMockReq({ kwh_estimate: 10 }, 5);

  await Promise.all([
    sessions.endSession(reqA, resA, sessionId),
    sessions.endSession(reqB, resB, sessionId),
  ]);

  console.log("\n--- RESULTS ---");
  console.log("Call A:", resA.statusCode, JSON.stringify(resA.body));
  console.log("Call B:", resB.statusCode, JSON.stringify(resB.body));

  const wallet = db.prepare(`SELECT * FROM wallets WHERE user_id = ?`).get(driverId);
  const expectedIfChargedOnce = 5000 - 10 * 100; // 4000
  console.log("\nFinal wallet balance:", wallet.balance, `(should be ${expectedIfChargedOnce} if charged exactly once)`);

  console.log("\n=== VERDICT ===");
  const bothSucceeded = resA.statusCode === 200 && resB.statusCode === 200;
  if (bothSucceeded || wallet.balance !== expectedIfChargedOnce) {
    console.log("REGRESSION: expected exactly one 200 and one 409, and a single");
    console.log(`charge (balance ${expectedIfChargedOnce}). Got statuses`, resA.statusCode, resB.statusCode, "and balance", wallet.balance);
    process.exitCode = 1;
  } else {
    console.log("PASS: exactly one call billed the session; the race is closed.");
  }
}
run();
