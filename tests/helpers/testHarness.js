// Shared helper for tests that call controller functions directly with
// mock req/res objects (the pattern established by the concurrency and
// performance tests). Extracted here during Sprint 4 (test coverage
// expansion) so new tests don't repeat the same DB-reset/token-issuing
// boilerplate that was copy-pasted across the first three tests.
const path = require("path");
const fs = require("fs");

const PROJECT_ROOT = path.join(__dirname, "..", "..");
process.chdir(PROJECT_ROOT);

const DB_PATH = path.join(PROJECT_ROOT, "evmos.db");

function resetDb() {
  if (fs.existsSync(DB_PATH)) fs.unlinkSync(DB_PATH);
  // db.js opens the connection at require-time and every module that
  // requires it shares the same singleton — so a fresh DB file requires a
  // fresh require cache too, or every test file after the first would
  // silently reuse a closed/stale connection from a previous test run in
  // the same process.
  delete require.cache[require.resolve(path.join(PROJECT_ROOT, "src/db"))];
  return require(path.join(PROJECT_ROOT, "src/db"));
}

function seedUser(db, { phone, name, role }) {
  const { id } = require(path.join(PROJECT_ROOT, "src/lib/util"));
  const userId = id("usr");
  db.prepare(`INSERT INTO users (id, phone, name, role) VALUES (?, ?, ?, ?)`).run(userId, phone, name, role);
  return userId;
}

function issueToken(db, userId) {
  const { id } = require(path.join(PROJECT_ROOT, "src/lib/util"));
  const token = id("tok");
  db.prepare(`INSERT INTO sessions_tokens (token, user_id, expires_at) VALUES (?, ?, datetime('now','+30 days'))`).run(
    token,
    userId
  );
  return token;
}

// Convenience: seed a user AND issue their token in one call, since almost
// every test needs both immediately.
function makeAuthedUser(db, { phone, name, role }) {
  const userId = seedUser(db, { phone, name, role });
  const token = issueToken(db, userId);
  return { userId, token };
}

function mockReq(token, bodyObj = {}, delayMs = 0) {
  const EventEmitter = require("events");
  const req = new EventEmitter();
  req.headers = token ? { authorization: `Bearer ${token}` } : {};
  setTimeout(() => {
    req.emit("data", Buffer.from(JSON.stringify(bodyObj)));
    req.emit("end");
  }, delayMs);
  return req;
}

function mockRes() {
  return {
    statusCode: null,
    body: null,
    headersSent: false,
    writeHead(status) {
      this.statusCode = status;
      this.headersSent = true;
    },
    end(payload) {
      this.body = payload ? JSON.parse(payload) : null;
    },
  };
}

// Minimal pass/fail tracker shared across test files, so each one prints
// a consistent summary and sets process.exitCode correctly for CI use
// later, without every test file reimplementing this.
function makeChecker() {
  let allOk = true;
  function check(label, cond) {
    console.log(`${cond ? "PASS" : "FAIL"}: ${label}`);
    if (!cond) allOk = false;
  }
  function finish() {
    console.log("\n=== VERDICT ===");
    if (allOk) {
      console.log("PASS: all checks passed.");
    } else {
      console.log("FAIL: see above for which check(s) failed.");
      process.exitCode = 1;
    }
  }
  return { check, finish };
}

module.exports = { resetDb, seedUser, issueToken, makeAuthedUser, mockReq, mockRes, makeChecker, PROJECT_ROOT };
