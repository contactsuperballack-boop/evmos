# EVMOS — Project Handoff

*Last updated: this session. If you're picking this up cold, read this
file first, then `HARDENING_AND_SCOPE.md`, then skim `PROGRESS.md` and
`PHASE2_PROGRESS.md` for the detailed build history. Don't start from the
detailed files — they're logs, not orientation.*

---

## 1. What EVMOS is

An asset-light EV mobility platform for Nigeria (pilot: Abuja). EVMOS
doesn't own chargers or build vehicles — it's the software layer
connecting drivers, charging stations, and (secondarily) roadside
mechanics. Full business context: `EVMOS_Master_Document.docx`.

**Canonical product spec as of this handoff:**
`EVMOS_MVP_Product_Definition_v1.0.docx` (founder-provided, August 2026).
This supersedes earlier scope decisions where they conflict. Four
pillars, in priority order:

| Pillar | Priority |
|---|---|
| CHARGE — discover, compare, navigate to chargers | P0 |
| VEHICLE — vehicle profile drives personalization | P0/P1 |
| ASSIST — roadside/mechanic support | P1, secondary |
| STORE / FOR YOUR VEHICLE — vehicle-specific contextual commerce (reframed from "Marketplace") | P1 |

Navigation should be: **Home/Map, Trips, Assist, For Your Vehicle,
Profile.** Not yet implemented — see Section 5.

---

## 2. Current state, honestly

### What's real and running
A Node.js backend (zero external dependencies, `node:sqlite`) and three
Expo/React Native apps (Driver, Station Portal, Mechanic). The backend
has been started and tested live, repeatedly, throughout this build —
not just written and assumed correct. Every feature slice in
`PHASE2_PROGRESS.md` has a live curl-test transcript.

### What's never been run
**No mobile screen, across either phase, has ever executed on a device or
simulator.** This sandbox has no network access and no simulator. Every
mobile screen has been checked for syntax (bracket-balance, and later
`node -c` where applicable) and had its API calls cross-referenced
against the backend, but "should work" is not "confirmed working." This
is the single most important caveat in this entire handoff — see Section
4.

### What triggered this hardening pass
The founder ran an external audit (two documents) against the built
codebase. It found serious, real P0 vulnerabilities. **I independently
re-verified the critical claims against the actual code before trusting
them** — not just accepted the audit's word — and confirmed 6 of them
directly by reading the real files, plus found one more myself (SQLite
foreign keys never enabled). See `HARDENING_AND_SCOPE.md` for the full
list and fix status.

---

## 3. Key decisions made this session

1. **Adopted the Product Definition v1.0 as canonical**, superseding the
   "build every Phase 2 feature" trajectory of the prior ~20 build
   slices. The founder's own words: *"strategically narrow... a smaller
   number of coherent product pillars... deep, polished functionality."*
2. **Hardening and scope reduction happen together, not sequentially** —
   founder's explicit choice when asked where to start.
3. **"Hide, don't delete"** for de-scoped features (Wallet, Loyalty,
   Coupons, Heads-up Holds, Marketplace/Store, Route Planner). The
   backend logic stays; it's the *prominence* in the UI that changes.
   Nothing built in Phase 2 gets deleted — it gets deprioritized, per the
   audit's own recommendation ("I do not recommend a rewrite").
4. **Route Planner specifically flagged for hiding, not just
   deprioritizing.** The audit's reasoning is sound and adopted as-is:
   presenting straight-line distance as "route planning" for an EV
   product is actively misleading, not just incomplete — a 10km
   straight-line reading could be a very different real driving distance.
   Backend stays (it's honestly labeled internally), UI entry point comes
   out.
5. **Money-as-REAL / kobo migration and full transaction atomicity
   deliberately NOT attempted in this pass.** The audit itself times
   these "before real payments," not "now." Attempting them alongside
   everything else in this pass risked scope explosion across
   wallet/sessions/marketplace/coupons/featured-listings simultaneously.
   Logged as the top item for the *next* pass, not silently dropped.
6. **AI recommendation engine: keep the logic, fix the framing.** The
   audit's assessment is correct and adopted: the weighted scoring
   formula is genuinely good practice for a beta, but should be labeled
   "EVMOS Recommendation Engine — Beta," not implied to be machine
   learning.

---

## 4. Active constraints (true regardless of what gets built next)

- **No network access in the build environment.** Every "live test" in
  this project's history is against the local backend on `localhost`.
  Nothing has touched a real external API (Google Maps, Mapbox, Paystack,
  SMS providers) — those integrations are written to spec but unverified
  against the real services.
- **No simulator/device access.** Mobile code is syntax-checked and
  cross-referenced, never executed. This is the top real risk in the
  project right now — three apps' worth of code has accumulated without
  a single confirmed successful run.
- **SQLite, not PostgreSQL.** Fine for the pilot scale (15–20 stations),
  explicitly not fine past that. Foreign keys aren't even enabled yet
  (see `HARDENING_AND_SCOPE.md`) — that's an immediate fix, separate from
  the full Postgres migration.
- **Wallet is fully simulated.** No Paystack/Flutterwave integration
  exists. Top-ups credit instantly with no real money involved. The
  audit's recommendation to hide this from the UI until real payment
  integration exists is adopted (see decision #3).
- **OTP is simulated.** The code returns the OTP code directly in the
  API response for testability. This must not ship to real users as-is —
  it's on the P0 fix list, not yet done.

---

## 5. Open tasks — in priority order

### Immediate (P0 security — see `HARDENING_AND_SCOPE.md` for full detail)

Done and live-tested this session:
- [x] Negative kWh / financial manipulation
- [x] Duplicate session billing
- [x] Session creation validation (charger exists, station active,
      charger available, one-active-session-per-driver, driver-role-only)

Still open, not yet touched:
- [ ] Service-request authorization (any authenticated user can currently
      mutate any request — this is the most severe *remaining* finding)
- [ ] Nearby mechanic requests fully unauthenticated (exposes stranded
      drivers' location + fault type publicly)
- [ ] Queue update authorization (no station-ownership check)
- [ ] OTP: remove `dev_code` from the response, add rate limiting
- [ ] Session tokens: add expiry + revocation
- [ ] Request body size limit
- [ ] Enable SQLite foreign key enforcement (`PRAGMA foreign_keys = ON`)

### Scope reduction (not started)

- [ ] Driver App navigation restructured to the 5-tab spec (Home/Map,
      Trips, Assist, For Your Vehicle, Profile)
- [ ] Wallet moved out of the Find Chargers header into Profile
- [ ] Route Planner UI entry point removed (backend stays)
- [ ] Heads-up Holds removed from primary nav
- [ ] Marketplace reframed as "For Your Vehicle" pillar, demoted from a
      header link to its own nav tab
- [ ] Station Portal and Mechanic App nav have NOT been reviewed against
      the new spec yet — this handoff only scoped the Driver App

### After the above

- [ ] Real device testing — genuinely overdue, flagged as "Now" priority
      by the audit, not "later"
- [ ] Real Google/Mapbox API key testing (code written, never verified
      live)
- [ ] 15–20 verified real Abuja stations (operational work, not code)
- [ ] Mobile secure token storage (SecureStore vs AsyncStorage) — real,
      scoped fix, good candidate for the next focused pass

---

## 6. Recommendations

1. **Do not add new features until the open P0 list above is empty.**
   The founder's own audit made this point forcefully and it's correct:
   the codebase has more breadth than its foundation currently supports.
2. **Real device testing should happen before finishing the remaining
   security fixes**, not after. If something's broken on a real phone,
   better to find out now than after another round of backend hardening
   that mobile can't even reach yet.
3. **Treat "hide, don't delete" as a real UI/UX task, not a config
   toggle.** Simply removing a header link isn't enough — check every
   screen that navigates *to* a hidden feature (e.g., does anything still
   link to Route Planner?) so nothing becomes an orphaned dead end.
4. **Kobo/integer-currency migration should be scheduled as its own
   focused pass**, not folded into a bigger one. It touches five+ files
   (wallet, sessions, marketplace, coupons, featured listings) and
   deserves the same live-testing rigor as everything else here — rushed
   alongside other work is exactly how a financial bug slips through.
5. **Revisit the AI/recommendation-engine framing across all
   user-facing copy** (mobile screens, any pitch materials) for
   consistency with "Beta" labeling — a quick pass, not a rebuild.

## 7. Optimization add-ons (post-hardening, post-beta — not urgent)

These are genuine value-adds worth keeping in mind, explicitly **not**
recommended before the core hardening + scope reduction + real-device
testing sequence completes:

- Station reliability scoring from real historical uptime, once there's
  real usage data to compute it from
- Redis + WebSocket for live queue state (currently polled from SQLite —
  fine at pilot scale, not at real concurrent load)
- Structured logging / request IDs / error tracking — genuinely needed
  before any real launch, but doesn't block a controlled pilot
- API rate limiting and versioning
- PostGIS spatial indexing once station count grows past what a
  Haversine table-scan comfortably handles
- A real routing/directions integration (Mapbox Directions or Google
  Routes) to eventually make Route Planner honest enough to re-expose

---

## 8. Where to find everything

| Document | Contents |
|---|---|
| `EVMOS_MVP_Product_Definition_v1.0.docx` | Canonical product spec (founder-provided) |
| `HARDENING_AND_SCOPE.md` | This session's security fix + scope reduction tracker, item-by-item |
| `PROGRESS.md` | Phase 1 build history (backend + 3 mobile apps, core loop) |
| `PHASE2_PROGRESS.md` | Phase 2 build history (15 feature slices, all live-tested) |
| `DEFERRED_BACKLOG.md` | Everything intentionally deferred across engineering/product/business, with reasoning |
| `src/services/maps/README.md` | Map provider (Google/Mapbox) setup and A/B testing instructions |
| `mobile/README.md`, `station-portal/README.md`, `mechanic-app/README.md` | Per-app setup instructions |

**If you only read one thing before continuing this project: read
`HARDENING_AND_SCOPE.md`'s open-items list and don't build anything new
until it's empty.**
