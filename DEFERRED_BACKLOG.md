# EVMOS — Deferred Items Backlog

**Purpose:** A living record of everything we've knowingly deferred, across
engineering, product, and business workstreams. Nothing here is broken or
forgotten — it's scoped out on purpose so a usable Phase 1 prototype ships
faster. **Revisit this list once the Phase 1 prototype is usable end-to-end.**

Each item notes *why* it was deferred and *where* it's picked back up, so
nothing gets rebuilt from scratch or re-litigated later.

---

## Engineering

| Item | Deferred from | Revisit when | Why deferred |
|---|---|---|---|
| PostgreSQL + PostGIS (replacing SQLite) | Phase 1 backend | Before real user load / multi-instance scaling | SQLite + `node:sqlite` needed zero setup to get a runnable backend fast; fine for local dev and early demo, not for concurrent production load |
| Redis + WebSocket live queue push | Phase 1 backend | Before real concurrent station usage | Polling `/queue/:charger_id` is an acceptable stand-in until there are enough simultaneous users for a 3-second propagation target to matter |
| Real SMS/OTP delivery (Termii / Africa's Talking) | Phase 1 backend | Before onboarding real users outside the founder/test group | OTP code is currently returned directly in the API response for testability; must be swapped before anyone but the team touches the app |
| NestJS migration (from hand-rolled router) | Phase 1 backend | When the team/codebase grows past what one generalist can hold in their head | The plain Node router is fine at Phase 1's endpoint count; premature framework overhead isn't worth it yet |
| Real object storage (S3-compatible) for mechanic verification docs | Phase 2 | Before real users upload real documents at any meaningful volume | **Interim solution now live**: mechanic documents upload as base64 directly into SQLite (`mechanic_documents` table), capped at ~6MB — works end-to-end without needing cloud storage credentials in this sandbox, but doesn't scale and bloats the DB file. Station photos still have no upload path at all — that part of this item remains fully deferred |
| Real road-network route planning (Directions API integration) | Phase 2 route planning | When a Google/Mapbox Directions API key is available and network access exists | `/route/plan` uses straight-line (haversine) distance and simple geometry to guess which stations sit "on the way," not real road distance or drive time. Flagged in both the API response (`distance_is_straight_line_estimate: true`) and the mobile UI's disclaimer text — never presented as real navigation. Actual turn-by-turn still hands off to native maps, unchanged from Phase 1 |
| Real API keys (Google + Mapbox) + live testing | Map service layer | Before any screen actually uses geocoding/place search | **Both providers now built** (`src/services/maps/`) — real Google Geocoding + Places API and real Mapbox Geocoding v6 + Search Box API integrations, correct endpoint contracts, graceful "not configured" handling and provider routing all confirmed live. Neither tested against a real API (no network access, no keys in this sandbox). A `/maps/geocode/compare` endpoint exists specifically to A/B test both against real Abuja addresses once keys are available — see `src/services/maps/README.md` |
| Mobile UI for address search | Map service layer | Once a provider is chosen via the A/B test above | Route Planner and Register Station still take raw lat/lng entry — the backend can now geocode, but no screen calls it yet. Wait for the provider decision before building this, so it isn't built twice |
| Mapbox client SDK for interactive map rendering | Map service layer | If/when in-app custom map styling becomes a priority | All three mobile apps currently use `react-native-maps` (native device map), not Mapbox. This is a separate, larger decision (SDK choice, styling, bundle size impact) than the geocoding/places work — deliberately not bundled into the same change |
| Rate limiting / fuller input sanitization | Phase 1 backend | Before public launch | Acceptable risk for a closed pilot group, not for open signups |
| Driver App: map view polish (clustering, custom pins) | Phase 1 mobile | Phase 2, once station density is high enough that a list view gets crowded | List-first view is faster to ship and sufficient for the first ~20 stations |
| Push notifications (mechanic dispatch, queue updates) | Phase 1 mobile | Phase 2 | Requires additional native setup (Expo push tokens, backend integration); in-app polling covers the pilot's needs |
| Offline-first caching beyond "last known list" | Phase 1 mobile | Phase 2, once real usage shows how often connectivity actually drops | Basic local cache is enough to avoid a blank screen; a full offline sync layer isn't justified yet |
| Automated testing suite (unit/integration) | Phase 1 backend + mobile | Before Phase 2 payments work begins | Manual end-to-end testing was sufficient to validate the Phase 1 core loop; payments-handling code in Phase 2 should not go in without real test coverage |
| Single codebase for Driver App + Station Portal (role-gated) | Phase 1 mobile | Before Phase 2, or once maintaining two codebases becomes costly | Built as two separate Expo projects for speed of independent testing; both share identical `api/`, `context/`, `theme.js` structure specifically to make a future merge low-friction |
| Real payment gateway integration (Paystack/Flutterwave) | Phase 2 wallet | Before any real money moves through the app | Wallet top-up is currently simulated (credits instantly, no real charge) so wallet/transaction logic could be built and tested now; needs real API keys and a webhook handler, neither possible in this sandbox |
| Explicit transactions for coupon usage-cap enforcement | Phase 2 coupons | Before moving off SQLite to Postgres with concurrent connections | Read-then-write usage-cap check is safe under SQLite's single-writer model; needs an explicit transaction to close a race-condition window under real concurrent load |
| True reservations (hardware-enforced) | Phase 2 (reframed as "heads-up hold" instead) | If/when EVMOS gains any station-level enforcement capability — IoT-connected chargers, or station staff willing to physically honor holds | A real reservation requires the ability to actually lock a charger, which an asset-light platform with no hardware integration cannot do. Building it as if it were guaranteed would let the app make a promise the physical world can break. Rebuilt instead as a soft, in-app-only "heads-up hold" that coordinates EVMOS's own driver traffic — explicitly and repeatedly labeled as non-guaranteed in both API responses and UI copy, never called a "reservation" anywhere |
| Admin tool for mechanic verification | Phase 1 mobile (Mechanic App) | Once manually running raw DB updates to verify mechanics becomes impractical (more than a handful) | Phase 1 vetting is manual by design; a raw database update is fine for the first 5 mechanics, not a real workflow |
| CI/CD pipeline | Phase 1 | Before onboarding a second engineer | Not needed while one person is the only one pushing code |

## Product

| Item | Deferred from | Revisit when | Why deferred |
|---|---|---|---|
| Wallet & in-app payments | Master doc / roadmap | Phase 2 | **In progress** — backend wallet + transaction ledger built and tested (see `PHASE2_PROGRESS.md`); real Paystack/Flutterwave integration and payment webhook still deferred (see Engineering section above) |
| Reservations | Master doc / roadmap | Phase 2 | Adds complexity (slot-holding, expiry logic) not needed to prove core demand |
| Route planning (EV-aware, multi-stop) | Master doc / roadmap | Phase 2 | Navigation handoff to Google/Apple Maps is sufficient for Phase 1 |
| Community reviews (stations & mechanics) | Master doc / roadmap | Phase 2 | Needs a critical mass of usage to be meaningful; empty review sections look worse than no reviews |
| AI-optimized recommendations | Master doc / roadmap | Phase 2 beta, full version Phase 3 | Needs `ai_recommendation_logs` data that only starts accumulating once Phase 1 is live |
| Pricing, coupon & loyalty engine | Master doc / roadmap | Phase 2 | Depends on the payments layer existing first |
| EV-specific marketplace | Master doc / roadmap | Phase 2 | Not core to proving the charging-discovery loop |
| Station Portal: analytics dashboard, featured listings | Master doc / roadmap | Phase 2 | Station owners need basic tools first, growth tools second |
| Mechanic tiering (Certified vs. general) & ratings | Master doc / roadmap | Phase 2 | Manual vetting is enough for the first 5 mechanics; formal tiering needs more mechanics to be meaningful |
| Fleet Dashboard (full B2B product) | Master doc / roadmap | Phase 3 | Needs Phase 1–2 usage data and a proven core loop before fleets will trust it |
| API Platform (external partner integrations) | Master doc / roadmap | Phase 3 | Nobody integrates against an unproven API — needs Phase 1–2 credibility first |
| Emergency mobile charging dispatch | Master doc / roadmap | Phase 3 | Shares infrastructure with the Mechanic Line; build once that pattern is proven |
| Multi-language / localization beyond English (Nigeria) | Phase 1 build spec | Post-Phase 1, if expanding beyond Abuja's primary user base | Not needed for the initial Abuja pilot |
| Long-term expansion (motorcycles, buses, battery swap, V2G, smart grid) | Master doc | Phase 4+ | Explicitly the long-term vision, not near-term scope |

## Business

| Item | Deferred from | Revisit when | Why deferred |
|---|---|---|---|
| Seed round amount / specific ask figure | Pitch deck | Before actively fundraising | Use-of-funds categories are drafted; the number depends on runway decisions not yet made |
| Company registration (CAC), legal entity setup | Execution pathway (Stage 2) | Before collecting real payments or signing any partner agreement | Doesn't block building/testing the prototype; does block real money or contracts |
| NDPR compliance review (formal) | Phase 1 build spec | Before collecting real user data at scale | Data handling is designed NDPR-aligned from day one, but a formal review hasn't happened yet |
| Legal agreements (station partner terms, mechanic terms) | Outreach stage | Before onboarding real stations/mechanics beyond a handful of trusted pilots | Informal agreements are fine for a small, relationship-based pilot group |
| Formal fundraising outreach / investor conversations | Pitch deck delivery | Once Phase 1 has real usage data to show | A pitch deck with no traction data is a weaker fundraising position than one with even 2–4 weeks of real Abuja usage |
| Paid marketing / driver acquisition spend | Outreach stage | Phase 2, once the app can handle more than a manually onboarded pilot group | Manual outreach is deliberately the Phase 1 growth channel |
| Third-party advertising inventory | Master doc / revenue streams | Phase 3, once driver base has real scale | Self-serve station featured listings come first; third-party ads need an audience to sell against |

---

*Update this file as new scope decisions get made — anything intentionally cut from a build spec, roadmap conversation, or scope discussion belongs here rather than getting lost.*
