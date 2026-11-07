# EVMOS — Backend & Mobile Apps

This is a **working, runnable** backend plus three Expo/React Native
apps for the EV Mobility Operating System described in
`EVMOS_Master_Document.docx`. Started as a Phase 1 scaffold; Phase 1 and
Phase 2 are both now functionally complete (backend + mobile, every
feature live-tested) — see `PROGRESS.md` for Phase 1 and
`PHASE2_PROGRESS.md` for Phase 2, and read the "Suggested next step" at
the bottom of each before assuming "complete" means "done."

The backend runs with zero external dependencies, just Node.js.

It is a **starting scaffold to build on, not the final production stack.**
See "Path to Production" below for what changes before real users touch it.

## Run it

Requires Node.js 22+ (uses the built-in `node:sqlite` module).

```bash
node src/server.js
```

Server starts on `http://localhost:4000`. Check it's alive:

```bash
curl http://localhost:4000/health
```

A SQLite file (`evmos.db`) is created automatically on first run — delete
it any time to reset all data.

## Try the core loop

1. **Station owner onboarding**
   ```bash
   curl -X POST localhost:4000/auth/otp/request -H "Content-Type: application/json" \
     -d '{"phone":"+2348010000001"}'
   # -> returns { dev_code: "123456", ... } — normally sent via SMS

   curl -X POST localhost:4000/auth/otp/verify -H "Content-Type: application/json" \
     -d '{"phone":"+2348010000001","code":"123456","name":"Chidi Motors","role":"station_owner"}'
   # -> returns { token, user } — use the token as a Bearer token below
   ```

2. **Register + activate a station**
   ```bash
   curl -X POST localhost:4000/stations -H "Content-Type: application/json" \
     -H "Authorization: Bearer <token>" \
     -d '{"name":"Chidi Motors Charging Bay","lat":9.0765,"lng":7.3986,"address":"Wuse 2, Abuja"}'

   curl -X POST localhost:4000/stations/<station_id>/chargers -H "Content-Type: application/json" \
     -H "Authorization: Bearer <token>" \
     -d '{"connector_type":"Type2","price_per_kwh":225}'

   curl -X POST localhost:4000/stations/<station_id>/activate -H "Authorization: Bearer <token>"
   ```

3. **Driver finds it**
   ```bash
   curl "localhost:4000/stations/nearby?lat=9.0700&lng=7.4000&radius_km=10"
   ```

Full endpoint list is in the build spec. Every route below `src/routes/`
maps 1:1 to an endpoint in that document.

## Project structure

```
evmos-phase1/
  src/
    db.js              # schema + SQLite bootstrap
    server.js           # router — maps HTTP routes to handlers
    lib/
      util.js           # JSON helpers, id generation, haversine distance
      auth.js            # bearer-token lookup
    routes/
      auth.js            # OTP request/verify
      vehicles.js         # vehicle registration
      stations.js         # station + charger CRUD, nearby search
      queue.js            # live queue wait-time state
      sessions.js          # charging session history logging
      mechanics.js          # mechanic registration + service-request dispatch
```

## Path to production

This scaffold intentionally cuts corners that are fine for local dev/demo
but need to change before real users and real money are involved — each is
flagged with a `PRODUCTION NOTE` comment at the relevant spot in the code:

| Cut corner here | Production replacement (per build spec) |
|---|---|
| `node:sqlite` | PostgreSQL + PostGIS |
| Haversine scan in JS | PostGIS `ST_DWithin` spatial index |
| Queue state polled from SQLite | Redis + WebSocket push (~3s propagation) |
| OTP code returned in the API response | Real SMS delivery via Termii / Africa's Talking |
| Opaque bearer token in a DB table | Fine to keep, but add expiry + refresh handling |
| Hand-rolled router | NestJS (or similar) once the team and codebase grow |
| No rate limiting / input sanitation beyond basic checks | Add before public launch |

## What's NOT built yet (by design)

Per the Phase 1 scope in the build spec: no payments, no reservations, no
AI recommendations, no marketplace, no Fleet Dashboard. Those are Phase 2/3.
Building them now would be scope creep against the roadmap.

See `PROGRESS.md` for the live task tracker against the Phase 1 Definition
of Done checklist, and `DEFERRED_BACKLOG.md` for everything intentionally
scoped out for now — across engineering, product, and business.

## Mobile apps

- **Driver App** (Expo/React Native) — `mobile/`. OTP login, vehicle
  registration, Find Chargers (core), Station Detail, Charging History.
- **Station Portal** (Expo/React Native) — `station-portal/`. OTP login,
  My Stations, Register Station, Manage Chargers + Queue Dashboard
  (combined), Basic Payment Log.
- **Mechanic App** (Expo/React Native) — `mechanic-app/`. OTP login,
  Registration, Verification Pending, Incoming Requests (core), Active Job.

All three are separate Expo projects sharing the same backend and brand
theme — see each app's own README for setup, and `DEFERRED_BACKLOG.md` for
why they're separate rather than one role-gated codebase.

**None of the three apps have been run as actual apps** — the backend was
built and tested live (see above), but this sandbox has no network access
or simulator to run React Native. Every API call each app makes was
individually curl-tested against the live backend and confirmed working;
the app code itself is syntax-checked and logic-reviewed but not
device-tested. Run them for real before treating any of this as demo-ready
— see `PROGRESS.md` for the exact next step.
