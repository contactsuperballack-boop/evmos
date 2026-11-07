// Debugging harness: proves (or disproves) the suspected TOCTOU race in
// mechanics.updateServiceRequest by calling the REAL handler twice with
// mock req/res objects, where one request's body arrives slightly later
// than the other — simulating two mechanics' PATCH requests landing close
// together in real network conditions, without needing real concurrent
// sockets.
const path = require("path");
process.chdir(path.join(__dirname, "..", ".."));

const fs = require("fs");
const dbPath = path.join(process.cwd(), "evmos.db");
if (fs.existsSync(dbPath)) fs.unlinkSync(dbPath);

const db = require(path.join(process.cwd(), "src/db"));
const { id } = require(path.join(process.cwd(), "src/lib/util"));
const mechanics = require(path.join(process.cwd(), "src/http/serviceRequestsController"));

// --- seed: one driver, one open request, two ACTIVE mechanics ---
const driverId = id("usr");
db.prepare(`INSERT INTO users (id, phone, name, role) VALUES (?, ?, ?, 'driver')`).run(driverId, "+2340000000001", "Driver");

const mechAId = id("usr");
db.prepare(`INSERT INTO users (id, phone, name, role) VALUES (?, ?, ?, 'mechanic')`).run(mechAId, "+2340000000002", "MechA");
const mechARecId = id("mch");
db.prepare(`INSERT INTO mechanics (id, user_id, status) VALUES (?, ?, 'active')`).run(mechARecId, mechAId);

const mechBId = id("usr");
db.prepare(`INSERT INTO users (id, phone, name, role) VALUES (?, ?, ?, 'mechanic')`).run(mechBId, "+2340000000003", "MechB");
const mechBRecId = id("mch");
db.prepare(`INSERT INTO mechanics (id, user_id, status) VALUES (?, ?, 'active')`).run(mechBRecId, mechBId);

const requestId = id("svc");
db.prepare(
  `INSERT INTO service_requests (id, driver_id, fault_type, lat, lng, status) VALUES (?, ?, 'flat_tyre', 9.05, 7.49, 'requested')`
).run(requestId, driverId);

console.log("Seeded request:", requestId, "status=requested");
console.log("MechA user id:", mechAId, "-> mechanic record:", mechARecId);
console.log("MechB user id:", mechBId, "-> mechanic record:", mechBRecId);

// --- mock req/res that mimic the real Node http objects just enough for
//     requireAuth (reads req.headers.authorization) and readBody (reads
//     req 'data'/'end' events) to work ---
function mockUserById(userId) {
  return db.prepare(`SELECT * FROM users WHERE id = ?`).get(userId);
}

// Patch requireAuth's dependency indirectly: mechanics.js uses
// require("../lib/auth").requireAuth, which reads a bearer token from
// sessions_tokens. Simplest faithful approach: actually issue a real
// session token per user via the same mechanism auth.js uses, so we're
// exercising the exact same code path as production, not a stub.
const authLib = require(path.join(process.cwd(), "src/lib/auth"));
function issueToken(userId) {
  const token = id("tok");
  db.prepare(`INSERT INTO sessions_tokens (token, user_id, expires_at) VALUES (?, ?, datetime('now','+30 days'))`).run(token, userId);
  return token;
}
const tokenA = issueToken(mechAId);
const tokenB = issueToken(mechBId);

function makeMockReq(token, bodyObj, delayMs) {
  const EventEmitter = require("events");
  const req = new EventEmitter();
  req.headers = { authorization: `Bearer ${token}` };
  // Simulate the body arriving after `delayMs` — this is the network-
  // timing variance that creates the interleaving window in real life.
  setTimeout(() => {
    req.emit("data", Buffer.from(JSON.stringify(bodyObj)));
    req.emit("end");
  }, delayMs);
  return req;
}

function makeMockRes(label) {
  return {
    statusCode: null,
    body: null,
    headersSent: false,
    writeHead(status) { this.statusCode = status; this.headersSent = true; },
    end(payload) { this.body = payload ? JSON.parse(payload) : null; },
  };
}

async function run() {
  const resA = makeMockRes("A");
  const resB = makeMockRes("B");

  // Mechanic A's request body arrives LATE (slower network) — this is the
  // window where the bug lives. Mechanic B's arrives fast.
  const reqA = makeMockReq(tokenA, { status: "accepted" }, 40);
  const reqB = makeMockReq(tokenB, { status: "accepted" }, 5);

  // Fire both "concurrently" — exactly like two real HTTP requests handled
  // by the same single-threaded Node process around the same time.
  await Promise.all([
    mechanics.updateServiceRequest(reqA, resA, requestId),
    mechanics.updateServiceRequest(reqB, resB, requestId),
  ]);

  console.log("\n--- RESULTS ---");
  console.log("Mechanic A response:", resA.statusCode, JSON.stringify(resA.body));
  console.log("Mechanic B response:", resB.statusCode, JSON.stringify(resB.body));

  const final = db.prepare(`SELECT * FROM service_requests WHERE id = ?`).get(requestId);
  console.log("\nFinal DB row:", final);

  const bothSucceeded = resA.statusCode === 200 && resB.statusCode === 200;
  console.log("\n=== VERDICT ===");
  if (bothSucceeded) {
    console.log("REGRESSION: both mechanics received a 200 'accepted' response");
    console.log("for the SAME job — the TOCTOU race has come back.");
    process.exitCode = 1;
  } else {
    console.log("PASS: exactly one mechanic was assigned; the race is closed.");
  }
}

run();
