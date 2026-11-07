# EVMOS Station Portal — Phase 1 (Expo / React Native)

Implements the Station Portal screens from `EVMOS_Phase1_Build_Spec.docx`.
Shares the same backend as the Driver App (`../mobile`) and the same brand
theme — this is a separate Expo project rather than one role-gated
codebase, which the build spec's long-term architecture calls for (see
`DEFERRED_BACKLOG.md` — noted there as a deferred consolidation item, not
an oversight).

**Same caveat as the Driver App: not run/tested.** The backend calls this
app depends on (`/stations/mine`, `/stations`, `/chargers/:id`,
`/queue/:id`, `/stations/:id/sessions`, `/stations/:id/activate`) were all
individually curl-tested against the live backend and confirmed working
(see the Phase 1 repo's test transcript). The React Native code itself has
been checked for balanced syntax and reviewed logic-by-logic, but hasn't
run on a device — do that before demoing it.

## Screens implemented

| Screen (per build spec) | Status |
|---|---|
| Onboarding / OTP login (role: station_owner) | ✅ |
| My Stations (home — not in spec table, added as the natural landing screen for owners with multiple stations) | ✅ |
| Register Station | ✅ |
| Manage Chargers | ✅ — combined with Queue Dashboard below |
| Queue Dashboard | ✅ — combined into the same screen as Manage Chargers, since both operate on the same charger records (mark available/offline, set wait time) |
| Basic Payment Log | ✅ — required one new backend endpoint (`GET /stations/:id/sessions`), added and tested this session |

## Setup

```bash
cd station-portal
npm install
npx expo install expo-location @react-navigation/native @react-navigation/native-stack react-native-screens react-native-safe-area-context @react-native-async-storage/async-storage
```

Same note as the Driver App: don't hand-install those native-code
packages. Built against **Expo SDK 54** — see `../mobile/README.md`'s
setup section for why, and what to do if a newer SDK is current by the
time you're reading this.

Edit `app.json` and set `expo.extra.apiBaseUrl` to wherever the Phase 1
backend is actually reachable from — **not** left as the
`CHANGE-ME-TO-YOUR-LAN-IP` placeholder, or it silently falls back to
`localhost`, which will not work from Expo Go on a physical phone:
- Simulator on the same machine as the backend: `http://localhost:4000` (iOS
  simulator) — Android emulator needs `http://10.0.2.2:4000` instead.
- Physical phone via Expo Go: use your machine's LAN IP, e.g.
  `http://192.168.1.42:4000`, or a tunnel (ngrok / `expo start --tunnel`).

The app logs a console warning on startup if this is still the placeholder,
so a silent wrong-URL failure is easier to spot.

```bash
npx expo start
```

## Design decision: separate app vs. one role-gated codebase

The build spec's long-term architecture (section 2.1) calls for a single
React Native codebase serving Driver, Station, and Mechanic surfaces,
gated by role at login. This was built as a separate Expo project instead,
for two reasons:

1. **Speed of independent testing** — each app can be run, demoed, and
   iterated on its own without navigation/role-branching complexity.
2. **Clean separation while the product is still finding its shape** —
   easier to change one surface without risking the others.

**This is a deferred consolidation, not a final decision** — see
`DEFERRED_BACKLOG.md`. Before Phase 2, evaluate whether merging into one
codebase (shared `api/`, `context/`, `theme.js` — already structured
identically across both apps to make this merge easy) is worth doing, or
whether keeping them separate turns out to be fine long-term.
