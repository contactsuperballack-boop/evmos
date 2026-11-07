# EVMOS Phase 2 — Progress Tracker

Tracked against `EVMOS_Phase2_Build_Spec.docx`. Same discipline as Phase 1's
`PROGRESS.md`: build a slice, test it live against the real backend, log
what's done vs. outstanding — no slice marked done without a live test to
back it up.

**Context:** Phase 2 work started before the Phase 1 mobile loop was
confirmed end-to-end (an informed, explicit choice — see the risk flag in
`PROGRESS.md`). Worth keeping in mind if a Phase 1 bug surfaces later that
touches anything Phase 2 now depends on.

## Slice 1: Wallet system (foundational) — DONE

The foundational piece everything else in Phase 2 depends on: marketplace
orders, mechanic payments, and coupon/loyalty redemption all need a wallet
to exist first.

- [x] `wallets` + `transactions` tables added to schema
- [x] `GET /wallet` — balance + last 50 transactions, auto-creates wallet
      on first access
- [x] `POST /wallet/topup` — **simulated** top-up (see below)
- [x] Charging session payment wired in: `PATCH /sessions/:id` (end
      session) now debits the wallet using `kwh_estimate × price_per_kwh`
- [x] Insufficient-balance path handled correctly: session still ends
      (driver isn't stuck), flagged `payment_status: insufficient_balance`,
      **no partial or incorrect debit** — verified live
- [x] Live-tested: top-up → successful payment → balance updates
      correctly → insufficient-balance case → balance correctly
      unchanged. All confirmed via curl against the running backend.

### Explicitly simulated — not real money yet

`POST /wallet/topup` credits the wallet immediately with **no real payment
gateway involved**. This is intentional scaffolding (see the
`PRODUCTION NOTE` in `src/routes/wallet.js`), not an oversight. Before any
real money moves through this:

1. Replace the immediate credit with a real Paystack/Flutterwave charge
   request (needs real API keys — can't be done in this sandbox, no
   network access)
2. Implement `POST /payments/webhook` to verify the provider's signature
   and only credit on confirmed success
3. Add idempotency handling on the provider's transaction reference so a
   retried webhook can't double-credit

This is now tracked as its own line in `DEFERRED_BACKLOG.md`.

## Slice 2: Driver App Wallet screen — DONE

- [x] Balance card + top-up modal (preset amounts + custom) +
      transaction history list
- [x] Wired to `GET /wallet` and `POST /wallet/topup`
- [x] Entry point added to Find Chargers header (alongside the existing
      "Need a mechanic?" link)
- [x] Full verification pass: bracket-balance check, every nav target
      cross-referenced against registered screens, every `api.X()` call
      cross-referenced against client exports — all clean
- [x] The exact two calls this screen makes (`GET /wallet`,
      `POST /wallet/topup`) re-confirmed live against the running backend
      after the edit
- [ ] Not yet run as an actual app — same standing caveat as every other
      screen in both phases; static + backend verification only

## Slice 3: Coupon & Loyalty engine — DONE

- [x] `coupons`, `coupon_redemptions`, `loyalty_accounts`, `loyalty_ledger`
      tables added to schema
- [x] `POST /coupons` — create (percentage or fixed, optional usage cap,
      expiry, scope: charging/marketplace/mechanic/all)
- [x] `GET /coupons/mine` — creator's own coupons
- [x] `POST /coupons/validate` — eligibility preview, used by both the
      standalone check and the actual redemption path (same function,
      can't drift between "looks eligible" and "actually eligible")
- [x] Coupon redemption wired directly into `PATCH /sessions/:id` (end
      session) — discount applied before the wallet charge, not after
- [x] `GET /loyalty/account` — points balance, tier, ledger, and points
      needed for next tier
- [x] Points awarded automatically on every successful charge payment
      (1 point per ₦100 actually paid, i.e. post-discount)
- [x] Live-tested end to end: coupon creation → validation → redemption
      during a real payment → correct discount math → correct wallet debit
      → correct points awarded → next-tier calculation
- [x] Edge cases specifically tested, not just assumed: reusing an
      already-redeemed coupon (correctly rejected, falls back to full
      price rather than failing checkout), scope mismatch (mechanic-only
      coupon correctly rejected for a charging scope check), duplicate
      coupon code (correctly 409s)
- [ ] Not yet run as an actual app — mobile UI for coupon entry / loyalty
      display doesn't exist yet (next slice)

### Simplification logged, not hidden

Coupon usage-cap enforcement uses the same read-then-write pattern as the
rest of this codebase. Noted directly in `coupons.js`: this is safe under
SQLite's single-writer model but would need an explicit transaction to
close a race-condition window once this runs on Postgres with concurrent
connections. Added to `DEFERRED_BACKLOG.md`.

## Slice 4: Mobile screens for Wallet, Coupons & Loyalty — DONE

- [x] `LoyaltyScreen` — points balance, tier badge, progress to next tier,
      earn-rate explainer, ledger history
- [x] `WalletScreen` linked to `LoyaltyScreen` ("View loyalty points →")
- [x] Full verification pass (bracket-balance, nav targets, API
      cross-reference) — clean
- [x] Live-tested the exact calls both new/changed screens make against
      the running backend

### Real bug found and fixed while wiring this up

Reviewing `StationDetailScreen` before adding the coupon field, found that
**"End charging" never sent a `kWh` amount at all** — it called
`api.endSession(token, activeSession.id)` with nothing else. Since the
backend only processes payment when `kwh_estimate` is present, this meant
Slice 1–3's entire payment/discount/points logic — built and live-tested
correctly — had **no way to actually trigger from the app**. The screen
still carried Phase 1-era copy ("in-app payment arrives in Phase 2") that
was now stale too.

Fixed: "End charging" now opens a modal asking for kWh charged and an
optional coupon code, calls the (also-fixed) `endSession` client method
with both, and shows a real result — amount charged, coupon savings if
any, points earned, or a clear "top up to settle" path if the wallet
balance was too low. Re-tested live after the fix.

This is the same category of issue as the missing `RequestMechanicScreen`
found earlier in Phase 1: backend logic can be fully correct and fully
tested, and still be functionally unreachable if nothing in the UI
actually calls it. Worth specifically checking for on every future slice:
after building a backend feature, grep for whether any screen actually
calls it with the right arguments — not just whether the client function
exists.

## Slice 5: "Heads-up hold" — reframed from Reservations — DONE (backend)

Not built as originally scoped. Discussed with the founder first because
building a literal "reservation" would have overpromised something EVMOS
structurally cannot deliver: EVMOS doesn't own or control any charger, and
there's no IoT/hardware integration to physically lock one. A walk-up
customer who never opened the app can't be stopped by anything in this
system. Rebuilt as a soft, in-app-only hold instead, explicitly never
called a "reservation" anywhere in code, API responses, or copy — every
hold response includes a plain disclaimer stating exactly what it can't do.

- [x] `holds` table: driver, charger, expiry, status
      (active/fulfilled/expired/cancelled)
- [x] `POST /holds` — create a hold, capped at 20 minutes regardless of
      what's requested, default 15
- [x] Only one active hold per charger at a time (coordinates EVMOS's own
      driver traffic against itself — the actual value this feature can
      honestly deliver)
- [x] `GET /holds/mine`, `PATCH /holds/:id/cancel`
- [x] Hold visibility wired into `GET /stations/nearby` — a driver sees
      an active hold on a charger *before* choosing it, which is the
      point of the whole feature
- [x] Auto-fulfillment: starting a session on a charger you hold marks
      the hold `fulfilled` automatically
- [x] Expiry computed dynamically from `hold_until` vs. current time,
      not a background job — kept consistent with this repo's existing
      simplicity level
- [x] Live-tested the full lifecycle: create → second driver correctly
      blocked with a clear message → visible in nearby search → duration
      cap enforced (60 min requested, capped to 20) → cancel → charger
      free again for another driver → starting a session correctly
      auto-fulfills the driver's own hold
- [ ] Mobile UI not built yet — this slice is backend only

## Slice 6: Mobile UI for Heads-up holds — DONE

- [x] `StationDetailScreen`: "Heads-up hold (15 min)" button per charger,
      disabled when someone else already holds it or a session is active;
      shows a badge either way ("another driver holds this until X" / "you
      hold this"); confirmation alert repeats the honesty disclaimer, not
      just a generic success message
- [x] `MyHoldsScreen`: list of all holds (active/fulfilled/expired/
      cancelled) with cancel action on active ones; disclaimer shown at
      the top, not buried
- [x] Entry point added to Find Chargers header alongside Wallet and
      "Need a mechanic?" (now three links — added `flexWrap` so it
      doesn't overflow on narrow screens)
- [x] Full verification pass: bracket-balance, every nav target, every
      `api.X()` call cross-referenced — all clean
- [ ] Not yet run as an actual app — standing caveat, same as everything
      else in both phases

## Slice 7: EV Marketplace (backend) — DONE

Scoped narrow on purpose, per the build spec and master doc: EV-specific
consumables only, not a general marketplace, and not an open self-serve
seller platform — `station_owner` accounts (the existing vetted-business
role) can list products rather than building a separate seller
verification system this early.

- [x] `marketplace_products`, `marketplace_orders` tables
- [x] `POST /marketplace/products` — list a product (station_owner only)
- [x] `GET /marketplace/products` — browse, optional category filter
- [x] `GET /marketplace/products/mine` — seller's own listings
- [x] `PATCH /marketplace/products/:id` — update price/stock/status
- [x] `POST /marketplace/orders` — checkout: stock + balance both checked
      *before* either is touched, so a failed payment never leaves stock
      decremented and insufficient stock never reaches the payment step
- [x] `GET /marketplace/orders/mine` — buyer's order history
- [x] Loyalty points awarded on marketplace purchases too (same
      `awardPointsForPayment` used by charging payments — one source of
      truth, not a second copy of the points formula)

### Refactor done first, and re-verified

Before building this, generalized `wallet.js`'s session-specific
`chargeWalletForSession` into a shared `debitWallet(userId, amount, type,
metadata)` used by both charging payments and marketplace orders now.
Rationale: duplicating the debit-and-record logic per feature is exactly
the kind of divergence that caused the `points_earned` bug caught earlier
in Phase 2. **Re-ran the original charging-payment test after the
refactor before building anything new on top of it** — confirmed
byte-for-byte identical behavior (same balance math, same transaction
record) before trusting the shared function with a second caller.

- [x] Live-tested end to end: unauthorized listing attempt correctly
      403s; successful listing and browse; a purchase that exceeds wallet
      balance correctly fails with stock left untouched; a successful
      purchase correctly debits wallet, decrements stock, and awards
      points; a subsequent purchase exceeding remaining stock correctly
      fails without attempting payment; order history correct
- [ ] Mobile UI not built yet — next up

## Slice 8: Marketplace mobile UI (Driver App) — DONE

- [x] `MarketplaceScreen` — browse, buy (wallet checkout with clear
      insufficient-balance → top-up path), stock-aware ("Sold out" state)
- [x] `MyOrdersScreen` — purchase history
- [x] Entry point ("Shop") added to Find Chargers header — now four
      links total (Wallet, My Holds, Shop, Need a mechanic), wrapped
      correctly on narrow screens
- [x] Full verification pass — clean

### Navigation bug caught before shipping, not after

Initially set `Marketplace` to `headerShown: false`, copying the pattern
used for `FindChargers`. But `FindChargers` is the stack's root screen —
hiding its header is fine because there's nothing to navigate back to.
`Marketplace` is a *pushed* screen; hiding its header would have removed
the back button entirely, stranding anyone who opened it. Caught by
checking the pattern's actual precondition rather than just copying it,
fixed before testing, not after someone got stuck on the screen.

## Slice 9: Station Portal Analytics & Featured Listings (backend) — DONE

- [x] `featured_listings` table; `transactions.type` constraint extended
      to include `featured_listing`
- [x] `GET /stations/:id/analytics` — total sessions, revenue, kWh
      delivered, peak hour (by session start time), per-charger breakdown;
      owner-only, correctly 403s for a non-owner
- [x] `POST /stations/:id/featured-listing` — self-serve purchase,
      ₦500/day (flagged as a placeholder rate, not researched pricing),
      capped at 30 days regardless of what's requested, paid via the
      shared `debitWallet` function
- [x] Featured stations boosted to the top of `GET /stations/nearby`
      results — sorted first, then by distance within each group, so
      "featured" doesn't mean an irrelevantly far station always wins
- [x] Live-tested: non-owner correctly blocked from analytics; a
      purchase with no wallet balance correctly fails; a real purchase
      correctly debits the wallet; requesting 90 days correctly caps at
      30 (₦15,000, not the ₦45,000 that would've been charged
      uncapped); **confirmed the actual reordering** — a station 23km
      away ranked first over one 0.16km away after being featured, which
      is the entire point of the feature; analytics correctly computed
      real revenue (₦3,600) and kWh (20) from an actual session
- [ ] Mobile UI not built yet — next up

## Slice 10: Station Portal mobile UI for Analytics & Featured Listings — DONE

- [x] `AnalyticsScreen` — sessions, revenue, kWh delivered, peak hour,
      per-charger breakdown, pull-to-refresh
- [x] "Boost this station" card + purchase modal added to
      `StationManageScreen`, with a live price preview as days are typed
- [x] Both wired to the corresponding backend endpoints, insufficient-
      balance case routes to a real "top up now" path rather than a dead
      end

### A real gap found before it could become a dead end

Station Portal had **no wallet screen or wallet client methods at all** —
meaning a station owner would hit "insufficient balance" trying to buy a
featured listing with no way to fix it from inside the app. Same category
of issue as the missing `RequestMechanicScreen` (Phase 1) and the missing
kWh input (Phase 2 Slice 4): backend correct and tested, unreachable from
the UI. Built a Station Portal `WalletScreen` (adapted from the Driver
App's, minus the loyalty link — that program rewards driver spend, not
station owner spend) before wiring the featured-listing purchase to it.

### Dead code found and removed during verification

While cross-checking `api.X()` calls against client exports, found that
Station Portal's client had several Driver-App-only methods
(`createVehicle`, `startSession`, `requestMechanic`, etc.) that no Station
Portal screen used or should ever use — leftover clutter, not a live bug,
but the kind of thing that invites a future mistake (someone assuming
`api.startSession` belongs in this app because it's sitting right there).
Removed. Re-verified the client's exports exactly match what's actually
called afterward.

- [ ] Not yet run as an actual app — standing caveat, same as everything
      else across both phases

## Slice 11: Mechanic Tiering, Ratings & PDF Document Upload — DONE

Two things landed together: the tiering/ratings feature originally
requested, and a fix to a real gap the founder flagged — mechanic
onboarding only accepted a pasted URL as "verification," not an actual
document.

### PDF upload (backend + both apps)

- [x] `mechanic_documents` table storing uploaded files (base64-in-SQLite
      — flagged as an interim step, not final architecture; real object
      storage was already a tracked deferral, this is its first working
      version)
- [x] `POST /mechanics/documents` — upload, capped at ~6MB decoded
- [x] `RegisterMechanicScreen` rewritten: PDF picker
      (`expo-document-picker` + `expo-file-system`) is now the primary
      path; the old URL field is kept as an explicit fallback, not the
      only option
- [x] Own profile (`GET /mechanics/me`) now returns uploaded document
      metadata so a mechanic can see what's on file

### Tiering & ratings (backend + both apps)

- [x] `mechanic_reviews` table; rating aggregation (`ratingSummary`) used
      consistently everywhere a rating is shown — one source of truth,
      not recomputed differently in different places
- [x] `POST /mechanic-reviews` — enforced server-side, not just in the
      UI: must be the requesting driver, job must be `completed`, and a
      DB `UNIQUE` constraint backstops "once per job" even under a race
- [x] `GET /mechanics/:id/reviews` — public review list + average
- [x] Service request status now surfaces mechanic tier + rating to the
      driver once a mechanic is assigned
- [x] `ServiceRequestStatusScreen`: tier badge, rating display, and a
      full star-rating + comment review flow once a job is completed
      (correctly hidden if already reviewed)
- [x] `IncomingRequestsScreen`: mechanic sees their own tier badge and
      rating in the header
- [x] Tier promotion stays a manual/admin operation, not self-serve —
      consistent with the existing manual-verification pattern; a
      mechanic cannot set their own tier via any API

### Bug caught and fixed before it shipped

While adding the review endpoints, a `str_replace` edit orphaned
`updateServiceRequest`'s function body without its signature — the file
still "balanced" on bracket count but was actually broken. **Bracket
counting missed it; `node -c` (Node's real syntax parser) caught it
immediately.** Fixed on the spot, then re-ran `node -c` across every
backend file as a precaution, not just the one that broke.
**Bracket-balance checks are now treated as a first-pass heuristic only —
`node -c` is the actual verification step going forward for every backend
file.**

- [x] Full live test: document upload + metadata readback; review
      correctly rejected before job completion; review correctly
      succeeds once completed; duplicate review correctly rejected;
      rating correctly aggregates into both the public list and the
      mechanic's own profile; tier correctly surfaces to the driver
- [ ] Not yet run as an actual app — standing caveat across both phases

## Slice 12: Route Planning (EV-aware charging-stop suggestion) — DONE

Built honestly within real constraints: no mapping/directions API access
(no network, no API key) in this environment. Rather than fake real road
routing, this computes straight-line distance and simple geometry to
answer a genuinely useful question — "will I need to charge on this trip,
and if so, which station costs me the least detour" — while being
explicit everywhere that it is not real road distance.

- [x] `POST /route/plan` — takes origin, destination, and the driver's
      stated remaining range; returns straight-line trip distance,
      whether a charging stop is likely needed, and up to 5 candidate
      stations ranked by detour (extra distance vs. going direct)
- [x] Candidates filtered to only those actually reachable from the
      origin on the stated range — no point suggesting an unreachable stop
- [x] Response explicitly flags `distance_is_straight_line_estimate: true`
      — the honesty is in the data contract, not just the UI copy
- [x] `RoutePlannerScreen` — origin (current location or manual), 
      destination (coordinates — no geocoding available, flagged clearly
      in-app rather than silently), remaining range input, results with
      tap-through to Station Detail for the real Navigate handoff
- [x] Full verification pass — clean
- [x] Live-tested with a constructed scenario, not just a happy-path
      call: a station genuinely on the route ranked first with ~0 detour;
      a station reachable but genuinely off to the side ranked second
      with a real 2.6km detour penalty; a station beyond the stated range
      was correctly excluded entirely rather than just ranked last;
      confirmed a well-charged trip correctly reports no stop needed;
      confirmed missing required fields correctly 400
- [ ] Not yet run as an actual app — standing caveat

### What this deliberately does not do

No real road routing, no address search/geocoding, no live traffic. All
three logged as explicit deferrals in `DEFERRED_BACKLOG.md` rather than
silently shipped as if they were solved — this is the difference between
an honest MVP feature and a feature that quietly overpromises.

## Slice 13: Map Service Layer (provider abstraction) — DONE (backend, unconfigured)

Requested directly: an abstraction layer for the external map/geo
providers (Mapbox, Google) rather than calling them ad hoc from wherever
needed. Built as `src/services/maps/` — see its own README for full
detail; summary here.

- [x] `mapService.js` — the single entry point the rest of the codebase
      should call; provider-specific code never leaks outside
      `providers/`
- [x] `googleProvider.js` — real Geocoding API + Places Text Search API
      integration, correct endpoint contracts (from documented API
      knowledge, not guessed)
- [x] `mapboxProvider.js` — deliberately minimal; Mapbox's actual role
      here (interactive map rendering) is a client SDK decision, not a
      backend proxy concern, and the file says so rather than pretending
      otherwise. One genuine server-side use case (static map images)
      implemented but not wired in, since nothing needs it yet
- [x] Three endpoints: `GET /maps/geocode`, `GET /maps/reverse-geocode`,
      `GET /maps/places/search`
- [x] **Critical design rule, and the main thing worth remembering about
      this slice**: when a provider isn't configured, these functions
      return a clear "not configured" error — never a fabricated
      coordinate. This build has simulated things elsewhere (OTP codes,
      wallet balances) because faking money in a local dev database is
      harmless. Faking a GPS coordinate is not — it could point a driver
      somewhere wrong. That distinction is enforced in code, not just
      described here.
- [x] Live-tested everything that's actually testable without a real
      key: the "not configured" path returns 501 with a clear message
      (not a crash, not fake data) across all three endpoints; missing
      required params correctly 422; unauthenticated requests correctly
      401 without leaking provider details

### Honestly still not usable

**No real API key exists in this environment, and there's no network
access to test one even if there were.** Every function is written to
match Google's real, documented API contract, but has never actually
talked to Google's servers. `src/services/maps/README.md` has exact setup
steps (get a key, set `GOOGLE_MAPS_API_KEY`, done — no code changes
needed) for whoever picks this up with real credentials. Mobile UI
(replacing raw lat/lng entry with real address search) isn't built yet
either — logged in `DEFERRED_BACKLOG.md`, not forgotten.

### Addendum: Mapbox provider added for A/B testing

Requested directly, after a conversation about whether Google or Mapbox
fits EVMOS's Nigeria-specific use case better — the honest answer was "no
verified data either way for Abuja specifically, test both." So:

- [x] `mapboxProvider.js`: real Mapbox Geocoding API v6 (forward/reverse)
      + Search Box API integration, same "not tested live" caveat as the
      Google provider — consistent honesty, not a double standard
- [x] `mapService.js` reworked to take an explicit `provider` parameter
      (`google` default, or `mapbox`), so both providers are actually
      reachable, not just Mapbox code sitting unused the way the earlier
      static-map-image function did. Same category of mistake this build
      has caught and fixed before (unreachable backend features) — built
      correctly the first time here instead
- [x] New `GET /maps/geocode/compare` endpoint — runs both providers in
      parallel against the same address, returns both results side by
      side, so testing accuracy on real Abuja addresses is one call
      instead of two manual ones
- [x] Live-tested: default routing hits Google; `?provider=mapbox`
      correctly hits Mapbox (proven by each returning its own distinct
      "not configured" message, not a generic one); an unrecognized
      provider name correctly falls back to the default instead of
      crashing; the compare endpoint correctly runs both sides
      independently (one being unconfigured doesn't block the other);
      missing address correctly 400s
- [ ] Still nothing tested against either live API — same standing
      limitation, now true for two providers instead of one

## Slice 14: Community Reviews for Stations — DONE

Completes "Community reviews (stations & mechanics)" from the original
Phase 2 scope — mechanic reviews (Slice 11) plus this closes the item.
Deliberately mirrors the mechanic review design rather than inventing a
different pattern for the same concept.

- [x] `station_reviews` table, tied to a specific completed
      `charging_sessions` row (the station equivalent of a completed
      service request) rather than a free-floating review anyone could
      post
- [x] `POST /station-reviews` — enforced server-side: must be the driver
      who actually had the session, session must actually be ended, `UNIQUE`
      constraint on `session_id` backstops "once per session" under a race
- [x] `GET /stations/:id/reviews` — public review list + average
- [x] Rating rollup wired into **three** places that all needed it
      independently: `GET /stations/nearby` (driver search), `GET
      /stations/mine` (station owner's own view), and `StationDetailScreen`
      (via the same station object passed through navigation)
- [x] `StationDetailScreen`: rating badge near the title; a star-rating +
      comment review prompt fires automatically right after a session
      ends — same "ask while the experience is fresh" pattern as the
      mechanic review flow
- [x] Rating pill added to `FindChargersScreen`'s station cards, so a
      driver sees it while comparing stations, not just after picking one
- [x] Station Portal's `MyStationsScreen` also shows the owner their own
      rating — the data was already flowing to that endpoint, so this
      was a small, low-risk addition worth doing in the same pass
- [x] Live-tested the full enforcement chain: reviewing a nonexistent
      session correctly 404s; reviewing a session that's still in
      progress (not yet ended) correctly rejected; reviewing after
      completion succeeds; reviewing the same session twice correctly
      rejected; rating correctly rolls up into nearby search *and* the
      owner's own station list
- [x] Traced the exact id returned from `PATCH /sessions/:id` (end
      session) through to what the mobile review modal uses — confirmed
      they match, since this is exactly the kind of "backend correct but
      not actually wired to the right value" mistake found earlier in
      this build (the missing-kWh-input bug). Caught a false alarm in my
      own test script here (a `/bin/sh` vs `bash` string-comparison
      quirk, not a real bug) and verified the real comparison directly
      before concluding it was fine, rather than assuming
- [ ] Not yet run as an actual app — standing caveat across both phases

## Slice 15: AI-Assisted Routing (Beta) — DONE — closes Phase 2 scope

The last item from the original Phase 2 build spec. Built as the spec
actually asked for: a hand-tuned, explainable scoring formula (not a
trained model — there isn't remotely enough usage data yet to justify
one), with manual filters kept visible alongside it, never replaced by
it, exactly per the spec's stated product rule.

- [x] `ai_recommendation_logs` table — the data flywheel every future,
      more-sophisticated version of this feature depends on
- [x] `GET /recommendations/nearby` — scores every available charger
      within radius on a weighted blend of distance/queue/price
      (0.3/0.4/0.3), returns a ranked list with one flagged as the pick,
      plus a justification string
- [x] Every recommendation call is logged; `recordSelection()` links a
      driver's actual charger choice back to their most recent
      recommendation when they start a session — but only if it happened
      within 30 minutes, so a much-later, unrelated choice never gets
      misattributed
- [x] `FindChargersScreen` rebuilt with a filter tab row: **Nearest /
      Cheapest / Shortest Queue / Recommended** — all four always
      present, satisfying the spec's rule that manual filters are never
      replaced by the AI pick. The first three sort already-fetched data
      client-side (no extra API calls); Recommended fetches the scored
      list separately and renders it as a distinct AI-pick card plus a
      ranked list of alternatives
- [x] Rating pill and the AI card both reuse the same honest-language
      pattern established earlier in this build — the Recommended tab
      explicitly says "a suggestion... not a guarantee" in-app, not just
      in code comments

### The one design rule that mattered most here

**The justification text never invents a number.** The original product
vision's illustrative example ("...earn an additional ₦8,000 today")
would require driver income data this platform has no way to know. This
implementation only ever states real, computed deltas — actual queue
minutes, actual km, actual ₦/kWh difference. A modest, true number beats
an impressive, fabricated one. Same principle that shaped the map service
layer's refusal to fake a coordinate.

- [x] Live-tested with a scenario built specifically to prove the scoring
      isn't just "pick the nearest" — a far, cheap, queue-free station
      correctly beat a very close but heavily-queued one, matching a
      hand-calculated expected score before the test ran, not just
      "the code ran without crashing"
- [x] Live-tested the flywheel two ways: confirmed a driver's actual
      choice gets recorded even when they *override* the AI's pick
      (proving this logs real behavior, not just agreement), and
      confirmed a deliberately backdated (45-minute-old) recommendation
      correctly does **not** get credited with a later, unrelated session
- [x] Caught and fixed a bug before it ever ran: an early draft
      referenced a nonexistent `api._token` instead of pulling the token
      from `useAuth()` like every other screen in this app — found by
      reading the code again before testing, not by running it and
      watching it fail
- [ ] Not yet run as an actual app — standing caveat, same as everything
      else across both phases

## Not started yet (Phase 2 build spec scope)

**Nothing.** Every item from the original Phase 2 build spec is now
built: Wallet, Coupon/Loyalty, Heads-up Holds, Marketplace, Station
Portal Analytics/Featured Listings, Mechanic Tiering/Ratings/Document
Upload, Route Planning, Map Service Layer, Community Reviews (mechanics
and stations), and AI-Assisted Routing. See "Suggested next step" below
for what actually has to happen before any of this is real.

## Suggested next step

Phase 2 is functionally complete on paper — everything in the original
build spec exists, backend and mobile, and every single slice was
live-tested against the real running backend, not just written and
assumed correct. That's a real milestone. It is not the same thing as
"done."

**What actually has to happen next, in order:**

1. **Run all three apps for real.** This is still true, unchanged, from
   every prior status update in this file: none of the mobile code —
   across 15 slices now — has ever executed. `npm install` +
   `npx expo install <native packages>` in each of `mobile/`,
   `station-portal/`, `mechanic-app/`, then walk the full loop across
   real devices. This is overdue, not just outstanding.
2. **Get a real Google Maps Platform API key** and confirm the map
   service layer's geocoding/places calls actually work against the live
   API — currently written to spec but never tested against a real
   server.
3. **Decide what to do about two structural things this build
   deliberately left simulated**, both flagged clearly throughout rather
   than hidden: wallet top-ups have no real payment gateway behind them,
   and several mechanic/station documents live as base64 blobs in SQLite
   rather than real object storage. Neither blocks testing the product
   experience; both block charging real money or scaling past a handful
   of users.
4. **Only after (1)** — bugs found running real devices may touch code
   in ways that make revisiting specific slices worthwhile before moving
   to Phase 3.

See `DEFERRED_BACKLOG.md` for the complete, itemized list of what's
intentionally not done yet, across engineering, product, and business —
that list is longer than this summary and worth reading in full before
deciding what's next.
