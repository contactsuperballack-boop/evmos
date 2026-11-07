const crypto = require("crypto");

// Default cap for JSON request bodies. Routes that legitimately need more
// (currently only mechanic document upload, which carries a base64-encoded
// file) pass an explicit larger limit. Without any cap here, a client could
// stream an unbounded body and exhaust server memory before any handler-level
// validation ever runs — this protects the whole API, not just one route.
const DEFAULT_MAX_BODY_BYTES = 256 * 1024; // 256KB — generous for any plain JSON payload in this API

function id(prefix) {
  return `${prefix}_${crypto.randomBytes(8).toString("hex")}`;
}

function json(res, status, body) {
  if (res.headersSent) return; // guard against double-send (e.g. after a body-limit abort)
  const payload = JSON.stringify(body, null, 2);
  res.writeHead(status, {
    "Content-Type": "application/json",
    "Content-Length": Buffer.byteLength(payload),
  });
  res.end(payload);
}

function readBody(req, maxBytes = DEFAULT_MAX_BODY_BYTES) {
  return new Promise((resolve, reject) => {
    let data = "";
    let bytes = 0;
    let settled = false;

    function fail(err) {
      if (settled) return;
      settled = true;
      reject(err);
    }
    function succeed(value) {
      if (settled) return;
      settled = true;
      resolve(value);
    }

    req.on("data", (chunk) => {
      bytes += chunk.length;
      if (bytes > maxBytes) {
        // Reject once, but do NOT destroy the socket — req and res share
        // the same underlying connection in Node's http module, and
        // destroying it here would drop the connection before the 413
        // response below ever gets written (client sees a bare reset,
        // not a clean error). Instead: stop appending to `data` (this is
        // what actually protects memory) but keep draining the stream so
        // it can reach 'end' normally while the response goes out.
        if (!settled) {
          const err = new Error(`Request body exceeds ${maxBytes}-byte limit`);
          err.status = 413;
          fail(err);
        }
        return;
      }
      data += chunk;
    });
    req.on("end", () => {
      if (!data) return succeed({});
      try {
        succeed(JSON.parse(data));
      } catch (e) {
        const err = new Error("Invalid JSON body");
        err.status = 400;
        fail(err);
      }
    });
    req.on("error", fail);
  });
}

// Haversine distance in km between two lat/lng points.
// PRODUCTION NOTE: replace with PostGIS ST_DWithin / ST_Distance once on
// Postgres — this is a fine substitute for local dev and small datasets,
// but doesn't scale to a spatially-indexed query at real station volume.
function distanceKm(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

module.exports = { id, json, readBody, distanceKm, DEFAULT_MAX_BODY_BYTES };
