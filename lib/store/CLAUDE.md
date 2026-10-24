# Store (loads when working in lib/store)

- **`lib/store/`** - backend-agnostic:
  - `createPathStore(path)`, `createGameStore(room, slug)`, `updateRoot`,
    `serverTimestamp` (required for the rules' `<= now` checks), `watchConnection`,
    `setOnDisconnect`, `watchServerTimeOffset` (the server's clock, for starting
    something on two devices at once).
  - The backend is Firebase when all five `NEXT_PUBLIC_FIREBASE_*` vars are set;
    otherwise `localDb.ts` (one JSON tree in localStorage, synced across tabs of
    one browser profile only).
  - `readOnce()` returns null **only** when the rules deny a read; it rethrows
    offline errors, so code never acts on "missing" data it didn't actually see.
  - UI code never knows which backend is active.
