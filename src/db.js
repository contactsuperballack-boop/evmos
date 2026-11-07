// EVMOS Phase 1 — local dev database
//
// Uses Node's built-in `node:sqlite` so the backend runs with zero external
// dependencies during early development/testing.
//
// PRODUCTION NOTE (see build spec, section 2.1):
// This schema is written to map cleanly onto PostgreSQL + PostGIS.
// `lat`/`lng` columns here are plain REALs; in Postgres they become a
// PostGIS `geography(Point)` column so `/stations/nearby` can use a real
// spatial index (ST_DWithin) instead of the haversine scan used here.

const { DatabaseSync } = require("node:sqlite");
const path = require("path");

const DB_PATH = path.join(__dirname, "..", "evmos.db");
const db = new DatabaseSync(DB_PATH);

// Foreign keys are OFF by default in SQLite unless explicitly enabled per
// connection. Found during the hardening pass (not in the original audit):
// every FOREIGN KEY declared below was silently unenforced. Must be set
// before any other statements run.
db.exec(`PRAGMA foreign_keys = ON;`);

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    phone TEXT UNIQUE NOT NULL,
    name TEXT,
    role TEXT NOT NULL CHECK (role IN ('driver', 'station_owner', 'mechanic')),
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS otp_codes (
    phone TEXT PRIMARY KEY,
    code TEXT NOT NULL,
    expires_at TEXT NOT NULL,
    -- Rate-limiting fields added during hardening pass:
    request_count INTEGER NOT NULL DEFAULT 1,
    window_started_at TEXT NOT NULL DEFAULT (datetime('now')),
    last_requested_at TEXT NOT NULL DEFAULT (datetime('now')),
    verify_attempts INTEGER NOT NULL DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS sessions_tokens (
    token TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    expires_at TEXT NOT NULL DEFAULT (datetime('now', '+30 days')),
    revoked_at TEXT,
    FOREIGN KEY (user_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS vehicles (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    make TEXT NOT NULL,
    model TEXT NOT NULL,
    battery_capacity_kwh REAL,
    year INTEGER,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS stations (
    id TEXT PRIMARY KEY,
    owner_id TEXT NOT NULL,
    name TEXT NOT NULL,
    lat REAL NOT NULL,
    lng REAL NOT NULL,
    address TEXT,
    status TEXT NOT NULL DEFAULT 'pending_review' CHECK (status IN ('pending_review','active','inactive')),
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (owner_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS chargers (
    id TEXT PRIMARY KEY,
    station_id TEXT NOT NULL,
    connector_type TEXT NOT NULL,
    price_per_kwh REAL NOT NULL,
    is_available INTEGER NOT NULL DEFAULT 1,
    FOREIGN KEY (station_id) REFERENCES stations(id)
  );

  CREATE TABLE IF NOT EXISTS queue_state (
    charger_id TEXT PRIMARY KEY,
    current_wait_estimate_min INTEGER NOT NULL DEFAULT 0,
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (charger_id) REFERENCES chargers(id)
  );

  CREATE TABLE IF NOT EXISTS charging_sessions (
    id TEXT PRIMARY KEY,
    driver_id TEXT NOT NULL,
    charger_id TEXT NOT NULL,
    started_at TEXT NOT NULL DEFAULT (datetime('now')),
    ended_at TEXT,
    kwh_estimate REAL,
    payment_status TEXT NOT NULL DEFAULT 'unpaid' CHECK (payment_status IN ('unpaid','paid','insufficient_balance')),
    amount_charged REAL,
    FOREIGN KEY (driver_id) REFERENCES users(id),
    FOREIGN KEY (charger_id) REFERENCES chargers(id)
  );

  CREATE TABLE IF NOT EXISTS mechanics (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    tier TEXT NOT NULL DEFAULT 'general' CHECK (tier IN ('certified','general')),
    verification_docs_url TEXT,
    status TEXT NOT NULL DEFAULT 'pending_verification' CHECK (status IN ('pending_verification','active')),
    FOREIGN KEY (user_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS service_requests (
    id TEXT PRIMARY KEY,
    driver_id TEXT NOT NULL,
    mechanic_id TEXT,
    fault_type TEXT NOT NULL,
    lat REAL NOT NULL,
    lng REAL NOT NULL,
    status TEXT NOT NULL DEFAULT 'requested' CHECK (status IN ('requested','accepted','completed','cancelled')),
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (driver_id) REFERENCES users(id),
    FOREIGN KEY (mechanic_id) REFERENCES mechanics(id)
  );
  CREATE TABLE IF NOT EXISTS wallets (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL UNIQUE,
    balance REAL NOT NULL DEFAULT 0,
    currency TEXT NOT NULL DEFAULT 'NGN',
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS transactions (
    id TEXT PRIMARY KEY,
    wallet_id TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('top_up','charge_payment','mechanic_payment','marketplace_order','payout','featured_listing')),
    amount REAL NOT NULL,
    reference TEXT UNIQUE,
    status TEXT NOT NULL DEFAULT 'completed' CHECK (status IN ('pending','completed','failed')),
    metadata TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (wallet_id) REFERENCES wallets(id)
  );
  CREATE TABLE IF NOT EXISTS coupons (
    id TEXT PRIMARY KEY,
    code TEXT UNIQUE NOT NULL,
    discount_type TEXT NOT NULL CHECK (discount_type IN ('percentage','fixed')),
    discount_value REAL NOT NULL,
    usage_cap INTEGER,
    used_count INTEGER NOT NULL DEFAULT 0,
    expires_at TEXT,
    scope TEXT NOT NULL DEFAULT 'all' CHECK (scope IN ('charging','marketplace','mechanic','all')),
    created_by TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (created_by) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS coupon_redemptions (
    id TEXT PRIMARY KEY,
    coupon_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    session_id TEXT,
    discount_applied REAL NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE (coupon_id, user_id),
    FOREIGN KEY (coupon_id) REFERENCES coupons(id),
    FOREIGN KEY (user_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS loyalty_accounts (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL UNIQUE,
    points_balance INTEGER NOT NULL DEFAULT 0,
    tier TEXT NOT NULL DEFAULT 'standard' CHECK (tier IN ('standard','silver','gold')),
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS loyalty_ledger (
    id TEXT PRIMARY KEY,
    loyalty_account_id TEXT NOT NULL,
    points_delta INTEGER NOT NULL,
    reason TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (loyalty_account_id) REFERENCES loyalty_accounts(id)
  );
  CREATE TABLE IF NOT EXISTS holds (
    id TEXT PRIMARY KEY,
    driver_id TEXT NOT NULL,
    charger_id TEXT NOT NULL,
    hold_until TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','fulfilled','expired','cancelled')),
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (driver_id) REFERENCES users(id),
    FOREIGN KEY (charger_id) REFERENCES chargers(id)
  );
  CREATE TABLE IF NOT EXISTS marketplace_products (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    category TEXT NOT NULL,
    description TEXT,
    price REAL NOT NULL,
    stock_qty INTEGER NOT NULL DEFAULT 0,
    seller_id TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','inactive')),
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (seller_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS marketplace_orders (
    id TEXT PRIMARY KEY,
    buyer_id TEXT NOT NULL,
    product_id TEXT NOT NULL,
    qty INTEGER NOT NULL,
    total REAL NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','paid','fulfilled','cancelled')),
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (buyer_id) REFERENCES users(id),
    FOREIGN KEY (product_id) REFERENCES marketplace_products(id)
  );
  CREATE TABLE IF NOT EXISTS featured_listings (
    id TEXT PRIMARY KEY,
    station_id TEXT NOT NULL,
    starts_at TEXT NOT NULL DEFAULT (datetime('now')),
    ends_at TEXT NOT NULL,
    amount_paid REAL NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (station_id) REFERENCES stations(id)
  );
  CREATE TABLE IF NOT EXISTS mechanic_documents (
    id TEXT PRIMARY KEY,
    mechanic_id TEXT NOT NULL,
    filename TEXT NOT NULL,
    mime_type TEXT NOT NULL,
    content_base64 TEXT NOT NULL,
    uploaded_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (mechanic_id) REFERENCES mechanics(id)
  );
  CREATE TABLE IF NOT EXISTS mechanic_reviews (
    id TEXT PRIMARY KEY,
    mechanic_id TEXT NOT NULL,
    driver_id TEXT NOT NULL,
    service_request_id TEXT NOT NULL UNIQUE,
    rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
    comment TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (mechanic_id) REFERENCES mechanics(id),
    FOREIGN KEY (driver_id) REFERENCES users(id),
    FOREIGN KEY (service_request_id) REFERENCES service_requests(id)
  );
  CREATE TABLE IF NOT EXISTS station_reviews (
    id TEXT PRIMARY KEY,
    station_id TEXT NOT NULL,
    driver_id TEXT NOT NULL,
    session_id TEXT NOT NULL UNIQUE,
    rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
    comment TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (station_id) REFERENCES stations(id),
    FOREIGN KEY (driver_id) REFERENCES users(id),
    FOREIGN KEY (session_id) REFERENCES charging_sessions(id)
  );
  CREATE TABLE IF NOT EXISTS ai_recommendation_logs (
    id TEXT PRIMARY KEY,
    driver_id TEXT NOT NULL,
    options_shown TEXT NOT NULL,
    charger_recommended TEXT NOT NULL,
    charger_selected TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (driver_id) REFERENCES users(id)
  );
`);

// PERFORMANCE: indexes added alongside the nearbyStations batching rewrite
// (see HARDENING_AND_SCOPE.md "Performance" section). Not a measured need
// at pilot scale — SQLite full-table-scans dozens of rows in effectively
// zero time — but these are exactly the foreign-key columns the batched
// `WHERE id IN (...)` queries filter on, plus the other known hot lookups
// (a driver's own sessions, a mechanic's own assigned jobs). Free to add,
// never harmful, and already in place before there's real data volume to
// need them, rather than retrofitted after a slow query is found in
// production.
db.exec(`
  CREATE INDEX IF NOT EXISTS idx_chargers_station_id ON chargers(station_id);
  CREATE INDEX IF NOT EXISTS idx_charging_sessions_driver_id ON charging_sessions(driver_id);
  CREATE INDEX IF NOT EXISTS idx_charging_sessions_charger_id ON charging_sessions(charger_id);
  CREATE INDEX IF NOT EXISTS idx_service_requests_driver_id ON service_requests(driver_id);
  CREATE INDEX IF NOT EXISTS idx_service_requests_mechanic_id ON service_requests(mechanic_id);
  CREATE INDEX IF NOT EXISTS idx_mechanics_user_id ON mechanics(user_id);
  CREATE INDEX IF NOT EXISTS idx_stations_owner_id ON stations(owner_id);
  CREATE INDEX IF NOT EXISTS idx_holds_charger_id ON holds(charger_id);
  CREATE INDEX IF NOT EXISTS idx_featured_listings_station_id ON featured_listings(station_id);
  CREATE INDEX IF NOT EXISTS idx_station_reviews_station_id ON station_reviews(station_id);
`);

module.exports = db;
