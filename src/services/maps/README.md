# EVMOS Map Service Layer

A provider-abstraction layer for external map/geo APIs. Nothing else in
the codebase should call Google or Mapbox directly — everything goes
through `mapService.js`, so switching providers later only touches two
files instead of every place that needed geocoding.

## Why this exists

Before this, `RoutePlannerScreen` and `RegisterStationScreen` made
drivers and station owners type raw latitude/longitude by hand — there
was no address search or geocoding anywhere in the app. This layer is the
backend half of fixing that. See `DEFERRED_BACKLOG.md` for the tracked
items this unblocks.

## Two providers, both real, neither tested live

Both `googleProvider.js` and `mapboxProvider.js` implement real geocoding
and place search against each vendor's actual documented API contract.
**Neither has been tested against a live API** — no network access, no
real keys, in this sandbox. That's a standing limitation, not hidden.
What *is* tested and confirmed working: provider routing (proven by each
provider returning its own distinct "not configured" message), graceful
degradation (never a fabricated coordinate), an invalid provider name
falling back to the default instead of crashing, and the compare endpoint
running both sides independently. See the live curl tests in
`PHASE2_PROGRESS.md`.

## Why two providers

Google has stronger place/business search data in most markets, largely
from Google Business Profile listings. Mapbox is meaningfully cheaper at
scale and has a far more generous free geocoding tier (100k/month vs.
Google's 10k/month, as of when this was built). Neither of those facts is
a verified statement about Abuja specifically — regional data quality
varies and deserves an actual test, not an assumption from global
benchmarks. That's what the compare endpoint below is for.

## How to configure each provider

**Google:**
1. Get a key: https://console.cloud.google.com/google/maps-apis — enable
   the **Geocoding API** and **Places API**. Billing must be enabled even
   for free-tier usage; set a budget alert before this sees real traffic.
2. `export GOOGLE_MAPS_API_KEY="your-real-key-here"`

**Mapbox:**
1. Get a token: https://account.mapbox.com/access-tokens/ — a default
   public token works for geocoding; no separate API enablement step like
   Google requires.
2. `export MAPBOX_ACCESS_TOKEN="your-real-token-here"`

Restart the backend after setting either. No code changes needed either
way — `config.js` picks both up automatically.

**Never commit a real API key or token to this repo or hardcode one in
any file.** Environment variables only.

## A/B testing both providers against real Abuja addresses

This is the actual reason both providers exist. Once both keys are set:

```bash
curl "http://localhost:4000/maps/geocode/compare?address=YOUR_ADDRESS" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

Returns both results side by side in one call:
```json
{
  "address": "...",
  "google": { "found": true, "lat": ..., "lng": ..., "formatted_address": "..." },
  "mapbox": { "found": true, "lat": ..., "lng": ..., "formatted_address": "..." }
}
```

Run this against ~30–50 real Abuja addresses and known landmarks before
committing to one provider for production. Compare hit rate (`found`)
and how close `formatted_address` actually matches the real place — that
tells you more about which provider fits Abuja than any global pricing
comparison does.

You can also force a single provider on the regular endpoints with
`?provider=mapbox` (default is `google` if omitted or unrecognized).

## What's NOT built here

- **Interactive map rendering / custom styling (Mapbox)**: this is a
  client-side SDK decision (e.g. `@rnmapbox/maps` in the mobile apps),
  not a backend concern. All three mobile apps currently use
  `react-native-maps` against the device's native map provider — nothing
  here changes that. See `providers/mapboxProvider.js`'s
  `getStaticMapImageUrl` for the one genuinely server-side Mapbox
  rendering use case that's implemented but not yet called from anywhere.
- **Turn-by-turn navigation**: already solved, cheaply — `StationDetailScreen`
  and `ActiveJobScreen` hand off to the device's native Maps app via deep
  link. A dedicated navigation SDK is only worth adding if EVMOS wants
  turn-by-turn rendered *inside* the app itself, which isn't currently a
  requirement.
- **Directions/road routing**: still the straight-line estimate approach
  in `/route/plan` (see `routes/routePlanning.js`'s honesty note). Adding
  real road-network directions is a separate, larger integration than
  geocoding/place search, and isn't part of this layer yet.

## API endpoints

| Endpoint | Purpose |
|---|---|
| `GET /maps/geocode?address=...&provider=` | Address → coordinates. `provider` optional: `google` (default) or `mapbox` |
| `GET /maps/geocode/compare?address=...` | **A/B test** — both providers, one call |
| `GET /maps/reverse-geocode?lat=&lng=&provider=` | Coordinates → address |
| `GET /maps/places/search?q=&lat=&lng=&provider=` | Text search, optionally biased to a location |

All require auth (any logged-in user/role) and return
`{ found: false, configured: false, provider: "...", error: "..." }` with
HTTP 501 when that provider's key isn't set, or
`{ found: false, error: "..." }` with HTTP 422/400 for bad input — never
a fabricated result.
