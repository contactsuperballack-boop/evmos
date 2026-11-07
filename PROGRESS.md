# EVMOS Phase 1 — Progress Tracker

Tracked against the Definition of Done checklist in `EVMOS_Phase1_Build_Spec.docx`.
Update this file (or ask me to) as work moves forward — this is the running
source of truth for what's done vs. outstanding.

## Backend API — core loop

- [x] Repo scaffold + data model (`src/db.js`)
- [x] Auth: phone + OTP request/verify, session tokens
- [x] Vehicle registration (create, list)
- [x] Station registration, activation, chargers (create, list, update)
- [x] `/stations/nearby` — geosearch + live queue + pricing, sorted by distance
- [x] Queue state read/update
- [x] Charging session start/end/history logging
- [x] Mechanic registration (manual verification pending state)
- [x] Service-request dispatch: create, nearby-for-mechanic, accept/update
- [x] End-to-end tested locally (station → charger → activate → driver
      search → session → mechanic dispatch), all flows confirmed working

## Mobile client — Driver App (React Native / Expo)

- [x] Project scaffold (`mobile/`), API client, auth context (token
      persisted via AsyncStorage)
- [x] OTP Login screen (phone → code → auto-registers as driver)
- [x] Vehicle Registration screen
- [x] Home gate — routes returning users straight to Find Chargers,
      first-time users to Vehicle Registration
- [x] **Find Chargers screen (core)** — list + map toggle, live distance/
      price/queue per station, pull-to-refresh
- [x] **Station Detail screen (core)** — navigate handoff to native maps,
      start/end charging session against the backend
- [x] Charging History screen
- [x] Request a Mechanic screen (fault type + location submit)
- [x] Service Request Status screen (polls status, shows mechanic once accepted)
- [x] All files checked for balanced syntax; logic reviewed manually
- [ ] **Not yet run/tested** — needs `npm install` + a real device or
      simulator, which this sandbox can't provide (see `mobile/README.md`)

## Backend API — additions for Station Portal

- [x] `GET /stations/mine` — owner's station list
- [x] `GET /stations/:id/sessions` — payment-log reconciliation view
- [x] Both new endpoints curl-tested end to end against the live backend

## Mobile client — Station Portal (React Native / Expo)

- [x] Separate Expo project (`station-portal/`), sharing the same brand
      theme and API client pattern as the Driver App
- [x] OTP Login (role locked to station_owner)
- [x] My Stations (home screen, list + register button)
- [x] Register Station (with "use current location" auto-fill)
- [x] **Manage Chargers + Queue Dashboard (combined)** — add charger,
      toggle available/offline, one-tap wait-time presets, activate station
- [x] Basic Payment Log — session list + totals (sessions, kWh, revenue)
- [x] All files checked for balanced syntax; every backend call the
      screens depend on was individually curl-tested and confirmed working
- [ ] **Not yet run/tested as an actual app** — same caveat as Driver App

## Backend API — additions for Mechanic App

- [x] `GET /mechanics/me` — current user's mechanic profile/status
- [x] `GET /service-requests/mine` — jobs assigned to the current mechanic
- [x] Full flow curl-tested: register → manually verify → nearby request →
      accept → mark complete — all confirmed working

## Mobile client — Mechanic App (React Native / Expo)

- [x] Separate Expo project (`mechanic-app/`), same shared pattern as the
      other two apps
- [x] OTP Login (role locked to mechanic)
- [x] Gate screen — routes to Register / Verification Pending / Incoming
      Requests based on live mechanic status
- [x] Mechanic Registration
- [x] Verification Pending (polls status on refresh/focus)
- [x] **Incoming Requests (core)** — nearby open jobs, accept to claim,
      auto-redirects to Active Job if one is already in progress
- [x] **Active Job (core)** — driver contact, navigate handoff, call
      driver, mark complete
- [x] All files checked for balanced syntax; every backend call reviewed
      and tested via the curl flow above
- [ ] **Not yet run/tested as an actual app** — same caveat as the other two

## Not started yet

All three Phase 1 mobile surfaces (Driver App, Station Portal, Mechanic
App) now exist. Nothing left un-started within Phase 1 scope — see
"Suggested next step" below.
- [ ] Swap SQLite → PostgreSQL + PostGIS
- [ ] Swap in-process queue state → Redis + WebSocket push
- [ ] Real SMS/OTP delivery (Termii / Africa's Talking)
- [ ] Object storage for station photos / mechanic verification docs
- [ ] Deployment: containerize + host (staging environment)
- [ ] Manual onboarding: map & list first 15–20 real Abuja stations
- [ ] Manual onboarding: vet first 5 mechanics

## Definition of Done — launch checklist status

- [x] A driver can register, find a real nearby station, and log a
      charging session — **backend + mobile UI built, untested end-to-end**
- [ ] A station owner can register their station, set pricing, and mark
      queue status in real time — **backend + mobile UI built, untested end-to-end**
- [ ] A driver can request a mechanic and see live status through to
      completion — **backend + mobile UI built (both sides), untested end-to-end**
- [ ] At least 15–20 real Abuja stations onboarded and live before launch
- [ ] At least 5 vetted mechanics onboarded and active
- [ ] App functions on a low-end Android device over 3G without crashing
- [ ] NDPR-aligned data handling reviewed before collecting real user data

## Correction — dependency versions were wrong (found on deeper review)

When asked "are you completely sure Phase 1 is complete," a harder look
surfaced a real issue: all three apps' `package.json` files targeted
**Expo SDK 51**, which is badly out of date — current stable is SDK 56/57,
and Expo Go only supports the latest SDK version. This would have failed
at install or first launch.

Fixed across all three apps:
- Core packages (`expo`, `react`, `react-native`, `expo-status-bar`)
  updated to verified-current **Expo SDK 54** versions (confirmed via web
  search, not memory — SDK 54 is the version Expo's own docs currently
  recommend for Expo Go on physical devices during the SDK 57 transition)
- Native-code packages (react-navigation, react-native-maps, async-storage,
  screens, safe-area-context, expo-location) removed from hardcoded
  versions entirely — the README now instructs `npx expo install <pkg>`
  for these, which resolves SDK-compatible versions automatically instead
  of relying on a guess that goes stale

This is logged here rather than silently fixed because it's a useful data
point: **static review (bracket-balance, logic reading) did not catch
this.** Only checking against current reality did. It's a reminder that
"syntax-checked and logic-reviewed" is a real but limited form of
verification — it doesn't substitute for actually running the app.

## Two more issues found on the same pass — one gap, one real bug

Pushed the review further with a systematic cross-check (every
`navigate()`/`replace()` call against registered screen names, every
`api.X()` call against the client's exports, every `route.params` read
against what was actually passed). Found:

1. **A real gap, not a bug**: the Driver App's API client had a
   `requestMechanic` method that **no screen ever called**. The Mechanic
   App could accept and complete jobs, but drivers had no way to actually
   *create* one — the loop was broken at the source. Fixed: added
   `RequestMechanicScreen` (fault-type picker + location) and
   `ServiceRequestStatusScreen` (polls status, shows mechanic contact once
   accepted), wired into navigation, with a "Need a mechanic?" entry point
   on Find Chargers. This also required a new backend endpoint,
   `GET /service-requests/:id`, which didn't exist — added and tested,
   including an authorization check (a stranger can't view someone else's
   request; confirmed with a live 403 test).

2. **A real routing bug**: adding that new endpoint as
   `GET /service-requests/:id` placed it *before* the existing literal
   route `GET /service-requests/nearby` in the route table. Since routes
   are matched in array order and `nearby` matches the `:id` pattern too,
   this would have silently broken the Mechanic App's "see nearby jobs"
   feature — every request would have been misrouted to "get one job by
   ID," with `nearby` treated as the ID. Caught by re-reading the route
   table after adding the new route, not by any automated check. Fixed by
   reordering; reran the full curl test suite to confirm both endpoints
   work independently after the fix.

Neither of these would have been caught by the earlier "balanced
brackets" pass — both required actually tracing data flow across files,
which is slower but is what "sure" requires.

## Risk flag — Phase 2 started before Phase 1 loop was confirmed end-to-end

All three Phase 1 apps are confirmed to **launch** (Driver App and Station
Portal ran clean on first try; Mechanic App needed its `npx expo install`
step, which was missing, then also ran clean). The full functional loop —
login → register station → driver finds it → request mechanic → accept →
complete — was **not** run before deciding to move to Phase 2.

This was an explicit, informed choice, not an oversight: asked directly,
the answer was "proceed anyway, test later." Flagging it here because
building Phase 2 (wallet, payments, AI routing) on top of an
unconfirmed Phase 1 core loop means any bug found later in that loop could
require rework in whatever Phase 2 code depends on it. Worth running the
full Phase 1 loop test in parallel with Phase 2 development, not
indefinitely deferred.

## Suggested next step

All three Phase 1 surfaces (Driver App, Station Portal, Mechanic App) are
now built against a fully tested backend. **Nothing should be built
further until this is run for real:**

1. `npm install` **and** `npx expo install <native packages>` in each of
   `mobile/`, `station-portal/`, and `mechanic-app/` — see each app's
   README for the exact command; don't skip the `expo install` step
2. Start the backend (`node src/server.js`)
3. Point all three apps' `BASE_URL` at it
4. Run the full loop across (ideally) three devices/simulators: station
   owner registers + activates a station → driver finds it and starts a
   charging session → driver requests a mechanic → mechanic (manually
   verified first, see `mechanic-app/README.md`) accepts and completes

This is the first real test of anything built since the backend's own
curl tests. Bugs found here are expected and cheap to fix now — much
cheaper than discovering them after onboarding real Abuja users.

Once that loop is confirmed working end-to-end: the Phase 1 Definition of
Done checklist's remaining items are non-technical (onboard 15–20 real
stations, vet 5 real mechanics, NDPR review). See `DEFERRED_BACKLOG.md`
for everything else intentionally deferred beyond that.
