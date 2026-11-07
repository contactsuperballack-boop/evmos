# EVMOS Driver App — Phase 1 (Expo / React Native)

Implements the three core Driver App screens from `EVMOS_Phase1_Build_Spec.docx`,
plus Vehicle Registration and Charging History since they were cheap to add
alongside the core flow.

**Important — unlike the backend, this has not been run/tested.** The backend
runs with zero dependencies in this sandbox (`node:sqlite`), but React Native
needs a real device/simulator and `npm install` of native packages, which
this environment can't do (no network access, no simulator). Every file has
been checked for balanced syntax and reviewed logic-by-logic, but **run it
yourself before trusting it** — see below.

## Screens implemented

| Screen | Status |
|---|---|
| OTP Login (phone + code, role auto-set to driver) | ✅ |
| Vehicle Registration | ✅ |
| Find Chargers (list + map toggle, live queue/pricing) | ✅ — core screen |
| Station Detail (navigate handoff, start/end charging) | ✅ — core screen |
| Charging History | ✅ |
| Request a Mechanic | ✅ — added after review found it was missing; see `PROGRESS.md`'s "Correction" section |
| Service Request Status | ✅ — same |

Not built yet: reservations, wallet, route planning, AI recommendations,
marketplace, mechanic request UI (backend supports it — see `DEFERRED_BACKLOG.md`).

## Setup

```bash
cd mobile
npm install
npx expo install expo-location react-native-maps @react-navigation/native @react-navigation/native-stack react-native-screens react-native-safe-area-context @react-native-async-storage/async-storage
```

The second command matters — don't `npm install` those packages by hand.
They contain native code, and `npx expo install` resolves the exact
versions compatible with this project's Expo SDK automatically. This repo
was built against **Expo SDK 54** (the version currently recommended for
Expo Go on physical devices, per Expo's docs — SDK 57 was mid-rollout at
the time of writing). If a newer SDK is current when you read this, run
`npx expo install expo@latest --fix` first and let Expo reconcile
everything, rather than assuming these versions are still right.

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

Then:

```bash
npx expo start
```

Scan the QR code with Expo Go (iOS/Android) or press `i`/`a` for a simulator.

## Before this is demo-ready

- [ ] `npm install` and confirm it actually builds — first real test
- [ ] Point `BASE_URL` at a running backend and confirm login → find →
      station detail → start/end session works on a real device
- [ ] Add an app icon / splash image (currently using Expo defaults)
- [ ] Test on a genuinely low-end Android device over 3G, per the Phase 1
      non-functional requirements
