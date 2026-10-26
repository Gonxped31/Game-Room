T-8ndb | 3 | - | M | full-stack,regions | Daily routes: Firebase App Check (reCAPTCHA v3) so scripts can't call /api/daily without the page
created: 2026-10-26T03:18:12.183Z

Plan step 5 (docs/daily.md anti-cheat). Optional hardening once the daily has players: register App Check with reCAPTCHA v3 in the Firebase console, initialize it in the client (lib/store/firebaseApp.ts), send the App Check token with dailyRequest (lib/daily/client.ts) and verify it in dailyRoute (lib/daily/server.ts) with firebase-admin/app-check. Skip on the emulators.
