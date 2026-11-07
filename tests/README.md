# Tests

This project had zero automated tests until they started getting added
alongside real bugs found in dedicated debugging/migration passes — see
`HARDENING_AND_SCOPE.md` for the full history of each one. All 7 current
tests call controller functions directly (not over real HTTP) with mock
`req`/`res` objects — no test framework or external dependency, matching
this project's own zero-external-dependency backend.

## Running everything

```
node tests/run-all.js
```

Runs every `*.test.js` file found anywhere under `tests/`, each as its
own process (so each gets a clean database and require-cache), and prints
a pass/fail summary. Exits non-zero if anything failed, so it's safe to
wire into a CI step later even though there's no CI in this project yet.

Any test can also be run individually the same way it always could:
```
node tests/concurrency/session_double_billing.test.js
```

Every test deletes and recreates `evmos.db` in the project root before
it runs, so don't run these against a database you care about, and don't
run them while the real dev server is also using `evmos.db`.

## `tests/helpers/testHarness.js`

Shared setup extracted during the Sprint 4 test-coverage expansion, so
new tests don't repeat the same boilerplate the first three tests each
had to write themselves: `resetDb()`, `makeAuthedUser()` (seeds a user
and issues them a real session token — not a fake one, so tests exercise
the actual auth path), `mockReq()`/`mockRes()`, and `makeChecker()` (a
tiny pass/fail tracker so every test prints a consistent summary and sets
`process.exitCode` correctly).

## `tests/concurrency/`

Two tests, each deliberately staggering when a mock request's body
"arrives" to force the exact interleaving a race condition depends on —
necessary because the race window in real network conditions is normally
too small to hit reliably with two curl processes.

- **`service_request_double_accept.test.js`** — two mechanics racing to
  accept the same open service request should result in exactly one
  `200` and one `409`, never two `200`s. Regression here means the
  `readBody()` call in `src/services/serviceRequestsService.js` /
  `src/http/serviceRequestsController.js` has drifted back to running
  after a database read it needs to run before.
- **`session_double_billing.test.js`** — two concurrent "end this
  charging session" calls for the same session should charge the wallet
  exactly once, never twice. Same failure mode, in
  `src/services/sessionsService.js` / `src/http/sessionsController.js`.

(Both call sites moved from `src/routes/mechanics.js` /
`src/routes/sessions.js` during the clean-architecture migration — those
files no longer exist. See the inline comments at the top of each service
file for the full "why the ordering matters" writeup.)

## `tests/performance/`

**`nearby_stations_query_batching.test.js`** — verifies the batched
rewrite of `GET /stations/nearby` (`src/services/stationsService.js`
`listNearby`). Checks correctness (9 assertions: featured-sort order,
review averaging, active-vs-expired hold handling, out-of-range
exclusion) and query count together (instruments `db.prepare`). If this
ever reports more than ~6 calls, a per-row query has crept back in — the
whole point of the rewrite was making query count independent of how
many stations/chargers are in range.

## `tests/auth/`

**`rate_limiting_and_lockout.test.js`** — the OTP hardening behavior:
`dev_code` hidden by default, resend cooldown, 5-wrong-attempts lockout
(the *correct* code is rejected on the 6th attempt once locked out), and
that `logout` actually revokes a token server-side rather than just
looking like it worked. 13 checks.

## `tests/authorization/`

**`ownership_checks.test.js`** — the exact bug class the original
security audit was about: cross-user access to vehicles, station
chargers, and queue state. Covers the one deliberately-public exception
too (`listChargers` requires no auth at all, by design). 11 checks.

## `tests/marketplace/`

**`stock_and_payment.test.js`** — checkout correctness: role-gated
product listing, stock decrementing correctly, the exact total charged
and exact loyalty points awarded, a correctly-rejected over-stock order,
a correctly-rejected insufficient-balance order, and cross-user product
edits blocked. 11 checks.

## `tests/holds/`

**`lifecycle.test.js`** — the "heads-up hold" feature: duplicate-hold
blocking (including a driver trying to double-hold their own charger),
cross-user cancellation blocked, and the lazy-expiry semantics — a hold
can say `status='active'` in the database long after `hold_until` has
passed, since nothing proactively expires it; every read path is
supposed to check the timestamp, not trust the stored status, and this
test proves that with a manually-backdated hold. 9 checks.
