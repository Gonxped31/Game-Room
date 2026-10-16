This a correction of the initial architecture implemented.

## Context

Game Room is a Next.js app on Vercel (static pages, no API routes). Players share a room through Firebase Realtime Database. A store abstraction (`Store<T>`) has a Firebase backend and a localStorage fallback.

There are two session modules:
- `useGameSession()` (lib/session/) for 1v1 games: First to Worst (`ftw`) and Co-Counsel (`cocounsel`). Role is `"p1" | "p2"`.
- `useMultiplayerSession()` (lib/session/multiplayer/) for 3+ player rooms. Seats `p1..pN` from `maxPlayers`. It's built and tested, but no game uses it yet.

Today the database rules are wide open (`games/$roomId` and `roomsByName/$name` are `.read: true, .write: true`). Anyone with a room code can overwrite or delete the room, nothing checks what gets written, and anyone can squat on or delete name entries.

## Goal

- Lock the database down using invisible guest IDs (Firebase Anonymous Auth). There is no sign-in screen and no accounts. That's a product decision: don't add a sign-in option.
- Support any number of seats (up to 8) in the rules, so both session modules work under them.
- Replace the polling heartbeat with Firebase's built-in disconnect detection.
- Remember each guest's rooms, and show them on the hub.
- Make a misconfigured deploy fail loudly.

**Do not change gameplay, game rules, scoring or game visuals.** Don't change the public API of `useGameSession()` or the `Role` type that FtW and Co-Counsel use. Keep every existing test passing.

Read the existing code first (`lib/session/**`, `lib/store/*`, both game modules, `app/**/page.tsx`) and adapt the plan to it. If something here conflicts with how the code actually works, tell me before working around it.

## 1. Guest IDs (Anonymous Auth)

- Call `signInAnonymously` once, before the store subscribes, with the default local persistence. Both session hooks expose the `uid` and keep their existing loading state until auth is ready.
- If sign-in fails, show "Can't connect right now. Check your connection and reload." Don't fall back to local mode silently.
- In local fallback mode, generate a stable fake uid in localStorage so the code has the same shape.
- Every tab in one browser now shares a uid, and **one uid holds at most one seat per room**. To test two players on one machine, use a normal window plus a private window (or two browsers). Update any dev notes that say "two tabs".

## 2. Data model (must match `database.rules.json`)

```
games/{roomCode}/
  meta:       { gameSlug, maxPlayers, createdAt, createdBy: uid, name?, nameKey? }   // write-once
  seats:      { p1: uid, p2: uid, ...pN }       // who sits where
  members:    { [uid]: "p1" }                   // reverse index: which seat this uid holds
  players:    { p1: { name }, ... }             // display names, if the app has them
  presence:   { [uid]: { online, lastSeen } }
  lastActive: number
  ftw | cocounsel: { ...game state... }         // never both; one key per game slug
roomsByName/{nameKey}: roomCode                 // unique, first come first served
users/{uid}/rooms/{roomCode}: { gameSlug, addedAt, createdByMe?, name? }
```

Why `members`: database rules can't loop over N seats to ask "is this uid in the room?". `members/{uid}` answers it in one lookup. The rules keep `seats` and `members` in sync, so **always write them together in one multi-path `update()`**:

| Action | Paths in one `update()` from the database root |
| :--- | :--- |
| Create room | `meta`, `seats/p1`, `members/{uid}`, `presence/{uid}`, initial game state, `users/{uid}/rooms/{code}`, `roomsByName/{nameKey}` if named |
| Claim empty seat | `seats/{seat}`, `members/{uid}`, `users/{uid}/rooms/{code}` |
| Switch seat | old `seats/{old}` = null, `seats/{new}`, `members/{uid}` = new |
| Leave room | `seats/{seat}` = null, `members/{uid}` = null, `presence/{uid}` = null |
| Take over a seat | `seats/{seat}` = my uid, `members/{my uid}` = seat, `members/{old uid}` = null |

Rules that shape the code:
- **`meta.maxPlayers` is required.** It must be 2 for `ftw` and `cocounsel`, and is 2 to 8 for anything else. Seats above `maxPlayers` are refused, so a full room is enforced by the database, not only the client.
- **Write to leaf paths only.** A `set`, `update` or `runTransaction` on `games/{room}` itself is denied. Move every game transaction to `games/{room}/{slug}`. Seat claiming can't be a transaction on `seats` either: use the multi-path update above. If two players race for the same seat, the second write fails because the seat is no longer empty. Treat that failure as "seat taken" and refresh.
- **Room code collision.** If creating fails because `meta` already exists, generate a new code and retry (max 5 tries).
- **Seat takeover.** A player who lost their guest ID (Safari wiped storage, different browser) can take a held seat when its holder's presence is `online: false` and `lastSeen` is over 2 minutes old. Offer it through the existing seat picker ("Take this seat" on a held seat that's offline). No new screens.
- **Unique room names.** Normalize the name to `nameKey`: lowercase, trim, spaces to `-`, drop anything not `a-z 0-9 -`, length 3 to 40. If the name is taken, creation shows "That name is taken. Try another." Names stay optional.
- **Join.** By code: read `games/{code}/meta` and route to `/{gameSlug}#{code}`. By name: read `roomsByName/{nameKey}`, then the same. If the room isn't found or the read is denied, show the existing "We can't find that room" error. `findRoomsByName` now returns at most one room.
- Reading `/games`, `/roomsByName` or another user's `/users/{uid}` is denied. Never query a parent node.
- **Old rooms aren't migrated.** Rooms in the old shape stop loading once the new rules are live. That's acceptable.

**Both session modules.** Move the low-level seat logic (claim, switch, leave, take over, presence) into shared helpers under `lib/session/shared/` and call them from both `useGameSession()` and `useMultiplayerSession()`. The hooks stay separate, and `useGameSession()` keeps its API. Don't merge the hooks yet: we'll do that after the first 3+ player game ships.

## 3. Presence with onDisconnect

- Remove the heartbeat (both modules).
- Listen to `.info/connected`. Each time it becomes true: call `onDisconnect()` on `games/{room}/presence/{uid}` with `{ online: false, lastSeen: serverTimestamp() }`, then set `{ online: true, lastSeen: serverTimestamp() }`.
- A seat is online when `presence[seats[seat]].online === true`. Presence is keyed by uid, so a device that lost its seat can't mark the new holder offline when it disconnects. Keep `isSeatOnline` working on top of this.
- Update `lastActive` with `serverTimestamp()` at most once a minute while a game is in progress.
- **Subscriptions:** don't listen to `games/{room}` as a whole if that sends the whole room to every device on each presence change. Listen to `meta`, `seats`, `players`, `presence` and the game subtree separately, and combine them in the hook.

## 4. "Your rooms" on the hub

- When a guest creates or joins a room, write `users/{uid}/rooms/{code}` in the same update (see the table).
- On the hub (`/`), under the join panel, show "Your rooms" when the list isn't empty. Each row shows the game, the room name or code, and "Created by you" if `createdByMe`. Tapping a row opens `/{gameSlug}#{code}`. Use the hub's existing styles (white rounded panel, Fredoka). Keep it simple, a designed version will come later.
- Order by `games/{code}/lastActive` (newest first) and show rooms active in the last 30 days.
- If a room's `meta` no longer exists (cleaned up), remove it from the list silently.
- The hub page's server component stays as it is. Put the list in a small client component.

## 5. Guest-ID loss mitigations

Players lose their guest ID, and their room list, when the browser wipes the site's storage. Two cheap mitigations:

1. **iPhone "Add to Home Screen" tip.** Safari on iOS wipes a site's storage after about 7 days without a visit. Apps added to the home screen are not affected. On iOS Safari, when not already running standalone (`navigator.standalone !== true` and not `display-mode: standalone`), show a small dismissible tip under "Your rooms" once a guest has at least one room: "Tip: add Game Room to your Home Screen so your rooms stay saved." Remember the dismissal in localStorage. Add a minimal `app/manifest.ts` (name, icons, `display: "standalone"`, theme color `#0F7983`) and an apple-touch-icon so home-screen installs look right.
2. **"Open in your browser" hint for in-app browsers.** Invite links are often opened inside Messenger, Instagram, WhatsApp, Facebook, TikTok, Snapchat or LINE, which use separate storage. Detect these from the user agent (keep the list in one file). In a room page, show a slim dismissible banner: "You're in [app]'s browser. Open this link in Safari or Chrome to keep your rooms." Add a "Copy link" button. Don't block play, and don't try to force-open another browser.

## 6. Fail loudly on bad config

- In `next.config.*`: if `process.env.VERCEL` is set and any of the five `NEXT_PUBLIC_FIREBASE_*` variables is missing or empty, throw with a message naming the missing ones. The Vercel build (preview and production) then fails instead of shipping a local-only app.
- Locally, local fallback mode keeps working, but show a small fixed banner while it's active: "Local mode: not synced between devices".

## 7. Rules tests (Firebase emulator)

The rules haven't been run against the emulator yet. Do this first and fix the rules file if a test proves a rule wrong. Tell me what you changed in the rules and why.

- Add `firebase.json` with `"database": { "rules": "database.rules.json" }` and the database emulator.
- Add `@firebase/rules-unit-testing` and a `test:rules` script (`firebase emulators:exec --only database "vitest run tests/rules"`).
- Cover at least these cases:
  1. Unauthenticated reads and writes are denied everywhere.
  2. Reading `/games`, `/roomsByName` or another user's `/users/{uid}` is denied.
  3. Creating a room with one multi-path update succeeds. Creating it again over an existing `meta` fails.
  4. A bad room code (contains `i`, `l`, `o`, `0`, or isn't 6 characters) is rejected.
  5. `maxPlayers`: must be 2 for `ftw` and `cocounsel`. Claiming `p3` fails when `maxPlayers` is 2. Claiming `p5` works when it's 5, and `p6` fails.
  6. Claiming an empty seat works only with the matching `members` write. A uid can't hold two seats. Switching seats in one update works.
  7. A non-member can't write the game state, `players`, `presence`, `lastActive` or anyone's `members` entry, and can't delete the room.
  8. A member can only write the game subtree that matches `meta.gameSlug`.
  9. Takeover works only when the holder is offline and `lastSeen` is over 2 minutes old, and only if the old `members` entry is removed in the same update.
  10. Leaving the room (seat and members removed together) works. Removing only one of them fails.
  11. Names: the first creator wins, a second room can't take the name, and only the creator can delete the entry. `nameKey` must match `meta.nameKey`.
  12. `users/{uid}`: only that uid can read or write it. Unknown fields are rejected.
  13. Unknown children (`games/{room}/junk`, `meta/junk`) are rejected.
- Add `test:rules` to CI next to the existing Vitest run.

## 8. Validate game state

`ftw` and `cocounsel` are gated by membership but have no shape checks yet. From each game's TypeScript state type, add `.validate` rules:
- Allowed keys only, with `"$other": { ".validate": false }` at each level.
- Types for every field: numbers for scores, booleans, enum fields such as `status` checked with `==`.
- Length caps on every free-text string, matching the UI limits (for example, custom prompt items).
- Arrays: Firebase stores them as objects keyed `0..n`. Validate the key range (exactly 5 items for First to Worst).

Add rules tests for a valid state and a few invalid ones.

**Adding a game later:** add its slug to `meta.gameSlug`, give it its own node next to `ftw` with the same membership check, and its own `.validate` rules. Write this checklist in a short comment at the top of the rules tests.

## Notes on the rules language

- The regex in `matches()` is limited. Don't use `{n,m}` quantifiers: repeat the character class or check `.length`, as the file does.
- There are no loops or functions. That's why `members` exists and why the seat cap is written out for `p3` to `p8`.

## Done when

- `npm test`, `npm run test:rules` and `npm run lint` pass.
- A normal window and a private window can create, join by code, join by name, play a full First to Worst round, and see each other go offline within a few seconds of closing a tab.
- A third private window with the room link can read the room but can't change it.
- "Your rooms" lists the room in both windows and still lists it after a reload.
- The multiplayer module can still claim three seats in a `maxPlayers: 3` room, and a fourth player gets "room full". Use a test or the throwaway page.
- A Vercel build with one Firebase variable removed fails with a clear message.

Then summarize what you changed, anything you had to deviate from, and the deploy steps below.

## Deploy steps (for me, in this order)

1. In the Firebase console: Authentication, then Sign-in method, then enable **Anonymous**. If your Vercel domain isn't listed under Authentication, Settings, Authorized domains, add it.
2. Deploy the app to Vercel. It still works under the old open rules.
3. Deploy the rules: `firebase deploy --only database`, or paste `database.rules.json` into Realtime Database, then Rules.
4. Test with two devices, including one iPhone.
