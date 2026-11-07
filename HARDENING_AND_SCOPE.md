# EVMOS — Hardening & Scope Reduction

Driven by an external audit (both documents provided by the founder) of
the Phase 1/2 codebase. Every finding below was independently re-verified
against the actual code before being trusted — not just accepted from the
audit — same discipline as every other claim in this build. See the
"Independently verified" note on each item.

Canonical product spec going forward: `EVMOS_MVP_Product_Definition_v1.0.docx`
(founder-provided). Four pillars: CHARGE (P0), VEHICLE (P0/P1), ASSIST (P1),
STORE/FOR YOUR VEHICLE (P1). Nav per spec section 12: Home/Map, Trips,
Assist, For Your Vehicle, Profile.

### Founder decision re: Chairman's reassessment (this session)

The founder reviewed the Chairman's reassessment report and made an explicit
call: **all four pillars (CHARGE/VEHICLE/ASSIST/STORE) ship in the launch
MVP as specified in v1.0.** The reassessment's narrowing recommendation is
not being applied by cutting pillars.

This is not a rejection of the Chairman's core warning — it's an application
of it at a different layer. The reassessment's actual fatal-flaw list was
about *monetization and platform breadth* (payments, loyalty, coupons, fleet
dashboard, public API, marketplace-as-revenue-stream), not about Assist or
Store existing as lightweight secondary features. Product Definition v1.0
already excludes all of those (see its own Section 13). Keeping 4 pillars
is consistent with v1.0; it is the monetization/platform layers beyond v1.0
that stay deferred.

Practically:
- CHARGE and VEHICLE: full P0 scope, unchanged.
- ASSIST: full scope per spec, but stays a secondary safety layer per
  Section 10 — not a design/engineering priority equal to Charge.
- STORE: full scope per spec, but dropship-only, no seller marketplace,
  no seller dashboards, per Section 11 — do not let this grow past that.
- Still deferred regardless of pillar count: real payments/wallet, loyalty,
  coupons, reservations, fleet dashboard, public API. These were the actual
  scope risk the Chairman flagged, not the four pillars themselves.
- The Chairman's "truth model" (data confidence: verified / operator-reported
  / stale / unknown) still applies across all four pillars — including
  Store (supplier fulfillment reliability) and Assist (mechanic
  verification) — not just Charge.
- The Chairman's beachhead/buyer/micro-market questions remain worth
  answering, but they inform *who launches first*, not *what ships*.

## Security fixes (P0, confirmed against real code before fixing)

- [x] Negative kWh accepted, silently credits wallet — **FIXED & LIVE-TESTED**
- [x] Duplicate session completion (no state-machine check) — **FIXED &
      LIVE-TESTED for the sequential case; a separate CONCURRENT variant of
      this same bug (real double-billing) was found later and is fixed —
      see "TOCTOU race conditions" section below.**
- [x] Service-request authorization (any authenticated user could mutate any request) — **FIXED & LIVE-TESTED**
- [x] Nearby mechanic requests fully unauthenticated — **FIXED & LIVE-TESTED**
- [x] Queue update authorization (no station-ownership check) — **FIXED & LIVE-TESTED**
- [x] Session creation doesn't validate charger/station/availability/duplicate-active-session — **FIXED & LIVE-TESTED**
- [x] OTP code exposed in API response with no rate limiting — **FIXED & LIVE-TESTED**
- [x] Session tokens never expire — **FIXED & LIVE-TESTED**
- [x] Request body has no size limit — **FIXED & LIVE-TESTED**
- [x] SQLite foreign keys never enabled (found during verification, not in the audit) — **FIXED & VERIFIED**

**All ten P0 security items are now closed.** Nothing new added to this list
in this pass beyond what was already tracked.

### What "FIXED & LIVE-TESTED" means for the first three items

All three live in the rewritten `src/routes/sessions.js`. Confirmed via a
single self-contained live run against the actual backend, not just
`node -c`:
- Negative kWh (`-10`) correctly rejected with HTTP 400, wallet balance
  unchanged (stayed at 5000)
- A legitimate end (10 kWh) correctly charged ₦1,000 and awarded 10
  loyalty points
- Ending the *same* session again correctly returned
  `409 SESSION_ALREADY_COMPLETED`, wallet balance correctly unchanged at
  4000 (not double-charged to 3000)
- Starting a session against a nonexistent charger correctly 404s instead
  of a raw DB error
- Starting a second session while one is already active correctly 409s
  with the active session's ID surfaced, instead of silently allowing two
  concurrent sessions

New rule added beyond what the audit asked for: only `driver`-role
accounts can start a session (was previously any authenticated user).

### This pass: the remaining seven P0 items

**1. Service-request authorization** (`src/routes/mechanics.js`,
`updateServiceRequest`) — was the most severe open finding: any
authenticated user could mutate any service request's status and set
`mechanic_id` to anything supplied in the body. Rewritten with explicit
per-transition rules: `requested → accepted` requires the caller to be an
*active* (verified) mechanic, with `mechanic_id` always derived
server-side from the caller's own mechanic record — client-supplied
`mechanic_id` is now ignored entirely, not just validated, so it can't be
used to assign a job to someone else. `accepted → completed` requires the
caller to be the specific mechanic already assigned. `→ cancelled` allows
only the requesting driver or the currently assigned mechanic. Live-tested:
unrelated authenticated user blocked (403) from accepting; unregistered
mechanic blocked (403); registered-but-`pending_verification` mechanic
blocked (403); active mechanic accepts successfully; a different mechanic
blocked (403) from completing someone else's job; assigned mechanic
completes successfully; double-complete correctly 409s; unrelated driver
blocked (403) from cancelling someone else's request; owning driver
cancels successfully; mechanic_id spoofing attempt in the request body
confirmed ignored.

**2. Nearby mechanic requests fully unauthenticated**
(`src/routes/mechanics.js`, `nearbyRequests`) — previously had zero auth
check, publicly exposing stranded drivers' live location and fault
description to anyone who knew the URL shape. Now requires
authentication and an existing mechanic profile (any registration status —
narrowing to `active` only was considered but rejected, since a
newly-registered mechanic still legitimately needs to see what volume of
demand exists nearby while awaiting verification; the actual *accept*
action is where the `active`-only gate correctly lives, per finding #1).
Live-tested: no token → 401; authenticated non-mechanic → 403.

**3. Queue update authorization** (`src/routes/queue.js`, `updateQueue`) —
previously any authenticated user could set any charger's queue wait time.
Now mirrors the ownership check already used in `stations.updateCharger`:
charger must exist, and the caller must be the owner of the station it
belongs to. Live-tested: a different station owner blocked (403) from
updating another owner's charger queue; the actual owner succeeds.

**4. OTP exposure + no rate limiting** (`src/routes/auth.js`) — `dev_code`
was unconditionally returned in the `/auth/otp/request` response with no
SMS provider wired up. Now gated behind `EVMOS_EXPOSE_DEV_OTP=true` (unset
by default), while still unconditionally logged server-side so local dev
and this project's own live-testing discipline keep working by reading the
log instead of the response. Added: a 30-second resend cooldown, a 5-request
rolling-hour cap per phone number, and a 5-attempt cap on wrong-code guesses
after which the code is invalidated outright (closes the brute-force path
against a 6-digit code). Live-tested: `dev_code` absent from a normal
response; immediate second request correctly 429s; 5 wrong guesses lock
out the phone number such that even the *correct* code is then rejected
with 429 until a fresh code is requested.

**5. Session tokens never expire** (`src/db.js`, `src/lib/auth.js`,
`src/routes/auth.js`) — `sessions_tokens` gained `expires_at` (30-day TTL
set at issuance) and `revoked_at`. `requireAuth`/`currentUser` now reject
tokens that are expired or revoked, with no distinction in the response
between "missing," "invalid," "expired," and "revoked" (all render as a
generic 401, deliberately — a differentiated response would leak
information about token validity to anyone probing the API). Added
`POST /auth/logout`, which revokes the presented token; all three mobile
apps' `signOut()` now call it (best-effort — local sign-out still proceeds
if the network call fails, so a user is never stuck "logged in" on a
device with no connectivity). Live-tested: token works pre-logout, logout
succeeds, the same token is then correctly rejected with 401.

**6. Request body has no size limit** (`src/lib/util.js`) — `readBody` had
no cap at all; an unbounded body could be streamed to exhaust server
memory before any handler-level validation ran. Added a 256KB default cap
(ample for any JSON payload in this API), with the one legitimate exception
— mechanic document upload — passing an explicit larger limit sized to its
existing base64 file-size check. First implementation attempt called
`req.destroy()` on overflow, which drops the shared req/res socket before
a response can be written (client sees a bare connection reset, not a
clean error) — caught during live-testing and fixed to stop buffering
without destroying the connection, so a proper `413` is returned and the
connection stays usable. Live-tested: oversized body → clean 413 (not a
reset, not a crash); server continues serving normal requests immediately
after; `server.js`'s error handler updated to respect `err.status` from
`readBody` instead of collapsing everything to 500.

**7. SQLite foreign keys never enabled** — `PRAGMA foreign_keys = ON` added
at connection setup in `src/db.js`. Checked for regression risk first: the
codebase has exactly one `DELETE` statement (`otp_codes`, a table with no
children), so enabling enforcement carried no risk of breaking an existing
delete path. Verified with `PRAGMA foreign_keys` returning `1`, and
confirmed the full core loop (station → charger → session → end) plus all
of items 1–6 above still work correctly with enforcement on — no
regressions from the earlier two fixed sessions.js protections either
(negative-kWh rejection and duplicate-completion 409 both re-verified in
the same pass).

## Tooling correction: `node -c` was not actually validating mobile JS+JSX files

Found while re-verifying the Station Portal nav changes in this session —
important enough to flag on its own.

`node --check` (`node -c`), used throughout this project's history as the
"syntax-checked" step for mobile screens, silently **passes files it never
actually parses** when a file contains a top-level `import`/`export`
statement (i.e. every screen in all three apps — they're all ES modules).
Confirmed directly: a file with `import React from "react"` followed by
outright invalid syntax (`const a = ;`, an unclosed function body) still
returns exit code 0 from `node -c`. The same broken content in a file
*without* an import statement is correctly rejected. This appears to be a
real quirk/bug in how Node 22's `--check` flag handles ambiguous-module
detection — it isn't specific to this project, but it means every prior
"`node -c` passed" claim for a mobile screen in this project's history
was **not a real signal**. Plain `node file.js` (actual execution) does
correctly catch these errors, but can't be used as a check here since it
would also try to resolve `react-native` etc., which aren't installed in
this sandbox.

**Fix**: this environment has `esbuild` available (bundled with the
globally-installed `tsx` package) and it correctly distinguishes real
syntax errors from module-resolution errors, without executing anything:

```
/home/claude/.npm-global/lib/node_modules/tsx/node_modules/esbuild/bin/esbuild --loader:.js=jsx <file>
```

Re-ran this against every `.js` file in `mobile/`, `station-portal/`, and
`mechanic-app/` after discovering this — **all files pass a genuine
syntax check**, so nothing was silently broken by this gap. But going
forward, use the esbuild command above for mobile file syntax checks in
this project, not `node -c`.

- Money as REAL → integer minor units (kobo): audit itself times this
  "before payments," not "now" — deferred to avoid scope explosion touching
  wallet/sessions/marketplace/coupons/featured-listings simultaneously with
  everything else in this pass
- Full transaction atomicity (multi-step financial operations wrapped in
  DB transactions): same reasoning, "before real payments" per audit
- PostgreSQL/PostGIS migration: explicitly "before scale," not now
- Mobile secure token storage (SecureStore vs AsyncStorage): real fix,
  smaller scope — candidate for next pass, not this one
- Structured logging/observability, rate limiting infra, API versioning:
  explicitly pre-launch, not pre-beta, per the audit's own phasing

## Scope reduction

- [x] Driver App navigation restructured to match Product Definition v1.0
      section 12 exactly: Home/Map, Trips, Assist, For Your Vehicle, Profile
      — **DONE.** `mobile/src/navigation/AppNavigator.js` rewritten as a
      root stack (Login → HomeGate → VehicleRegistration → MainTabs) with a
      5-tab bottom navigator (Home, Trips, Assist, For Your Vehicle,
      Profile), each tab its own nested stack.
- [x] Wallet moved out of primary nav into Profile — **DONE.** New
      `ProfileScreen.js` links to Wallet and Loyalty. Wallet/Loyalty remain
      registered at the root stack level (not inside any tab) so in-flow
      "top up" prompts from Station Detail / Marketplace checkout can still
      `navigate("Wallet")` directly.
- [x] Route Planner hidden from UI — **DONE.** `RoutePlannerScreen` is no
      longer imported or registered anywhere in the navigator. File left on
      disk per "hide don't delete." Do not re-register until backed by real
      road-aware routing (see audit reasoning, unchanged).
- [x] Heads-up Holds hidden from primary nav — **DONE.** Same treatment as
      Route Planner: unregistered, file kept, not linked from anywhere.
- [x] Marketplace reframed as "For Your Vehicle" — **DONE.** Screen file
      kept as `MarketplaceScreen.js` (internal name unchanged to minimize
      diff), but it's now the sole screen in the "For Your Vehicle" tab
      with that title, not a header link among five others.
- [x] Coupons/Loyalty nav entry — **DONE**, moves with Wallet into Profile
      as described above.
- [x] **Station Portal nav audited and fixed — worse mis-scope than the
      Driver App had.** Found: `WalletScreen` (217 lines) existed *solely*
      to pay for Featured Listings (Phase 2 monetization, explicitly
      deferred in every source doc and the founder's own written scope
      decision), fully wired and reachable — a header link on the portal's
      landing screen (`MyStationsScreen`), plus a live "boost this
      station, ₦500/day" purchase flow with modal in
      `StationManageScreen`. Unlike Driver Wallet (kept reachable for a
      real P1 dependency — Store checkout), there was no equivalent
      reason for this one to be reachable at all. **Fixed**: removed the
      Featured Listing card, modal, and purchase handler entirely from
      `StationManageScreen`; removed the Wallet header link from
      `MyStationsScreen`; unregistered `WalletScreen` from
      `station-portal/src/navigation/AppNavigator.js`. File kept on disk
      per "hide, don't delete." Backend `createFeaturedListing` /
      `getWallet` endpoints untouched.
- [ ] **Station Portal Analytics — still an open founder decision, not
      resolved by this pass.** `AnalyticsScreen` remains wired and
      reachable from `StationManageScreen`. The Chairman's reassessment
      specifically questioned whether a self-serve portal belongs at
      launch at all, recommending an EVMOS-operated station-data desk
      instead. Left as-is deliberately — this is a founder call, not an
      engineering one — but flagged again here since it's shipping
      regardless of the open question.
- [ ] Mechanic App — reviewed, matches Phase 1 build spec closely. One
      minor, low-severity item not yet actioned: `IncomingRequestsScreen`
      shows the logged-in mechanic their own tier badge and star rating in
      the header — tiering/ratings are explicitly Phase 2 scope. Read-only
      self-display, not a new feature surface; low priority, founder's call
      on whether it's worth stripping.

### Found and fixed while wiring the above (not on the original audit list)

- **Vehicle profile had no update path.** Product Definition v1.0 section 3
  ("Vehicle data remains editable") was unimplemented — only create + list
  existed. Wiring Profile → "edit vehicle" surfaced this. Added
  `PATCH /vehicles/:id` (ownership-checked, mirrors the pattern in
  `stations.updateCharger`) plus `api.updateVehicle` on the mobile client.
  Live-tested: successful update + persistence, 403 on cross-user edit
  attempt (with confirmation the target vehicle was left unmodified), 404
  on nonexistent vehicle, 401 with no token.
- **All three mobile apps' `package.json` were missing dependencies their
  own code imports** (`@react-navigation/*`, async-storage, expo-location,
  react-native-maps, expo-document-picker, expo-file-system, and the
  react-navigation peer deps `react-native-screens` /
  `react-native-safe-area-context`). `npm install && expo start` would have
  failed before ever reaching a device — this was silently blocking the
  "real device testing" priority. Fixed in all three `package.json` files.
  **Caveat:** exact version numbers were written from general knowledge,
  not verified against the npm registry (no network access in this
  sandbox) — run `npx expo install <package>` per app before first install
  to let Expo pin the versions actually correct for SDK 54.

## Positioning for real device testing (this session)

Real device testing has never been done and remains the top priority, but
this pass fixed the pre-existing gaps that would have made a first attempt
fail or silently misbehave, rather than leaving them for whoever runs it
first to debug blind:

- **`BASE_URL` was hardcoded to `http://localhost:4000` in all three
  apps' `src/api/client.js`.** This works from an iOS simulator on the
  same machine as the backend, but silently fails to connect from Expo Go
  on a physical phone (a phone can't resolve "localhost" to the dev
  machine). It was already commented with this caveat, but fixing it
  meant editing source in three places every time you switched between
  simulator/device/tunnel testing. **Fixed**: `apiBaseUrl` now lives in
  each app's `app.json` under `expo.extra`, read via `expo-constants`
  (added as a dependency to all three `package.json`). Left as an obvious
  placeholder (`http://CHANGE-ME-TO-YOUR-LAN-IP:4000`) rather than a
  guessed real value, and the app logs a clear console warning on startup
  if it's still unset — a silent wrong-URL failure during first-run
  testing would otherwise look identical to "the app is broken."
- **Leftover test database removed.** `evmos.db` from this session's live
  curl-testing was sitting in the project root and would have shipped
  with test users/stations/service-requests in it — removed before
  packaging.
- **No `.gitignore` existed anywhere.** Added at the root (excludes
  `evmos.db`, `node_modules/`) and in each of the three apps (excludes
  `node_modules/`, `.expo/`, build output, signing credentials). Without
  this, a first `git init` would either accidentally commit `node_modules`
  once installed, or commit real user data in the SQLite file later.
- **Re-verified every mobile `.js` file with a genuine JSX-aware syntax
  checker** (see the tooling-correction note above) after all of this
  session's edits — all pass.
- **Backend smoke-tested one more time** after these changes (health
  check + OTP request) — still boots and responds correctly.

**What real device testing will still actually require, beyond what's
fixed above** (none of this can be done from this sandbox — no network
egress, no simulator):

1. On a machine with Node 22+ and network access: run the backend
   (`node src/server.js`) and find that machine's LAN IP.
2. Per app: `npm install`, then `npx expo install <the packages listed in
   that app's README>` — not optional; hand-installing native-code
   packages with plain `npm install` risks version mismatches Expo would
   otherwise resolve automatically.
3. Edit that app's `app.json` → `extra.apiBaseUrl` to the LAN IP from
   step 1 (or set up `expo start --tunnel` / ngrok for testing over
   cellular or a different network than the backend).
4. `npx expo start`, then scan the QR code with Expo Go on a physical
   Android/iOS device, or press `i`/`a` for a simulator if one is
   available locally.
5. Walk each app's core loop end-to-end and record what actually breaks —
   expect *something* to. Syntax-valid is not the same as behaviorally
   correct; nothing run in this sandbox (esbuild checks, curl tests
   against the backend) can verify React Navigation's runtime behavior,
   `useFocusEffect` timing, or native module behavior (maps, location,
   document picker).
6. Specifically worth watching on first run: the new 5-tab Driver App
   navigation (nested stack-inside-tab structure, and whether
   `navigate("Wallet")` correctly bubbles up from a nested tab stack to
   the root stack at runtime — this is standard React Navigation v6
   behavior but has never actually executed here), and the Station
   Portal now that Wallet/Featured-Listing are unregistered (confirm
   nothing still references them at runtime that a static grep might
   have missed).

## TOCTOU race conditions — found via dedicated debugging pass, not live-testing

**This section partially corrects an earlier claim in this document.**
The "duplicate session completion" item above was marked FIXED &
LIVE-TESTED based on sequential curl tests (end a session, then try to
end it again). That test genuinely passed and the sequential case really
is fixed. What it didn't — and structurally couldn't — catch is two
requests already in flight at the same time, because no manual curl
sequence can reliably produce that timing. A dedicated concurrency
review found two real races of the same shape, one of which is the exact
double-billing scenario the earlier fix was supposed to close.

**Root cause (same in both places):** every affected handler read a
database row, then `await readBody(req)` to parse the request body, then
made an authorization or state-transition decision using the row it read
*before* the await. `await` yields Node's single-threaded event loop —
another request's handler can run to completion during that suspension.
If it does, the first handler resumes holding a stale in-memory snapshot
and makes its decision against data that's no longer true in the
database. Each individual line is correct; the sequence across the
`await` isn't atomic.

**Found and fixed:**

1. **`src/routes/sessions.js`, `endSession` — double-billing.** Two
   concurrent "end this session" calls (e.g. a flaky client retrying a
   slow request while the first is still in flight — ordinary behavior,
   no attacker required) could both pass the `session.ended_at` check and
   both charge the wallet. Empirically confirmed with a mock-concurrency
   harness before fixing: both calls returned `200`, wallet charged
   twice (₦2,000 taken for a single ₦1,000 session). **This is the most
   severe finding in this project's history** — it's real money, and it
   directly contradicts an earlier "fixed" claim. Fixed by moving
   `readBody` to the first line of the function, before any database
   read, so the entire fetch→check→charge→write sequence now runs as one
   uninterruptible synchronous block.
2. **`src/routes/mechanics.js`, `updateServiceRequest` — double-booking.**
   Two mechanics racing to accept the same open job could both receive a
   `200 accepted` response; the database silently keeps only the last
   writer's `mechanic_id`, so the other mechanic believes they have a job
   they don't. Confirmed the same way before fixing. Same fix pattern.

**Reordered defensively, not because they're exploitable today:**

3. `src/routes/queue.js`, `updateQueue` and `src/routes/stations.js`,
   `updateCharger` have the same *shape* (fetch owner info, then await,
   then check) but the field being checked — `station.owner_id` — is
   immutable after creation, so there's nothing for a stale read to
   diverge from. Reordered anyway for consistency, and so this exact
   pattern doesn't quietly become exploitable if station ownership is
   ever made transferable later.
4. `src/routes/vehicles.js`, `updateVehicle` (added earlier this
   session) — same shape, lower severity: a lost-update race on a
   single user's own data (e.g. two devices editing at once), not a
   cross-user authorization bypass. Reordered for the same reason.

**How this was found:** not through live curl testing (which is why it
survived an earlier hardening pass) but by treating the newly-added and
recently-modified routes as a senior engineer would in a pre-incident
review — reading every `await` point and asking "what decision depends
on data read before this, and can that data actually change during the
suspension." A small mock-concurrency harness (calls the real handler
functions directly with staggered fake request bodies to force the
interleaving deterministically, since real network timing is too
unreliable to depend on) proved each bug before it was fixed, then
proved the fix afterward. Both harnesses are now permanent regression
tests — see `tests/README.md`.

**General lesson for future work in this codebase:** in any handler that
does `db read → await something → db write`, either (a) move every
`await` before the first database read that a later check depends on, or
(b) re-fetch fresh state immediately before the write instead of reusing
an earlier in-memory snapshot. Sequential curl tests will never catch a
violation of this — only a concurrency-aware test or a deliberate code
read will.

## Performance: `nearbyStations` N+1 fix — implemented and measured, not just proposed

The earlier performance audit in this document identified the N+1 (really
N×M) query pattern in `GET /stations/nearby` as a real but low-priority
(P2) finding — correct at pilot scale, worth fixing before real load
testing reveals it as an actual bottleneck. It's now fixed, and verified
two ways rather than just reasoned about:

**What changed:** `src/routes/stations.js`, `nearbyStations` — every
per-station and per-charger lookup (featured status, chargers, queue
state, active holds, rating summaries) is now a single batched query
using `WHERE id IN (...)` across all in-range stations/chargers at once,
instead of one query per row. Output shape, sort order (featured first,
then distance), and the lazy hold-expiry semantics (a hold can still say
`status='active'` in the DB after `hold_until` has passed) are all
preserved exactly — verified in
`tests/performance/nearby_stations_query_batching.test.js`, which checks
correctness (9 assertions covering featured sorting, review averaging,
active vs. expired holds, out-of-range exclusion) and query count
together, so a future change that accidentally reintroduces a per-row
query gets caught automatically.

**Measured, not estimated:**
- Small mixed scenario (2 in-range stations, 2 chargers, one featured,
  one with reviews, one active + one lazily-expired hold): **11 queries
  → 6 queries** (measured by instrumenting `db.prepare` before and after,
  not reasoned from the code).
- At the actual pilot target scale (20 stations, 2 chargers each, all in
  range): **new version stays at 6 queries**; the old version's own
  formula run against the same shape would be ~141. Query count for the
  new version is now constant regardless of N — confirmed by actually
  running it at that scale, not assumed.
- Also added the 10 indexes identified as low-priority (P3) in the same
  audit (`src/db.js`) — free, safe, targets exactly the foreign-key
  columns this rewrite filters on.

**What wasn't measured, and isn't claimed:** wall-clock latency
before/after. SQLite is embedded (no network round-trip per query), so
6 vs. 11 vs. 141 *query count* is real and measured, but I have no way to
turn that into a millisecond figure without a real load-testing setup
this sandbox doesn't have. The claim here is "fewer queries, proven
correct, proven flat under scale" — not "X ms faster," because that
number doesn't exist yet.

## Clean architecture migration — sessions/wallet/coupons/loyalty (this session)

**Why not a full-codebase rewrite.** A flag-day conversion of every
`src/routes/*.js` file into a layered architecture was explicitly not
done. It would touch security- and money-critical code with no full test
coverage (three regression tests existed at the time), and it directly
conflicts with the MVP Product Definition's own stated technical
direction: "Evolve the existing architecture rather than rewriting it...
do not prematurely introduce microservices." Instead, this migrates one
real, representative, high-stakes vertical slice — the billing/session
domain — using an incremental "strangler fig" approach: new layered code
lives alongside the untouched old structure, and every file not migrated
keeps working exactly as before.

**New layers, all under `src/`:**
- `domain/errors.js` — `AppError` and four subclasses
  (`ValidationError` 400, `ForbiddenError` 403, `NotFoundError` 404,
  `ConflictError` 409). Services throw these; they carry the exact JSON
  body to send (a string becomes `{ error: <string> }`; an object is used
  as-is), which is what let every existing endpoint's error response
  shape — including the two irregular ones, `{ error, active_session_id }`
  and `{ error: "SESSION_ALREADY_COMPLETED", message }` — be preserved
  exactly rather than forced into one generic format.
- `repositories/` — every direct `db.prepare(...)` call for the migrated
  domain, one file per aggregate (`walletsRepository.js`,
  `couponsRepository.js`, `loyaltyRepository.js`, `sessionsRepository.js`,
  plus minimal read-only `chargersRepository.js` / `stationsRepository.js`
  scoped to exactly what `sessionsService` needs — **not** a full
  migration of `stations.js`, which still owns the rest of those tables).
  This is the layer a future Postgres migration touches, per aggregate,
  instead of touching every business-logic path.
- `services/` — `walletService.js`, `couponService.js`,
  `loyaltyService.js`, `sessionsService.js`. Pure business logic: no
  `req`/`res`, no `json`/`readBody`, no HTTP status codes anywhere in
  these files. `sessionsService.end()` is the one place the TOCTOU
  double-billing fix's invariant now lives explicitly documented: it
  takes an already-parsed `body` argument rather than reading the request
  itself, specifically so its entire fetch→check→charge→write sequence
  can run with zero `await` points — the controller is responsible for
  awaiting the body first.
- `http/` — `sessionsController.js`, `walletController.js`,
  `couponsController.js`, `loyaltyController.js`. Thin glue: authenticate,
  parse input, call the service, catch `AppError` and turn it into
  `json(res, err.status, err.body)`. No business rule lives in this
  layer — if a check belongs here, it's leaked from the service.

**Retired vs. shimmed, not silently broken:** `src/routes/sessions.js`
and `src/routes/coupons.js` were deleted outright — nothing else in the
codebase depended on them. `src/routes/wallet.js` and
`src/routes/loyalty.js` could **not** be deleted the same way:
`marketplace.js` and `stationExtras.js` (not part of this migration)
still call their pure functions (`debitWallet`, `awardPointsForPayment`)
directly. Both are now thin re-export shims pointing at the real
implementation in `services/`, so those two unmigrated files needed zero
changes and the actual logic exists in exactly one place, not two
copies that could drift apart.

**Proof this preserved behavior exactly, not just "should":**
- All three pre-existing regression tests still pass unmodified against
  the refactored code — including `session_double_billing.test.js`,
  which specifically proves the TOCTOU fix survived the migration intact
  (only its `require` path was updated, from the deleted
  `routes/sessions.js` to `http/sessionsController.js`).
- Full live HTTP regression across every touched endpoint: wallet
  get/topup (including the invalid-amount 400 with identical error
  text), coupon create/duplicate-409/validate, a complete
  session-with-coupon-and-loyalty flow end-to-end (10% coupon correctly
  discounted ₦1000→₦900, 9 loyalty points correctly awarded, tier
  progression correctly shown), and — critically — **the two unmigrated
  files exercised through the new shims**: a marketplace order and a
  featured-listing purchase both correctly debited the wallet and (for
  the marketplace order) awarded loyalty points, proving the shim layer
  isn't just present but actually wired correctly.

**What's migrated vs. what's next**, if this pattern gets continued:
migrated — sessions, wallet, coupons, loyalty. Still in the old
`routes/` structure, fully functional, next in line if this continues —
mechanics/service-requests (`mechanics.js`), stations/chargers
(`stations.js`), queue (`queue.js`), vehicles (`vehicles.js`), holds
(`holds.js`), auth (`auth.js`), marketplace (`marketplace.js`),
stationExtras (`stationExtras.js`). Each would follow the same pattern:
extract a repository, extract a service, leave a thin controller, prove
behavior unchanged with a live regression pass before moving to the next.

## Sprint plan (this session) and Sprint 1 progress

**Sprint 1** — migrate the two other high-stakes domains (mechanics/
service-requests, stations/chargers/queue) since both already have a
TOCTOU/performance fix and a regression test to prove against. **Sprint
2** — migrate the remaining lower-stakes domains (vehicles, holds, auth,
marketplace, stationExtras, stationReviews, recommendations) for
consistency. **Sprint 3** — apply the same TOCTOU-race review to
`holds.js createHold`, `marketplace.js createOrder`, `stationExtras.js
createFeaturedListing`, which haven't had that dedicated pass yet.
**Sprint 4** — expand automated test coverage beyond the 3 reactive
bug-derived tests. **Sprint 5** — split this file into a current-state
summary plus an archived-history section; it's grown past 600 lines.

### Sprint 1, Task 1: mechanics/service-requests — DONE

Migrated `src/routes/mechanics.js` (338 lines, no other file depended on
it) into:
- `repositories/mechanicsRepository.js`, `repositories/serviceRequestsRepository.js`
- `services/mechanicsService.js`, `services/serviceRequestsService.js` —
  `serviceRequestsService.updateStatus()` is where the TOCTOU fix's
  invariant now lives explicitly documented (body must be awaited by the
  caller before this function runs; the function itself performs its
  entire fetch-check-write with zero `await` points)
- `http/mechanicsController.js`, `http/serviceRequestsController.js`

Old file deleted outright (no shim needed — nothing else referenced it).
`server.js` updated to route to the two new controllers.

**Proof:** all 3 pre-existing regression tests pass unmodified (only the
mechanics test's `require` path changed, from the deleted `routes/
mechanics.js` to `http/serviceRequestsController.js`) — including
`service_request_double_accept.test.js`, which specifically re-confirms
the TOCTOU fix survived. Full live HTTP regression covering 12+ distinct
scenarios: register/profile 404-before-registration, wrong-role
rejection, unauthenticated/non-mechanic nearby-requests rejection,
unrelated-user view rejection, pending-verification mechanic blocked from
accepting, full accept→complete→review→duplicate-review-409 flow,
mechanic's assigned-jobs list, public reviews list, and both the document
upload happy path and the oversized-upload 413 rejection.

### Sprint 1, Task 2: stations/chargers/queue — DONE

Migrated `src/routes/stations.js` (295 lines, including last session's
N+1 performance fix) and `src/routes/queue.js` into:
- `repositories/stationsRepository.js`, `chargersRepository.js`,
  `queueRepository.js` (new) — plus three deliberately minimal,
  read-only repositories (`featuredListingsRepository.js`,
  `holdsRepository.js`, `stationReviewsRepository.js`) that exist only to
  serve the batched `listNearby` query; the full featured-listings/holds/
  reviews aggregates are still owned by their own unmigrated route files.
- `services/stationsService.js` (includes `listNearby` — the batched
  performance-critical query moved here verbatim, still 6 queries
  regardless of N/C), `services/queueService.js`
- `http/stationsController.js`, `http/queueController.js`

Both old files deleted outright — nothing else in the codebase imported
them. `server.js` and the performance test's `require` path updated.

**Notable preserved detail:** `listChargers` has no authentication at all
in the original code (anyone can browse a station's charger list without
logging in) — confirmed this was intentional, not an oversight, and
preserved exactly; a live test with zero `Authorization` header still
returns 200, not 401.

**Proof:** all 3 regression tests pass unmodified against the migrated
code (query count for `nearbyStations` still exactly 6). Full live HTTP
regression across 15+ scenarios: wrong-role station creation rejected,
create/list/public-chargers-view, cross-owner charger update rejected,
cross-owner station activation rejected, queue get (public) and
cross-owner queue update rejected vs. correct-owner success, full
`nearby-stations` end-to-end response shape, and cross-owner session-log
view rejection.

**Sprint 1 is now complete** — both planned migrations (mechanics/
service-requests, stations/chargers/queue) done and verified. Sprint 2
(vehicles, holds, auth, marketplace, stationExtras, stationReviews,
recommendations) is next if this continues.

## Sprint 2 progress

Cross-dependency check before starting: `vehicles.js`, `auth.js`,
`marketplace.js`, `stationExtras.js` have zero cross-dependents (safe to
retire outright). `holds.js`, `stationReviews.js`, `recommendations.js`
are each depended on by 1-2 already-migrated services
(`sessionsService.js`, `stationsService.js`) — migrating those three
means updating those call sites directly, not adding more shims.

### vehicles.js — DONE
Migrated to `repositories/vehiclesRepository.js`,
`services/vehiclesService.js`, `http/vehiclesController.js`. Old file
deleted (no dependents). The TOCTOU-fix comment from the earlier hardening
pass carried forward into the service with the same "controller awaits
body first" invariant. Live-verified: create/update/list, cross-user edit
403, not-found 404, missing-fields 400 — all match the original exactly.

### auth.js — DONE
The most security-critical file in this sprint, migrated with the most
care: `repositories/usersRepository.js`, `repositories/otpRepository.js`,
`repositories/sessionTokensRepository.js` (write side only — the *read*
side, `requireAuth`'s token lookup, deliberately stays in `lib/auth.js` as
a cross-cutting concern every controller needs, not a business flow the
auth domain's own service owns), `services/authService.js`,
`http/authController.js`. Every rate-limit constant, the exact
`+ "Z"` UTC date-parsing trick, and the `ON CONFLICT` window-reset logic
were moved verbatim, not rewritten from memory.

One real bug caught and fixed *during* this migration, before any test
ran: the first draft threw a `ConflictError` (hard-coded to 409) with a
fake `status429`/`status401` marker for the rate-limit and lockout cases,
instead of the actual 429/401 the original code returned. Caught by
re-reading the draft against the original before testing, fixed by using
the generic `AppError(status, payload)` directly for those cases.

Live-verified: dev_code hidden by default, resend cooldown 429, 5-wrong-
attempts lockout (6th attempt rejected even with the *correct* code),
missing-role-for-new-user 400, full login→authenticated-request→logout→
token-now-rejected flow, and the hourly request cap (exactly 5 allowed,
6th blocked). All three automated regression tests also re-run clean
after this migration, since auth underlies everything else.

### marketplace.js — DONE
Migrated to `repositories/marketplaceProductsRepository.js`,
`repositories/marketplaceOrdersRepository.js`,
`services/marketplaceService.js` (calls `walletService`/`loyaltyService`
directly now — no need for the `routes/wallet.js`/`routes/loyalty.js`
shims once the caller is itself a real service, not an unmigrated route
file), `http/marketplaceController.js`.

**Second real bug caught and fixed before testing**, same discipline as
the auth one: the original code generated a single `orderId` once and
used it for both the wallet transaction's metadata and the actual order
row, so the two are traceable to each other. The first draft generated
*two different* ids — one reserved for the wallet metadata, a second one
implicitly inside the repository's `create()` — which would have silently
broken that traceability. Fixed by having the repository accept the id
rather than generate its own.

**Also confirmed `createOrder` never had the TOCTOU shape the sessions/
mechanics bugs did** — the original code already read the request body
before any database access, so Sprint 3's planned race-condition review
of this file can be scoped down accordingly; it's this function
specifically that's already safe, not the whole file (stock-related
writes elsewhere weren't re-audited).

Live-verified: wrong-role product creation 403, create/public-list/mine,
over-stock order 400, a correct order (exact total, exact 10 loyalty
points on ₦1000, stock correctly decremented from 3 to 1), a following
insufficient-balance 402, cross-user product-update 403, and order
history. All three automated regression tests re-run clean again.

**Sprint 2 status: 3 of 7 files done** (vehicles, auth, marketplace).
Remaining: holds, stationExtras, stationReviews, recommendations — the
three with cross-dependents need their dependent files' `require` paths
updated as part of the migration, not just the file itself.

### holds.js, stationReviews.js, recommendations.js, stationExtras.js — DONE

All four remaining Sprint 2 files migrated in one continuous pass:

- **holds.js** → `repositories/holdsRepository.js` (expanded from the
  minimal read-only version created in Sprint 1),
  `services/holdsService.js`, `http/holdsController.js`. The lazy-expiry
  semantics (`effectiveStatus` — a hold can say `status='active'` after
  `hold_until` has passed, since nothing proactively expires it) moved
  verbatim. Cross-dependents updated: `sessionsService.js`'s
  `fulfillHoldIfPresent` call now points at `holdsService`, and
  `routePlanning.js`'s `getActiveHoldForCharger` import updated the same
  way (routePlanning.js itself is not migrated — only its import path
  changed).
- **stationReviews.js** → `repositories/stationReviewsRepository.js`
  (expanded from Sprint 1's minimal batch-only version to full CRUD),
  `services/stationReviewsService.js`, `http/stationReviewsController.js`.
  `stationsService.js`'s cross-domain `ratingSummary` import updated to
  point at the new service instead of the retired route file.
- **recommendations.js** → `repositories/aiRecommendationLogsRepository.js`
  (new), `services/recommendationsService.js`,
  `http/recommendationsController.js`. Moved as a pure structural change,
  **not** batched the way `stationsService.listNearby` was — this
  endpoint still runs one query per station for chargers and one per
  charger for queue state, on purpose; applying the N+1 fix here wasn't
  asked for and would have been an uninvited scope addition riding along
  on a "keep behavior unchanged" migration. `sessionsService.js`'s
  `recordSelection` import updated accordingly.
- **stationExtras.js** → `repositories/featuredListingsRepository.js`
  (expanded to full CRUD) plus three new aggregation methods added to
  `repositories/sessionsRepository.js` (`aggregateTotalsForChargers`,
  `peakHourForChargers`, `sessionStatsByStation` — analytics queries, kept
  there since they're fundamentally sessions aggregations),
  `services/stationExtrasService.js`, `http/stationExtrasController.js`.

**Bonus cleanup, discovered rather than planned:** migrating
`stationExtras.js` removed the only remaining caller of the
`routes/wallet.js` / `routes/loyalty.js` compatibility shims created
during the earlier wallet/loyalty migration (marketplace.js's need for
them was already removed when marketplace.js itself was migrated this
sprint). Confirmed via grep that nothing referenced either shim anymore,
then deleted both. `src/routes/` now contains only `maps.js` and
`routePlanning.js` — the two files never in scope for this migration
(external map-provider integration, and the deliberately UI-hidden route
planner backend).

**Proof:** all 3 automated regression tests pass — notably, the
double-billing test specifically exercises `sessionsService.start()`,
which now calls into `holdsService` and `recommendationsService` instead
of the retired route files, so a regression in either cross-reference
would have shown up there. Full live HTTP regression across every
migrated endpoint: holds (create/duplicate-blocked/cancel/ownership
checks), recommendations (scored candidate list, justification text, and
— the cross-service proof — a started session correctly linked back to
the recommendation that led to it via `ai_recommendation_logs
.charger_selected`), station reviews (create/duplicate-409/public list),
analytics (ownership-gated, exact totals verified: 1 session, ₦1000
revenue, 10 kWh), and featured listings (ownership-gated, insufficient-
balance 402, successful purchase, and confirmed the purchased listing
correctly shows `is_featured: true` back through the *separately migrated*
`stationsService.listNearby` — proving the two services share the same
repository correctly rather than holding divergent state).

**Sprint 2 is now complete. All planned backend domains are migrated.**
`src/routes/` holds only the two files never in scope. Sprint 3 (TOCTOU
review of the files that haven't had one — largely superseded now, since
`marketplace.js createOrder` was confirmed already-safe during its own
migration, and `holds.js createHold` / `stationExtras.js
createFeaturedListing` were just rewritten with the same "read body
before DB access" discipline applied throughout) and Sprint 4 (expand
test coverage) remain if this continues.

## Sprint 3: systematic TOCTOU sweep — zero new instances found

Rather than re-checking only the three files originally named for this
sprint (all three turned out already-safe during their own Sprint 2
migrations — `marketplace.js createOrder`, and `holds.js`/
`stationExtras.js`'s controllers, all read the body before any DB
access), did a full sweep instead:

1. Every `http/*.js` controller checked for the actual failure shape (a
   DB-touching call happening *before* an `await readBody`, with the
   result used in a later check). Every single controller follows the
   same safe shape: `requireAuth` (identity lookup only — not a
   business-state check that can go stale) → `await readBody` → exactly
   one synchronous service call that does the rest. No exceptions found.
2. Every file in `src/services/` and `src/repositories/` grep'd for
   `await` — the only matches are inside comments *explaining* the
   invariant (deliberately using the word "await" in prose), not real
   `await` keywords in executable code. Confirmed with a second, targeted
   grep per file. All services are genuinely fully synchronous, as
   intended.
3. The two files never in scope for migration (`routePlanning.js`,
   `maps.js`) checked too, for completeness: `routePlanning.js` reads its
   body before its one `db.prepare` call (safe); `maps.js` has no request
   body or database access at all (external provider proxy only).

**Conclusion: this entire bug class is closed codebase-wide**, not just
at the two originally-found sites. Nothing new to fix this sprint — the
value was in confirming that systematically rather than assuming it from
the pattern holding in the files already checked.

## Sprint 4: test coverage expansion — 3 tests to 7

Extracted `tests/helpers/testHarness.js` first (DB reset, authed-user
seeding with a real issued token — not a fake one, so tests exercise the
actual auth path, mock req/res, and a shared pass/fail checker), since
the first three tests each hand-wrote the same boilerplate independently.
Then converted the highest-value manually-curl-tested scenarios from this
session's migrations into permanent tests:

- **`tests/auth/rate_limiting_and_lockout.test.js`** (13 checks) — dev_code
  gating, resend cooldown, 5-attempt lockout (correct code rejected on
  attempt 6), full login→logout→token-revoked flow.
- **`tests/authorization/ownership_checks.test.js`** (11 checks) — the
  exact bug class the original security audit targeted: cross-user
  access blocked across vehicles, station chargers, and queue state, plus
  confirming `listChargers`'s deliberate public-no-auth exception still
  holds.
- **`tests/marketplace/stock_and_payment.test.js`** (11 checks) — role
  gating, exact charge/points/stock-decrement correctness, over-stock and
  insufficient-balance rejections, cross-user product-edit rejection.
- **`tests/holds/lifecycle.test.js`** (9 checks) — duplicate-hold
  blocking, cross-user cancel rejection, and the lazy-expiry semantics
  specifically (a hold can say `status='active'` long after `hold_until`
  has passed; proved by manually backdating a hold and confirming both a
  new hold is allowed and `myHolds` reports it as `expired`, not the
  stale DB value).

Added `tests/run-all.js` — a dependency-free runner (this project has no
test framework and no root `package.json`) that finds every `*.test.js`
file, runs each as its own process for a clean DB/require-cache, and
prints a pass/fail summary. All 7 tests pass via the runner.

Also corrected `tests/README.md`, which still referenced the retired
`src/routes/mechanics.js` / `src/routes/sessions.js` paths from before
the clean-architecture migration — rewritten to describe all 7 tests, the
shared harness, and the runner, with paths pointing at the actual current
files.

**Test count: 3 → 7. Total assertions across the suite: 44.** Still not
comprehensive coverage of every endpoint — it's coverage of the specific
things that have actually broken or were flagged as risk in this
project's history, which is a deliberately different (and more
defensible) goal than chasing a coverage percentage.
