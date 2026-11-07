# EVMOS Mechanic App — Phase 1 (Expo / React Native)

Implements the Mechanic Line screens from `EVMOS_Phase1_Build_Spec.docx`.
Third and final Phase 1 mobile surface, alongside `../mobile` (Driver App)
and `../station-portal`.

**Same caveat as the other two apps: not run/tested as an app.** Every
backend endpoint this app depends on — including two added this session
(`GET /mechanics/me`, `GET /service-requests/mine`) — was individually
curl-tested against the live backend through the full flow: register →
manually verify → see nearby request → accept → mark complete. All
confirmed working. The React Native code has been checked for balanced
syntax and reviewed logic-by-logic, but hasn't run on a device.

## Screens implemented

| Screen (per build spec) | Status |
|---|---|
| Mechanic Registration | ✅ |
| Verification Pending | ✅ — polls status on pull-to-refresh and on screen focus |
| Incoming Requests | ✅ — core screen; also auto-redirects to Active Job if one is already accepted |
| Active Job | ✅ — driver contact, navigate handoff, call, mark complete |

## Setup

```bash
cd mechanic-app
npm install
npx expo install expo-location @react-navigation/native @react-navigation/native-stack react-native-screens react-native-safe-area-context @react-native-async-storage/async-storage expo-document-picker expo-file-system
```

Same note as the other two apps: don't hand-install those native-code
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

## Note on manual verification and tiering

Phase 1/2 vetting is deliberately manual (per the build spec) — there's no
admin approval screen yet. To move a mechanic from `pending_verification`
to `active`, and optionally promote them to `certified` tier, update it
directly in the database:

```bash
node -e "
const { DatabaseSync } = require('node:sqlite');
const db = new DatabaseSync('../evmos.db');
db.exec(\"UPDATE mechanics SET status = 'active', tier = 'certified' WHERE user_id = 'THE_USER_ID'\");
"
```

Use `tier = 'general'` instead of `'certified'` if you want to verify
without promoting — that's the more common case; `certified` should be a
deliberate call after actually reviewing their uploaded document (see
below), not the default.

An admin approval tool for this is tracked in `DEFERRED_BACKLOG.md`
("Admin tool for mechanic verification").

## Note on document uploads

Mechanics upload their certification/ID as an actual PDF (via
`expo-document-picker` + `expo-file-system`), not just a pasted link. The
file is base64-encoded and stored directly in the local SQLite database —
an interim approach so upload works end-to-end without needing real cloud
storage credentials in this environment. See the `PRODUCTION NOTE` in
`src/routes/mechanics.js` (backend repo) for what changes before this
handles real user documents at scale.

To review what a mechanic uploaded before deciding on verification/tier,
query it directly:

```bash
node -e "
const { DatabaseSync } = require('node:sqlite');
const db = new DatabaseSync('../evmos.db');
const docs = db.prepare('SELECT filename, mime_type, uploaded_at FROM mechanic_documents WHERE mechanic_id = ?').all('THE_MECHANIC_ID');
console.log(docs);
"
```

(This lists metadata only — pulling the actual base64 content out to view
the PDF is possible but not wired into a convenient script yet; worth
adding if manual review volume grows.)
