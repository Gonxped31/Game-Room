# Game Room (repo) — a platform for private, link-shared 1v1 games

This repo started as a single private 2-player ranking game, **First to Worst**
("FTW" below). It's now a small **platform for games that share a link**:
- `/` is a game picker (the "hub").
- Each game lives on its own route (`/ftw`, `/cocounsel`) with a `#roomcode` hash.
- Every game shares one session layer: invisible guest identity, rooms, seats,
  presence and a backend-agnostic store.

The games are First to Worst and Co-Counsel (currently hidden from the picker; see
Status). Their rules and history are in their own sections at the end of this file.

The **architecture and data model below describe the system as it is now**. The
per-game "Status" logs further down are a chronological history: older entries
describe mechanisms that have since been replaced (seats stored in game state,
per-tab `me` pointers, a polling heartbeat, the open `games/$roomId` rule). Where
a history entry disagrees with the architecture sections, the architecture
sections win.

## Architecture

### Routing

- `/` is the hub: `app/page.tsx`, a server component with no session logic. It
  contains the game cards (`lib/games/registry.ts` → `GamePickerCard`),
  `JoinRoomForm`, and `YourRooms` (with `HomeScreenTip`).
- Each game lives at `/<slug>`, with the room code in the URL hash (`/ftw#k3m9pq`).
  A bare visit with no hash creates a fresh room first, then writes its code into
  the hash.
- Navigating *into* a room from the hub (`JoinRoomForm`, `YourRooms`) is always a
  **hard navigation** (`window.location` / a plain `<a>`), never `router.push` or
  `next/link`. Co-Counsel's "am I this room's creator" check reads
  `window.location.hash` on its very first render, which only a real page load
  guarantees (see Co-Counsel Status, Stage 8).

### Guest identity (`lib/session/shared/auth.ts`)

- **Firebase Anonymous Auth, invisible.** There is no sign-in screen and there
  never will be (a product decision, not a missing feature).
  - `signInAnonymously` runs once, only when there's no persisted user, with the
    SDK's default local persistence.
  - `useGuestAuth()` returns `{ status: "loading" | "ready" | "error", uid }`.
  - `ensureGuestUid()` is the promise form, for one-off reads outside a hook (e.g.
    `JoinRoomForm`).
  - When sign-in fails, pages show `CONNECTION_ERROR_MESSAGE` ("Can't connect right
    now. Check your connection and reload."). There is never a silent fallback to
    local mode.
- **Every tab of one browser shares one uid**, and **one uid holds at most one
  seat per room**. To play both sides on one machine against Firebase, use a
  normal window plus a private window (or two browsers), not two tabs.
- **Local mode** (no Firebase config) uses a fake uid in **sessionStorage**, so
  each tab has its own uid, kept across reloads of that tab. This is a deliberate
  deviation from the spec's "localStorage": it keeps two-tab play working locally,
  which is the whole point of local mode.
- Dev only: `NEXT_PUBLIC_FIREBASE_AUTH_EMULATOR_URL` points Auth at the emulator
  (README, "Testing against the emulators").

### Room data model (`database.rules.json` is the source of truth)

```
games/{roomCode}/
  meta:       { gameSlug, maxPlayers, createdAt, createdBy: uid, name?, nameKey? }
  seats:      { p1: uid, p2: uid, ...pN }       // who sits where
  members:    { [uid]: "p1" }                   // reverse index: which seat this uid holds
  players:    { p1: { name }, ... }             // display names, keyed by seat
  presence:   { [uid]: { online, lastSeen } }
  lastActive: number
  ftw | cocounsel: { ...game state... }         // exactly one, matching meta.gameSlug
roomsByName/{nameKey}: roomCode                 // unique, first come first served
users/{uid}/rooms/{roomCode}: { gameSlug, addedAt, createdByMe?, name? }
```

- **`meta`** is write-once, except `name`/`nameKey`, which only `meta.createdBy`
  may set, change or clear (from `InviteLinkBanner`; joiners don't see the field).
  `meta.maxPlayers` is required: it must be 2 for `ftw`/`cocounsel`, and 2–8 for
  anything else. The rules refuse seats above it, so a full room is enforced by
  the database.
- **Room codes** are 6 characters from `lib/session/room.ts`'s alphabet (no
  `i`/`l`/`o`/`0`/`1`). The rules reject anything else.
- **`seats` and `members` must always change together**, in ONE multi-path
  `updateRoot()`. The rules check each side against the other, because rules
  can't loop over N seats to ask "is this uid in the room?". `members/{uid}`
  answers that in one lookup.
- **The rules only allow writes at the child paths they name.** A `set`,
  `update` or transaction on `games/{room}` itself is denied, and so is a
  transaction on `seats`. Game state is transacted at `games/{room}/{slug}`.
- **Every write the session layer sends is built by the pure functions in
  `lib/session/shared/updates.ts`**, one per action:

  | Action | Builder | Notes |
  | :--- | :--- | :--- |
  | Create room | `createRoomUpdate` | `meta` + initial game state + creator's `users/` entry. **Seats nobody**: the creator claims a seat through the picker like everyone else (a Co-Counsel creator may want p2). The rules allow the creating update to write the game state before anyone is a member. |
  | Claim empty seat | `claimSeatUpdate` | seat + members + `players/{seat}` + `users/{uid}/rooms/{code}` |
  | Switch to an empty seat | `switchSeatUpdate` | old seat null, new seat, members, name |
  | Swap two seated members | `swapSeatsUpdate` | Co-Counsel's "Switch role instead". The rules allow only a permutation of existing members, never a kick. Names stay with the seat. |
  | Leave | `leaveRoomUpdate` | seat + members + presence removed together |
  | Take over an offline seat | `takeOverSeatUpdate` | holder `online: false` and `lastSeen` over 2 min old; old `members` entry removed in the same update; the taker's old seat (if any) vacated |
  | Name / rename / clear | `roomNameUpdate` | `meta/name` + `meta/nameKey` + new `roomsByName` entry + old entry nulled, all in one update. A taken name fails the whole update ("That name is taken. Try another."). |

- **Names**: `nameKey(name)` lowercases, trims, turns spaces into `-`, drops
  anything not `a-z0-9-`, and requires 3–40 characters. `meta.nameKey` must match a
  `roomsByName` entry that points back at the room. Room names are unique, so
  joining by name finds at most one room.
- **Reads**: any signed-in guest with a code can read that room, which is how a
  third window can watch but not play. Nobody can read the parents `/games` or
  `/roomsByName`, or another guest's `/users/{uid}`. Never query a parent node.
- **Game-state validation**: `ftw`/`cocounsel` have full `.validate` rules derived
  from their TypeScript state types:
  - allowed keys only (`$other: false` at every level);
  - field types and enums;
  - length caps on free text;
  - array key ranges (FTW: exactly 5 items).

  FTW's custom-prompt caps (`MAX_PROMPT_LENGTH` = 120, `MAX_ITEM_LENGTH` = 60 in
  `lib/games/ftw/constants.ts`) are enforced in the UI and in `customRound` to
  match.
- **Old rooms** (the pre-guest-ID shape) aren't migrated and stop loading under
  these rules. Accepted.

### `lib/session/shared/` - the room mechanics every game uses

- `auth.ts` - guest identity, above.
- `updates.ts` - the pure update builders above, plus the `RoomMeta`,
  `UserRoomEntry` and `PresenceEntry` types.
- `roomActions.ts` - async helpers:
  - `createRoom` generates a code and retries up to 5 times on a collision, or
    tries exactly one given code.
  - `readRoomMeta`, `findRoomByName`, `renameRoom`.
  - The user-facing messages (`ROOM_MISSING_MESSAGE`, `NAME_TAKEN_MESSAGE`,
    `NAME_TOO_SHORT_MESSAGE`).
- `presence.ts` - **no heartbeat**:
  - `startPresence(room, uid)` listens to `.info/connected`. Each time it becomes
    true, it arms `onDisconnect` → `{online: false, lastSeen: serverTimestamp()}`,
    then writes `{online: true, ...}`.
  - It also re-asserts `online: true` if its own entry flips to false while still
    connected (another tab of the same uid closing triggers *its* onDisconnect for
    the same uid).
  - Cleanup marks the guest offline but never deletes the entry, because takeover
    is judged on `lastSeen`.
  - Presence is keyed by uid, so a device that lost its seat can never mark the new
    holder offline. A seat is online when `presence[seats[seat]].online === true`
    (`isSeatOnline`).
  - `canTakeOver` (offline, and `lastSeen` over `TAKEOVER_AFTER_MS` = 2 min) drives
    the "Take this seat" offers.
- `useRoom.ts` - the core hook both session hooks wrap:
  - **Gating**: nothing is read or written until the guest is signed in AND
    there's a real `#code`. Firebase cancels a listener the rules deny for good,
    so subscribing early would break it permanently.
  - **Room resolution**: a bare visit runs `createRoom`, then sets the hash. A
    `#code` whose `meta` is missing tries `createRoom` at that code. A `#code`
    that can't be created there, or belongs to another game, sets `roomMissing`.
    An offline read sets `connectionError`.
  - **Subscriptions**: separate listeners on `meta`, `seats`, `members`, `players`,
    `presence` and the game subtree. Never the whole room, which would resend
    everything to every device on each presence change.
  - **Seat actions**: `claimSeat` re-confirms an own seat, takes over a stale
    one, switches, or claims fresh. Also `moveOrSwapTo`, `leave`, `newRoom`.
  - **Presence and `lastActive`**: presence runs while seated. `lastActive` is
    written with the server timestamp at most once a minute while every seat is
    filled.
  - **Clock**: a 15s local tick for takeover eligibility. The clock is only read
    in timer callbacks, never during render.
  - **Trimming**: display names are trimmed to 24 characters (the rules allow
    1–24).
- **Local mode has no rules**, so `useRoom`/`roomActions` re-read and pre-check
  what the rules would deny: a taken seat, an existing room, a taken name.

### `lib/session/` - the 1v1 layer (FTW, Co-Counsel)

- `types.ts` - `Role` (`"p1" | "p2"`, never renamed per game; each game maps its
  own role names onto p1/p2) and `WithIdentity`.
- `useGameSession.ts` - the hook every 1v1 page calls once:
  `useGameSession({ gameSlug, createInitialState })`.
  - **Its public API is unchanged from before the guest-ID rework**: `room, game,
    gameStore, me, other, names, bothJoined, roomName, setRoomName, online,
    pickIdentity, releaseAllIdentities, transact, setGame, newRoom`.
  - **Additive fields**: `uid`, `connectionError`, `roomMissing`, `canRenameRoom`,
    `roomNameError`, `canTakeOver`.
  - `me` is `members[uid]`, and `names` comes from `players`, filtered to seats
    that are actually held.
  - **Seats persist across game resets.** `setGame(createInitialState())` ("Reset
    game", "Rematch", "Start a new case") never unseats anyone.
  - `releaseAllIdentities()` keeps its old name but now means "switch role": an
    atomic swap when both seats are held, or a move to the other seat when it's
    empty.
- **`WithIdentity` is still required on every game state**, but the session layer
  no longer reads or writes the state's own `names` field. It stays as `names: {}`,
  which Firebase drops on write. `identity.ts`'s
  `setIdentityName`/`releaseAllIdentityNames` are unused now, kept along with their
  tests.
- `room.ts` - `generateRoomCode()`.

### `lib/session/multiplayer/` - 3+ player rooms (no game uses it yet)

- `useMultiplayerSession({ gameSlug, maxPlayers, createInitialState })` returns
  `{ room, game, gameStore, uid, connectionError, seats, me, otherSeats, names,
  joinedSeats, unclaimedSeats, allJoined, online, pickIdentity, transact, setGame,
  newRoom }`.
- It's the same `useRoom` core mapped onto open-ended `SeatId`s (`"p1".."pN"` from
  `seatIds(maxPlayers)`). It's kept as a separate hook rather than merged with
  `useGameSession`, so the 1v1 API stays stable. Merge them once a 3+ player game
  ships.
- `presence.ts` re-exports the shared presence helpers. `identity.ts`
  (`setMultiplayerIdentityName`) is unused, like its 1v1 counterpart.
- The deployed rules only allow `ftw`/`cocounsel`, so 3+ seat behaviour is tested
  through a test-only slug (`mptest`, see Testing).
- `RoleStickers` works for N players unchanged. `RolePicker`/`Header` are
  hardcoded to 2 seats and would need N-player versions.

### `lib/store/` - backend-agnostic data access

- `config.ts` - `firebaseConfig`, `hasFirebaseConfig`, `isLocalMode`. It has no
  `firebase` runtime import, so server components can use it.
- `index.ts` - the API everything above uses:
  - `createPathStore<T>(path)` returns a `Store<T>` for any path. Firebase when
    all five `NEXT_PUBLIC_FIREBASE_*` vars are set, else `localDb.ts`.
  - `createGameStore(room, slug)` (= `games/{room}/{slug}`).
  - `updateRoot(values)` - a multi-path update from the root; rejects when the
    rules deny it.
  - `serverTimestamp()` - the server clock on Firebase (required by the rules'
    `<= now` checks); `Date.now()` locally.
  - `watchConnection`, `setOnDisconnect`, and `emptyStore` (for "not ready yet").
- `firebaseApp.ts` - one shared app/database instance (auth uses the same app).
- `firebaseStore.ts` - the Firebase `Store<T>` plus the root-level helpers.
  `readOnce()` returns `null` **only for a rules denial** and rethrows anything
  else (offline), so callers never act on a room's absence they didn't actually
  observe. For example, "Your rooms" deletes an entry only when `meta` really is
  gone. A denied write or transaction resolves to "not written" instead of
  throwing.
- `localDb.ts` - local mode:
  - The whole "database" is one JSON tree under the localStorage key `localdb`,
    addressed by the same paths as Firebase.
  - It mirrors Firebase's write behaviour: `null`, empty objects and empty arrays
    are dropped.
  - It syncs across tabs of one browser *profile* via the `storage` event; it
    can't sync across profiles, browsers or devices.
  - `onDisconnect` is emulated with `pagehide`.
- `types.ts` - `Store<T>`: `subscribe`, `getSnapshot`, `readOnce`, `set`,
  `transaction`. Shaped for `useSyncExternalStore`.

### Hub and room-page chrome

- `components/JoinRoomForm.tsx` - one input with a Code/Name switch.
  - The lookup always tries the typed value as a code first (`readRoomMeta`), then
    as a name (`findRoomByName` → `roomsByName/{nameKey}` → that room's meta).
  - Not found or denied → "We can't find that room". Offline or sign-in failure →
    the connection message.
  - A pasted invite link works: everything before the last `#` is dropped.
- `components/YourRooms.tsx` - a client component on the hub, hidden while empty.
  - It reads `users/{uid}/rooms`, then each room's `meta` and `lastActive`.
  - It shows rooms active in the last 30 days, sorted by `lastActive` (falling back
    to `meta.createdAt`), newest first.
  - Each row shows the room name or code, the game title, and "Created by you".
  - A room whose `meta` is gone is dropped and its entry removed, silently.
- `components/HomeScreenTip.tsx` - under "Your rooms", on iOS Safari tabs only
  (not standalone, not in-app browsers). Dismissal is remembered in localStorage.
  Safari wipes a site's storage after ~7 days without a visit, and Home Screen
  apps are exempt. `app/manifest.ts`, `public/icon-192.png`/`icon-512.png` and
  `app/apple-icon.png` make installs look right, and `layout.tsx` sets
  `appleWebApp` + `themeColor`. The icons were rasterized by a throwaway script;
  regenerate or replace them freely.
- `components/InAppBrowserBanner.tsx` - on both game pages. It's a slim,
  dismissible hint with a "Copy link" button, shown inside Messenger, Instagram,
  Facebook, WhatsApp, TikTok, Snapchat or LINE, whose browsers keep separate
  storage. The UA list lives in `lib/inAppBrowsers.ts`. It never blocks play.
- `components/LocalModeBanner.tsx` - a fixed "Local mode: not synced between
  devices" pill on every page while `isLocalMode`.
- **`next.config.ts`** throws when `process.env.VERCEL` is set and any of the five
  Firebase vars is missing or empty, naming them. Vercel preview and production
  builds then fail instead of shipping a local-only app.

### Shared, reusable components

- `Button.tsx`.
- `Header.tsx` - takes a `title`, and always renders a `←` link back to `/`.
- `Footer.tsx` - has an "All games" link, and shows `roomName || room`.
- `RolePicker.tsx` - FTW's name entry.
  - The first free seat gets the typed name.
  - When both seats are held by other guests, it shows "Take this seat" on a seat
    whose holder is offline and stale, and "X is playing" (disabled) otherwise.
- `InviteLinkBanner.tsx` - copy invite link, plus the optional "Name this room"
  field.
  - The field shows only when `onRenameRoom` is passed (the creator), with
    `nameError` underneath.
  - `accentColor`/`accentShadowColor`/`accentTextColor` theme the button and
    default to FTW's pink.
- `RoleStickers.tsx` - a generic `roles: {emoji,label,name,isYou,online?}[]`.
- `GamePickerCard.tsx`.
- The hub/room chrome above.

### Per-game, not shared

- Each game gets:
  - `lib/games/<slug>/` - a pure state machine that throws on invalid
    transitions and never mutates, plus constants, content and Vitest coverage.
  - `components/<slug>/` - its own visuals.
  - `app/<slug>/page.tsx` - wires `useGameSession` to the game.
- A game's page must handle three session states in its loading slot:
  `connectionError`, `roomMissing`, and `!game` ("Connecting…").

### Adding a new game

1. Add a `GameEntry` to `lib/games/registry.ts`: slug, title, tags, and colors.
2. Create `lib/games/<slug>/`, `components/<slug>/` and `app/<slug>/page.tsx`.
3. **Rules** (the checklist is also at the top of `tests/rules/rooms.test.ts`):
   - Add the slug to `meta/gameSlug`'s `.validate`, and to the `maxPlayers == 2`
     check if it's 1v1.
   - Add a `games/$room/<slug>` node with the same `.write` as `ftw` (members-only,
     or the creating write).
   - Write `.validate` rules from the game's state type.
   - Add valid/invalid state tests in `tests/rules/gameState.test.ts`.
4. Plan for RTDB's data-shape quirks from day one (Store design notes below).

## Commands

```bash
npm run dev        # dev server at localhost:3000
npm run build      # production build (also type-checks)
npm run lint       # eslint
npm run test       # vitest (lib/**/*.test.ts) - excludes tests/rules
npm run test:rules # database.rules.json vs the Database emulator (tests/rules/, needs Java)
npx tsc --noEmit   # type-check only
```

CI (`.github/workflows/ci.yml`) runs lint, `tsc`, `npm test` and
`npm run test:rules` on pushes to `main` and on PRs.

## Conventions

- Game/state-transition logic stays out of presentational components. It belongs
  in each game's `lib/games/<slug>/` (state machine, scoring, content banks).
- Every game's state type satisfies `WithIdentity` (`lib/session/types.ts`).
- Room/seat writes go through a builder in `lib/session/shared/updates.ts`, sent
  with `updateRoot()`. Never hand-assemble seat paths in a component.
- UI never knows which backend is active; everything goes through `lib/store`.
- Never read the clock or `window` during render. Do it in effects or timer
  callbacks, or via `useSyncExternalStore` with a server snapshot. Next's Cache
  Components and this project's `react-hooks/*` lint rules flag the alternatives.

## Store design notes

- **`transaction()`** (exposed as the hooks' `transact`) is how invalid or duplicate
  game transitions become safe no-ops (double clicks, two tabs). A game's
  transition throws on an invalid move; the store catches that and aborts without
  writing. Firebase aborts the same way when the updater returns `undefined`, and
  a rules denial resolves to "not written".
- **Two Realtime Database data-shape gotchas every game's `game.ts` must
  assume.** Neither reproduces in Vitest, and local mode now mimics the first:
  - **Dropped empty arrays/objects.** RTDB omits a field written as `[]` or `{}`,
    so it reads back as `undefined`. Normalize every array/object field with
    `value ?? []` / `?? {}` on read (FTW: `addUsedPrompt`; Co-Counsel:
    `normalizeGame`).
  - **Explicit `undefined` is rejected on write.** Firebase throws "Data returned
    contains undefined in property ..." when a written object has an own property
    set to `undefined`. Clear an optional field by building a fresh object without
    the key, never with `{ ...old, field: undefined }`.
- **Local mode is per browser profile.** Two tabs in one Chrome profile share it;
  two profiles, browsers or devices never can. A past "sync bug" report turned out
  to be a stale dev server running without Firebase config, tested across two
  Chrome profiles. That's what `LocalModeBanner` (and the Vercel build guard) now
  make impossible to miss. Restart `npm run dev` after changing `.env.local`.
- **Deploy order matters.** Ship the client before the rules. When the new rules
  were deployed while Vercel still served the old client (whose room creation ran
  a transaction on `meta`), every room creation failed with `permission_denied`.

## Testing

- **Unit (`npm test`)** covers:
  - the game state machines, scoring and the prompt bank;
  - the update builders (`lib/session/shared/updates.test.ts`);
  - presence (`lib/session/multiplayer/presence.test.ts`);
  - in-app browser detection.

  Hooks aren't unit-tested; they're verified live.
- **Rules (`npm run test:rules`)**: `tests/rules/` under the Database emulator
  (`firebase.json`; `vitest.config.mts` includes those files only when
  `FIREBASE_DATABASE_EMULATOR_HOST` is set, and runs them serially).
  - `rooms.test.ts` - the spec's 13 cases, plus swap, rename and
    create-without-seat.
  - `gameState.test.ts` - valid states produced by playing each game's real state
    machine, plus invalid ones.
  - `sessionUpdates.test.ts` - the app's own builders sent through the rules,
    including the multiplayer `maxPlayers: 3` room (3 seated, a 4th refused).
  - `helpers.ts` loads `database.rules.json` and can inject a test-only slug
    (`mptest`) **in memory** for 3+ seat rooms. The file on disk never contains
    it.
- **Live**: run the app against the Auth + Database emulators (README, "Testing
  against the emulators") and drive two isolated Playwright contexts. Each one
  stands in for a separate browser or private window. The guest-ID rework was
  verified this way:
  - create, name, and join by name;
  - a full FTW round;
  - the other side shown offline ~1s after closing a tab;
  - a third context read-only;
  - "Your rooms" across a reload;
  - Co-Counsel auto-assign and swap;
  - a local-mode two-tab game.

  Kill leftover emulator Java processes on ports 9000/9099 if `test:rules` reports
  "port taken".

## Deploying (Vercel + Firebase)

- Enable **Anonymous** under Firebase Authentication → Sign-in method.
- **Authorized domains aren't needed for anonymous sign-in.** That list governs
  OAuth redirect/popup and email-link flows, and doesn't accept wildcards anyway.
  New Vercel preview URLs work without being added. If the Firebase API key has an
  HTTP-referrer restriction in Google Cloud Console, allow
  `https://*.vercel.app/*` there (referrer restrictions do accept wildcards).
- Set the five `NEXT_PUBLIC_FIREBASE_*` vars for both Production and Preview; the
  build fails without them. **Previews and production share one database**
  unless Preview gets a second project's values.
- Order: deploy the app, then the rules (`npx firebase deploy --only database
  --project <id>`, or paste `database.rules.json` into the console).

---

## First to Worst (`lib/games/ftw/`, `components/ftw/`, `app/ftw/page.tsx`)

A private 2-player ranking game, no login/accounts/lobby. Ported from the single-file
prototype at `references/ftw/first-to-worst.html` (source of truth for UI/flow/animations,
except where `references/ftw/first-to-worst-game-design.md` overrides it — scoring in
particular).

- `ITEMS_PER_ROUND` (`lib/games/ftw/constants.ts`) is the only place the "5 cards per
  round" rule is encoded. Never hardcode 5 in components or logic.
- `GAME_TITLE` (`lib/games/ftw/constants.ts`) is the working title shown in the UI. No
  logos or box art from the commercial game it's inspired by.
- Scoring is per-card exact match (see `references/ftw/first-to-worst-game-design.md`),
  not Jaccard/similarity. A round score of 4 is mathematically impossible — this is
  expected.
- **Players and seats (current behavior).** The first player into a fresh room types
  a name and takes the first free seat (p1 for the room's creator, unless someone
  else got there first). The second player takes the other seat. Names are stored
  per seat in the room's `players` node (not in FTW's game state, and not per
  device), and master/guesser rotate per round via `masterOf(round)`. A device
  that lost its guest ID sees both names. It can take one of those seats back once
  that player has been offline for 2 minutes; until then the seat shows "X is
  playing". "Reset game" restarts the game only; both players stay seated.
- **Custom prompts** are capped at `MAX_PROMPT_LENGTH` (120) and `MAX_ITEM_LENGTH`
  (60) characters, matching `database.rules.json`'s `ftw` validation. The built-in
  bank's longest prompt is 74 characters and its longest item 41.

**Everything below this point is history.** It predates the guest-ID rework (see
"Architecture" above for how seats, names, rooms and presence work now), and much
of it predates the Stage 1 multi-game refactor too, written when FTW was the entire app living at `app/page.tsx` with `lib/game.ts`,
`lib/scoring.ts`, `lib/prompts.ts`, `lib/constants.ts`, `lib/room.ts`, and
flat `components/*.tsx`. The content/decisions are all still accurate; only the
**paths** have moved (`lib/game.ts` → `lib/games/ftw/game.ts`,
`app/page.tsx` → `app/ftw/page.tsx`, `lib/constants.ts` → split into
`lib/games/ftw/constants.ts` (GAME_TITLE/ITEMS_PER_ROUND/NUMBER_GRADIENTS) and
`lib/session/types.ts` (Role), `lib/room.ts` → `lib/session/room.ts`,
`setName`/`names` logic → generic `lib/session/identity.ts`, the `ftw:me:<room>`
localStorage key → `me:ftw:<room>`, flat FTW components → `components/ftw/`, and the
Firebase path `games/{room}` → `games/{room}/ftw`). `Role` also moved from this
game's own constants to the shared `lib/session/types.ts`, since it's genuinely
game-agnostic.

### Post-launch additions

- **Prompt bank lives in `prompts.json`, grouped by category.** Originally a flat
  TS array where the "no more than 2 consecutive prompts share a group" constraint
  was baked into physical file order - editing it meant hand-picking an insertion
  point and re-running a one-off reorder script across the whole file, error-prone
  and not something a non-programmer could safely do. Now it's `{ "Category Name":
  [{ prompt, items }, ...], ... }` - adding a prompt is "find your category's array,
  add an entry", nothing else to think about. `prompts.ts` imports the JSON, flattens
  it, and interleaves groups via `interleaveByGroup()` (a "largest remaining bucket
  first" greedy pass) every time the module loads, so the ordering constraint is
  enforced by code, not by crafted file order - editing the JSON can never
  accidentally break it. `PromptEntry`'s `group` field stays dev-only either way
  (never shown in the UI).
- **Every category has at least 30 entries** (Romance & Flirting and Humor & Absurd
  Scenarios deliberately exceed it - 43 and 38 respectively - since they're the most
  replayed categories for a couples/friends game). Bank went from 300 to 1302 entries
  across 41 categories in one pass: ~930 new entries drafted by parallel agents (one
  per cluster of categories, each grounded with real examples pulled from that
  category so new entries matched the existing voice/format - open preference
  prompts stayed open preference, trivia-style categories like Geography/Space/
  History stayed factually-grounded trivia), then merged with a dedupe pass (19
  cross-batch duplicate prompt texts dropped, ~8 categories backfilled by a few
  entries each to clear 30 after dedupe) and validated against the same
  `prompts.test.ts` constraints as everything else. Verified live against real
  Firebase afterward (zero console errors across the full expanded bank).
- **Anime & Manga prompt category.** 51 entries, `group: "Anime & Manga"`.
  Deliberately narrow in *format*, not topic: every entry is a "pick your favorite
  from this list" prompt about a favorite anime/manga series, character, or
  power/technique - e.g. "Favorite anime protagonists" or "Coolest anime special
  attacks" - not trivia, genre overviews, or open-ended "what makes X good" prompts
  (an initial batch in that broader style was tried and replaced after feedback that
  it didn't fit the rest of the category). About half the entries are
  franchise-specific (Jujutsu Kaisen, Demon Slayer, Hunter x Hunter, One Piece,
  Naruto, My Hero Academia, Attack on Titan, Dragon Ball, Spy x Family, Chainsaw Man,
  Death Note, Fullmetal Alchemist - e.g. "Favorite Demon Slayer breathing styles",
  "Favorite type of Nen in Hunter x Hunter"), the rest are general-anime versions of
  the same three angles.
- **Pokémon prompt category (new group).** 30 entries, `group: "Pokémon"`, added
  alongside the 30-per-category expansion above. Same "pick your favorite" format as
  Anime & Manga - starters, types, Legendaries, Eeveelutions, regions, Gym Leaders,
  games, etc. - covering real Pokémon/games only, nothing made up.
- **No-repeat prompts within a session.** `GameState.usedPrompts` tracks
  every distinct prompt text seen this session - shuffled past, custom-written, or
  played - and is never allowed to shrink or duplicate (`addUsedPrompt`). `randomRound`
  takes that list and excludes all of it, so neither "Shuffle prompt"
  nor "Next round" repeats a prompt until the full bank (1302 entries as of the
  Pokémon/30-per-category expansion above) has come up once; after that it cycles,
  still avoiding an immediate repeat of the very last prompt. Tested: a full-bank
  cycle has zero duplicates, and a 60-shuffle Playwright run against the real UI came back with
  60/60 unique prompts.
- **Named players + master/guesser stickers.** *(Names now live in the room's
  `players` node and seats are guest-ID based. "Welcome back! Which one are you?"
  is now the takeover path for a device that lost its guest ID; see "Players and
  seats" above.)* Each player's display name, keyed by
  p1/p2 (not by role, since role rotates every round) is part of the shared room
  state, not local storage, and survives closing the browser or switching devices.
  `RolePicker` asks for a name instead of "I'm the master"/"I'm the guesser": the
  first player to open an empty room names themself and becomes p1, the second names
  themself and becomes p2; if both names are already set (a device that lost its
  local `me`), it instead shows "Welcome back! Which one are you?" with the two
  existing names - no retyping. `RoleStickers` renders two small pill badges ("👑
  Sam · Master", "🔎 Alex · Guesser") near the top of the board once both names
  exist, outlining whichever one is the current viewer. Names also replace the
  generic "Master"/"Guesser" text in `CardTable`'s column headers, `RoundBoard`'s
  status messages, and the footer identity line, falling back to those generic
  words for any name not yet set. Verified with a Playwright run across two tabs
  naming themselves live, a role swap flipping which sticker is highlighted, and
  the "new device" recovery flow.
- **Invite links + multi-pair rooms.** *(Now: a bare visit creates the room first,
  then writes its code into the hash; "New room" leaves the current room first. See
  `useRoom.ts`.)* A visitor with no `#room` in the URL at all
  used to silently land in a shared default room - fine for one pair, but two
  unrelated pairs would collide. `generateRoomCode()` now gets assigned to
  `window.location.hash` on first visit instead, via a `useEffect` that
  deliberately checks for the empty-hash case *before* touching the game store -
  otherwise the first render (still bound to the placeholder room) would read/write
  the wrong room for one tick before redirecting. The room's
  `useSyncExternalStore` subscription listens to the real `hashchange` event (not a
  no-op), so both this auto-redirect and the "New room" footer link (generates a
  fresh code, clears local `me`) actually trigger a re-render. `InviteLinkBanner`
  (clipboard copy of `window.location.href`, with a 2s "Copied!" confirmation)
  shows in the sticker's slot whenever the room doesn't have both players' names
  yet. Verified: two fully isolated Playwright contexts visiting with no hash land
  in two different rooms and play simultaneously against the real Firebase project
  with no data leaking between them, and clipboard-copy/"New room" both work
  end-to-end.
- **Session recap.** `GameState.history` (`RoundRecord[]`: round, prompt, score, who
  was master) gets one entry appended in `submitGuess` - the same place `totals`
  already updates - and is preserved through `nextRound`/`setPrompt` like every
  other field, reset to `[]` by `newGame`. `SessionRecap` renders it as a
  collapsible `<details>` list above the footer, each row showing the prompt in
  bold and round/master/score underneath.

### UI polish round

- **Removed "Change role" from the footer.** It was a dev-testing affordance
  (playing both sides in one tab) with no real use once two people are on two real
  devices - the "Welcome back, which one are you?" screen already handles a device
  that's lost its local `me` without it.
- **Board withheld until both players have joined.** The game page renders
  `InviteLinkBanner` instead of `RoundBoard`/`SessionRecap` whenever `!bothJoined`,
  so a lone first player can't start ranking before their partner is actually in
  the room.
- **Primary action pinned to the screen, not just "stuck" on scroll.**
  `RoundBoard`'s hand+submit (while placing) and "Next round" (once revealed)
  render in a `position: fixed; bottom: 0` bar instead of flowing at the end of a
  tall card table - `position: sticky` was tried first but only locks in place
  once you've scrolled far enough to reach it. Because a `fixed` bar is pinned to
  the *viewport*, not to `RoundBoard`'s own box, it also covers whatever else is at
  the bottom of the screen once scrolled all the way down - including the Footer.
  The bottom-clearance padding for this therefore lives on `<main>` in the game's
  page component, not inside `RoundBoard`. Card/slot sizing also shrank from
  `min(17vw,76px)` to `min(15vw,68px)` so 5 hand cards always fit on one row even
  at 375px.
- **Drag-and-drop to place cards**, additive to tap-to-place (not a replacement -
  if a gesture never exceeds an 8px threshold it falls through as a normal
  click/select). Built with native Pointer Events, not the HTML5 Drag and Drop API,
  which doesn't fire on touchscreens at all. `CardSlot` exposes `data-drop-id`
  (only when a slot is actually interactive) so the drop handler can hit-test via
  `document.elementFromPoint(...).closest("[data-drop-id]")` instead of threading
  refs through `CardTable`. Dropping a HAND card on an already-filled "mine" slot
  overwrites it, and the displaced number simply reappears in hand. Verified with
  real mouse-event sequences (move/down/move/move/up, not just `.click()`).
- **Drag-and-drop to reorder already-placed cards**, a later user-requested
  addition: a placed card can be picked up directly off the board and dragged to a
  DIFFERENT slot in one gesture, not just tap-to-remove-then-tap-to-replace.
  `RoundBoard.tsx`'s old hand-only `handleDragStart` became a shared
  `startDrag(n, fromSlotId, e)` (`fromSlotId` is `null` for a hand card, a slot id
  for a board card), with `handleDragStart`/`handleBoardDragStart` as thin wrappers
  - `CardSlot` gained an `onDragStart` prop (wired via `onPointerDown`, only when
  the slot actually holds a card - nothing to pick up from an empty one) threaded
  through `CardTable`'s new `onDragMaster`/`onDragGuesser` props, gated the same
  `placing && isMaster`/`!isMaster` way `onTapMaster`/`onTapGuesser` already are.
  Dropping a board card on an EMPTY slot moves it there (clearing the source);
  dropping it on another FILLED slot swaps the two cards, so a full reorder never
  has to round-trip through the hand - distinct from the hand-drop case above,
  which still just overwrites-and-displaces-to-hand. Dropping on itself, or
  releasing over nothing droppable, is a no-op (the card was never removed from
  `assign` during the drag itself, only on a confirmed valid drop, so an aborted
  drag can't lose it). Verified live: the exact move-move-move sequence the user
  described (card 1 to an empty slot, card 3 into the now-empty first slot, card 1
  into the now-empty third slot) producing the right final board state at each
  step, a genuine swap onto an occupied slot, and that plain tap-to-select/-place
  and tap-to-pick-up are completely unaffected.

### Status

A chronological log. Entries describe what was true when they were written; the
"Architecture" section at the top of this file is the current state.

- **Stage 1 (done):** static card-table UI in local component state, including the
  3D flip animation and the full RANKING → GUESSING → REVEALED loop.
- **Stage 2 (done):** scoring and state-machine as pure, tested functions
  (match scoring incl. the all-permutations "4 is impossible" check,
  and valid/invalid state transitions). UI reads/writes through the store
  (localStorage + `storage` event), verified across two real tabs
  with Playwright: independent role pick, live cross-tab sync, and state restored
  after a hard refresh.
- **Stage 3 (done):** the Firebase store implements the same `Store<T>`
  interface against Realtime Database (modular SDK). Picks Firebase when all five
  `NEXT_PUBLIC_FIREBASE_*` env vars are set, else falls back to localStorage -
  verified both ways, including real cross-device play against the actual Firebase
  project.
- **Stage 4 (done):** 300 built-in prompts, later expanded to 1302 (see
  "Anime & Manga prompt category" above) (each validated to have exactly
  `ITEMS_PER_ROUND` unique items) back "Shuffle prompt" and "Write my own prompt"
  (validated client-side with an inline error). "Next round" picks a random prompt
  that's never the one just played. Reduced motion verified with Playwright's
  `reducedMotion: "reduce"` emulation.
  **Bug fixed in this pass:** the master/guesser slots were both wired to the same
  tap handler regardless of whose turn it was, so clicking the *other* player's
  empty slot while placing could silently consume your selected card. Fixed by
  only wiring a column's tap handler when it's actually interactive for the
  current viewer right now.
- **Stage 5 (done):** README covers Firebase setup, recommended Realtime Database
  rules, the five env vars, known limitations (no auth/anti-cheat, the score
  quirk, role selection being per-tab not per-room), Vercel deployment, and
  renaming via `GAME_TITLE`. All 5 build stages from the original brief are
  complete.
- **Multi-game platform Stage 1 (done):** the shared `lib/session/` + `lib/store`
  refactor described at the top of this file. FTW moved from `/` to `/ftw` with
  zero behavior change — verified by re-running every existing Playwright
  regression script (cross-tab sync, names/stickers, invite/recap, drag-drop,
  reduced-motion) against `/ftw` and a real-Firebase two-pair/four-player test
  confirming the new nested `games/{room}/ftw` path works and isolates correctly.
- **Multi-game platform Stage 2 (done):** `lib/games/registry.ts` (`APP_TITLE`,
  originally "Game Night" and later renamed to "Game Room" once the platform grew
  games unrelated to romance/relationships - see below - + a flat `GAMES` array)
  backs a new `app/page.tsx` - a server
  component listing games as link cards to `/<slug>`, replacing the Stage 1
  redirect. `Footer` gained an "All games" link back to the picker. Root
  `metadata.title` switched from FTW's `GAME_TITLE` to the platform's
  `APP_TITLE`. Verified: `/` renders the picker with no redirect, clicking into
  First to Worst lands on a fresh room, "All games" returns to the picker, and
  the browser back button restores the room (hash intact) - standard navigation
  history, no special-casing needed. Re-ran the FTW regression suite to confirm
  the Footer addition didn't break anything.
- **E-Card, a second game, was built (Stages 3-5 of the multi-game platform
  plan) and then removed.** It was a 12-round Emperor/Citizen/Slave bluffing
  game adapted from *Kaiji*, fully built with its own `lib/games/ecard/` state
  machine, `components/ecard/` UI, and `app/ecard/page.tsx`, verified end-to-end
  including real cross-device Firebase play. Pulled after playtesting: the
  bluffing tension depends on reading your opponent's face in person, which
  doesn't translate to playing on separate phones. Removed cleanly via the
  "adding a new game" pattern in reverse - delete its three directories, drop
  its `lib/games/registry.ts` entry, nothing shared needed to change. The one
  thing worth keeping from it is the Realtime Database gotchas above (now
  folded into "Store design notes"), since those apply to any future game, not
  just that one.
- **Platform renamed "Game Night" → "Game Room".** `APP_TITLE`
  (`lib/games/registry.ts`) drives the picker's title and root `metadata.title`, so
  this was a one-line change there. Done because future games don't have to be about
  romance/relationships the way FTW is - the two shared components that still said
  "partner" (`RolePicker`'s "Your partner joins next..." and `InviteLinkBanner`'s
  "Waiting for your partner to join?") were reworded to "the other player" for the
  same reason, since any future game reuses those as-is. FTW's own in-game copy
  (footer identity line, round status text, etc.) still says things like "Master"/
  "Guesser" and keeps its own relationship-flavored prompt content - only the
  platform-level chrome and shared components changed, not FTW itself.
- **Multi-game platform Stage 6 (done): responsive FTW, themed invite links, join
  by room code.** Three user-requested changes.
  - **FTW grows on desktop.** `lib/games/ftw/constants.ts` gained its own
    `CONTAINER_MAX_WIDTH_CLASS` (`520px` mobile, unchanged, growing to `760px` by
    the `lg` breakpoint) - duplicated from Co-Counsel's identical-in-spirit
    constant rather than imported, consistent with this repo's per-game-layout
    convention. Applied to both `app/ftw/page.tsx`'s `<main>` and
    `RoundBoard.tsx`'s fixed bottom action bar (a separate `position:fixed`
    stacking context that needs the same class applied directly to stay aligned,
    same reasoning as `PartScreen`'s fixed bar in Co-Counsel). Verified the two
    stay pixel-aligned at a 1280px viewport via a live two-device Playwright
    game, not just visually.
  - **`InviteLinkBanner`'s button is themed per game**, not hardcoded to FTW's
    pink everywhere. Gained `accentColor`/`accentShadowColor`/`accentTextColor`
    props, defaulting to FTW's existing pink/dark-pink/white so FTW's call site
    (which passes none of them) stays pixel-identical; Co-Counsel's page passes
    `COLOR.yellow`/`COLOR.ink`/`COLOR.ink`, so its invite screen reads as
    Co-Counsel rather than FTW (and tracks Co-Counsel's own dark-mode toggle,
    since `COLOR.ink` is itself a `var(--cc-ink)` reference). The colors override
    `Button`'s own classes via an inline `style` prop (higher specificity than a
    Tailwind arbitrary-value class), so `Button.tsx` itself needed no changes.
  - **Join a room by code, from the picker.** `lib/session/roomMeta.ts` (since replaced by `lib/session/shared/roomActions.ts` + `updates.ts`) is a new
    shared-session module (see "Multi-game architecture" above for the full
    design) recording which game a room belongs to, plus an optional display
    name; `useGameSession` now exposes `roomName`/`setRoomName`.
    `components/JoinRoomForm.tsx` is a new box on the picker page (`app/page.tsx`)
    - type a code (or paste a whole invite link; it strips everything before the
    last `#`), and it looks up that code's `RoomMeta` and routes straight to
    `/${gameSlug}#${code}` with no "which game?" prompt needed. An unrecognized
    code shows an inline "we couldn't find that room" error instead of
    navigating. The optional room name is set from `InviteLinkBanner` itself (a
    "Name this room (optional)" field, pre-filled with any existing name, saving
    on blur) - showing the raw code as the field's placeholder is the "defaults
    to the ID" behavior; no separate placeholder/default-value plumbing needed,
    since consumers (`Footer`, both games') just render `roomName || room`
    wherever they'd previously shown the bare code. The store layer gained a new
    `Store<T>.readOnce()` method for this (see "Store design notes") - a one-off
    backend read, since the join form has no live subscription to a typed-in
    code's room to read a cache from. Verified live: FTW's and Co-Counsel's rooms
    both round-trip through naming (persists across a reload, shown correctly in
    both games' Footers) and joining (routes to the exact right game and room for
    both), a bogus code shows the inline error without navigating, and zero
    console errors throughout.
- **Multi-game platform Stage 7 (done): Game Room picker redesign, join by room
  name.** Went through two passes - the first matched only the mobile mockup
  (missed the desktop mockup's two-column layout entirely, caught when the user
  pointed at `references/game-room/Game Room, desktop@2x.png` directly); the
  second was a ground-up rebuild against `references/game-room/game-room-ui-spec.md`
  once the user pointed at that file specifically, since it turned out to
  specify far more precisely than the mockup images alone conveyed (exact
  breakpoint, dimensions, colors, states, motion, accessibility) - **including
  that the card art should be code-drawn, not cropped screenshots**, reversing
  the "use the reference PNGs directly" choice from the first pass (`public/
  games/*.png` deleted).
  - **Layout matches the spec's own breakpoint (760px, not Tailwind's `md:`
    768px) via arbitrary `min-[760px]:` variants throughout**, not Tailwind's
    built-in breakpoints - `app/page.tsx` sets its own `#0F7983` background
    (deliberately distinct from FTW's `--table` `#128A94`, per spec, so white
    text keeps 4.5:1 contrast - set on a wrapper div, `app/globals.css`'s
    `--table` itself untouched), exact page padding (40/56/32px desktop,
    24/16/24px mobile), and a flex-wrap card row (340px cards, 56px gap,
    centered) that collapses to a single stacked column (max 440px, 20px gap,
    no tilt) under 760px - the same flex-wrap mechanism the spec says handles
    a 3rd+ game later, so no extra breakpoint logic needed for that case.
  - **`lib/games/registry.ts`'s `GameEntry` redone to match the spec's per-game
    token table exactly**: `ink` (title/chip-border/button-border-shadow-text
    color), `textSecondary` (description color), `accentColor` (button fill),
    `titleClassName`/`buttonTextClassName` (font family/weight/tracking/size,
    e.g. Co-Counsel's Archivo 800 with `-0.02em` tracking vs FTW's default
    Fredoka 700) - `image`/`emoji` dropped (no longer used).
  - **`components/GamePickerCard.tsx`** rebuilt to the spec's exact card chrome
    (20px/18px radius, padding, two-layer shadow) and motion (resting tilt
    alternating -1.5°/+1.5° by card index, **desktop-only** - applied via a
    `--tilt` CSS custom property consumed by an arbitrary-property class gated
    behind `min-[760px]:`, not an unconditional inline `transform`, so it
    genuinely doesn't exist below that breakpoint rather than just resetting to
    0; straightens + lifts 6px on hover/focus, `motion-reduce:` disables the
    transition). New `components/gameRoom/FtwArt.tsx` (the fanned five-card
    hand, numerals gradient-filled via `background-clip:text` reusing
    `NUMBER_GRADIENTS` from `lib/games/ftw/constants.ts` directly rather than
    duplicating those hex values) and `CoCounselArt.tsx` (the blue/red split
    panel, two mini claim cards, and the yellow "lens" mark) - both render two
    full size variants (desktop/mobile numbers), toggled by visibility classes
    at the 760px breakpoint, rather than stacking responsive arbitrary-value
    classes on every one of the many positioned elements.
  - **`components/JoinRoomForm.tsx` rebuilt around the spec's single-input +
    Code/Name switch design**, replacing the previous two-separate-fields
    version. The switch (`role="radiogroup"`, two `role="radio"` segments,
    left/right arrow keys move the selection) only changes the placeholder/
    helper text/`aria-label` - **the lookup itself always tries the typed value
    as a room code first, then as a room name**, per the spec's "Behavior"
    section, so getting the switch "wrong" still works. Each mode keeps its own
    typed value in separate state (`codeValue`/`nameValue`) so switching back
    restores what was there, while switching away starts that mode fresh - a
    simpler equivalent to the spec's stated behavior than explicitly tracking
    "did this value survive a mode switch." Exact states implemented: default/
    disabled-until-typed, busy (`aria-busy`, disabled switch/input/button,
    `cursor:progress`), not-found (red border, `aria-invalid`, `role="alert"`
    linked via `aria-describedby`, cleared on edit or mode switch). One addition
    beyond the spec (which assumes a single match): 2+ rooms sharing a name
    render an inline disambiguation list instead of guessing, carried over from
    the user's standing requirement that the spec itself doesn't mention.
    `lib/session/roomMeta.ts`'s `roomsByName` index (now a unique `roomsByName/{nameKey}` entry - see Architecture) (and the Firebase rule it
    needs - see README's "Database rules") is unchanged from the first pass.
  - Verified live: desktop/mobile/exact-760px-edge screenshots against both
    mockup images: switch keyboard nav and ARIA state; join-by-code, by a
    unique name, by an ambiguous name (two real rooms, one FTW one Co-Counsel,
    both actually named identically) showing the disambiguation list with both
    routing correctly; the not-found error state and its clear-on-edit
    behavior; card click-through with the per-game `aria-label`. Zero console
    errors throughout, `tsc`/`eslint`/`vitest`/`next build` all clean.
- **Multi-game platform Stage 8 (done): Co-Counsel temporarily hidden from
  the picker.** User-requested. `lib/games/registry.ts`'s `GAMES` array has
  its `cocounsel` entry commented out, not deleted - a one-line uncomment
  re-enables it. The game itself is completely untouched: `/cocounsel`
  still loads and plays normally for anyone with a direct link (confirmed
  live), including a room created before this change; `JoinRoomForm`'s
  `gameTitle()` helper falls back to the raw slug (`"cocounsel"`, not
  `"Co-Counsel"`) if someone joins such a room by code/name while it's
  hidden, a minor, accepted display-only side effect of hiding it this way
  rather than a bug (the same fallback now applies to `YourRooms` rows). Unlike
  E-Card's removal (above), no directories were
  deleted, no state machine or components were touched, and nothing about
  `lib/session/`'s shared layer changed - this is a pure picker-listing
  toggle.
- **Multi-game platform Stage 9 (done): guest IDs, locked-down database rules,
  onDisconnect presence, "Your rooms".** Implemented from
  `references/new-system-design.md`. The current design is fully described in
  "Architecture" at the top of this file. In summary:
  - **Guest IDs**: Firebase Anonymous Auth; the local-mode fake uid lives in
    sessionStorage (per tab).
  - **Room data model**: `meta`/`seats`/`members`/`players`/`presence`/
    `lastActive` at room level, and `users/{uid}/rooms`. Seat writes are
    multi-path updates built by `lib/session/shared/updates.ts`.
  - **Presence**: onDisconnect instead of the heartbeat.
  - **Room names**: unique (`roomsByName/{nameKey}`), so the join form's
    disambiguation list is gone.
  - **Hub additions**: "Your rooms" with the iOS Home Screen tip, a manifest, and
    icons.
  - **Room-page additions**: the in-app browser banner and the local-mode banner.
  - **Build guard**: a Vercel build without the Firebase vars fails.
  - **Rules tests**: 86 emulator tests, wired into CI.

  **Decisions made with the user before building** (where the spec conflicted with
  the code):
  - The user supplied `database.rules.json`, and it was then tested and fixed
    against the emulator.
  - Only the creator names or renames a room, later, from `InviteLinkBanner`.
  - Seats persist across game resets, and Co-Counsel's "Switch role instead"
    became an atomic swap.
  - Creating a room seats nobody.
  - 3+ seats are tested via an in-memory `mptest` slug.

  **Rules changes made over the user's original file** (each proven by a test):
  - The creator rename, with `meta/nameKey` required to match a `roomsByName`
    entry that points at the room.
  - The creating update may write the game state.
  - The swap branch, in `seats` and `members`.
  - A takeover hole: the taker's old seat must be vacated, or one uid could hold
    two seats.
  - `users/$uid/rooms` must be an object.
  - Full `ftw`/`cocounsel` `.validate` rules.

  **Verified** against the Auth + Database emulators (see Testing). The live
  deploy hit one problem: the rules went out before the new client, so the old
  client's room creation was refused (see "Deploy order matters").

---

## Co-Counsel (`lib/games/cocounsel/`)

A 2-player cooperative asymmetric deduction game, fully specified in
`references/co-counsel/co-counsel-game-design.md` (rules, scoring, launch case
content) and `references/co-counsel/co-counsel-visual-spec.md` (design tokens,
component specs, screen-by-screen copy, motion, accessibility) - read those first for
anything not covered here. One player is the **Investigator** (external evidence),
the other the **Defendant** (internal facts); each "Part" of a case, both secretly
lock in one card, trying to find the matching pair while talking out loud.

- **Seats (current behavior).** Seats live at room level and persist through
  "Rematch"/"Start a new case". The second player is auto-assigned the remaining role
  (an effect in `app/cocounsel/page.tsx`, guarded by `pickingRef` against racing
  this device's own click). "Switch role instead" on `ConfirmRoleScreen` (shown on
  rejoining a still-fresh case) calls `handleSwitchRole`: an atomic seat swap when
  both are seated, or a move to the empty role. Character names stay with the role,
  because they're the case's fixed names. When both roles are held by other guests,
  `RolePicker` enables a role only once its player has been offline for 2 minutes
  (takeover).
- **Reuses the 1v1 `useGameSession`/`Role`/`WithIdentity` session layer unchanged** -
  this is still fundamentally a 2-player game, just with a different
  identity-claiming UI than FTW's name-entry `RolePicker` (players pick "I'm the
  Investigator"/"I'm the Defendant", no name input - the in-story character names are
  fixed by the case data, not typed). `Investigator = Role "p1"` and
  `Defendant = Role "p2"` are **fixed** constants in `constants.ts` (unlike FTW's
  `masterOf(round)`, these never rotate within a case).
- **Case content lives in `cases.json`**, one file holding every case keyed by ID
  (currently just `"ruined-birthday"`) - same "one JSON file, not one-per-entry"
  shape as `lib/games/ftw/prompts.json`, for the same reason: content someone should
  be able to hand-edit without touching code. `cases.ts` casts the import once
  (`casesJson as unknown as CaseBank` - JSON imports infer widened types like `string`
  instead of a literal union or `string[]` instead of a tuple, so the cast has to go
  through `unknown` first) and exports `CASES`/`getCase(id)` so nothing else repeats
  that cast. `caseTypes.ts` has the full shape (`CaseDefinition` → `CasePart` →
  `screens`/`hands`/`correct`/`traps`/`theory`, plus `characters: {investigator,
  defendant}` - implied throughout the design doc's prose but missing from its shown
  JSON schema, added here since the UI needs it and must never hardcode "Maya"/"Leo").
- **`caseValidator.ts`** implements the design doc's 8 "Validator checks", run
  against the real `cases.json` in `caseValidator.test.ts` (mirrors how
  `prompts.test.ts` validates `prompts.json`). One deliberate deviation from the
  doc's literal wording: it says a memory-lure card should appear "from Part 2
  onward", but the shipped case's own Part 2 has zero memory-lure cards (only Part 3
  does) - Part 2 is the first Part with *any* earlier-Part facts to misremember in
  the first place (Part 1 has none), so the validator's rule is "once the memory-lure
  mechanic has appeared anywhere earlier in the case, every later Part must keep
  using it" rather than a flat "every Part 2+", which would incorrectly flag the
  shipped content. The content itself was transcribed verbatim, not changed, to
  match this looser (and more accurate) rule.
- **`game.ts`** follows the same pure/throw-on-invalid-transition pattern as
  `lib/games/ftw/game.ts`. `Phase` is `"SELECTING" | "REVEALED" | "CASE_DONE"` -
  simplified from the design doc's 4-value list (`SELECTING`/`REVEALED`/
  `PART_DONE`/`CASE_DONE`), since `PART_DONE` and `REVEALED` render the same
  card-flip screen with only the heading/button differing, driven by
  `lastReveal.outcome` (`"solved" | "retry" | "judgeRevealed"`) rather than a
  separate phase value. `lockIn(game, caseDef, role, cardId)` resolves the pair the
  moment both roles have locked in; a miss increments `attempts`, and the 2nd miss
  sets `outcome: "judgeRevealed"` - `lastReveal` then holds the *correct* pair to
  display instead of what was actually played, matching "the judge simply reveals
  the correct pair, no hint." `continueAfterReveal` rebuilds the returned object
  explicitly (not `{...game, lastReveal: undefined}`) to clear `lastReveal` - the
  same Firebase-rejects-explicit-undefined lesson from E-Card's `continueRound`.
  Scores are **derived, not stored**: `trustPercent`/`focusPercent`/`classifyDuo`
  are pure functions over `log`, computed from the doc's exact formulas and clamped
  to `[0,100]` (the raw Focus formula can go negative if a Part has more focus flags
  than Part-2+ lock-ins so far - clamped rather than shown as a negative percent).
  Flag computation (`flagsFor`) looks up where a contradicted fact ID lives: same
  Part + partner's screen → Trust flag; earlier Part (either screen) → Focus flag;
  same Part + the card-holder's own screen → no flag, just a wrong answer.
- **Firebase empty-array/empty-object lesson applied from the start** (not
  rediscovered the hard way like E-Card): `locks: Partial<Record<Role,string>>` and
  `log: AttemptLogEntry[]` both start empty and both get normalized on every read
  (`normalizeGame`) before use, since RTDB drops empty arrays *and* empty objects on
  write (see "Store design notes").

### Status

A chronological log. Entries describe what was true when they were written; the
"Seats (current behavior)" bullet above and "Architecture" at the top of this file
describe the current state. In particular, the seat mechanics in Stages 2, 5, 9, 10
and 11 (names in game state, the `hadNameRef` self-heal, `releaseAllIdentityNames`,
re-picking roles after a rematch) were replaced by the guest-ID rework (Stage 12).

- **Stage 1 (done):** case data (`cases.json`), types (`caseTypes.ts`), the
  validator (`caseValidator.ts`), and the game state machine (`game.ts`) - no UI yet.
  36 Vitest cases: schedule/transition correctness, hand/turn-order rejection, the
  documented Part 1 trap pair's exact flag outcome, Focus-flag computation against
  the documented Part 3 memory lures, the judge-reveals-after-2-misses path, every
  validator check (including that the real shipped case passes cleanly), and a full
  first-try playthrough of the whole case reaching a 100%/100% "Mind-Reading Team"
  result. Verified: zero diff to any existing `lib/session/*` or `lib/games/ftw/*`
  file.
- **Stage 2 (done):** the UI - `components/cocounsel/` (`Wordmark`, `Button`,
  `Stamp`, `ExhibitTent`, `ClaimCard`/`Hand`, `TranscriptSheet`, `PartProgress`/
  `HeaderBand`, `ResultsHeader`, `RevealCard`, `CasePicker`, `RolePicker`,
  `PartScreen`, `RevealScreen`, `VerdictScreen`, `RecapScreen`, `Footer`) and
  `app/cocounsel/page.tsx`. An entirely new visual system from FTW's, per the
  visual spec: three new `next/font/google` loaders (Archivo, Archivo Narrow,
  Courier Prime) added in `app/layout.tsx` alongside Fredoka without touching
  `body`'s font (every Co-Counsel component opts in via `font-[family-name:...]`
  utilities instead), and `lib/games/cocounsel/theme.ts` holding the design doc's
  exact hex/radius tokens as plain named exports - same "inline Tailwind arbitrary
  values, no CSS variable theme layer" convention as every other game's components
  here, just a new palette. `RevealCard`'s flip reuses the literal `flip-inner`
  class name from `components/ftw/CardFace.tsx`'s technique (new component, same
  mechanics) so it inherits the existing global `prefers-reduced-motion` override
  for free; two new keyframes (`stamp-land`, `card-lift`) were added to
  `app/globals.css` alongside FTW's, with their own reduced-motion disable.
  `RolePicker` (role-only, no name entry - the case fixes character names) and
  `Footer` are new Co-Counsel-specific components, not the shared `components/`
  ones, since nothing about this game's visual language matches FTW's. One
  deliberate deviation from FTW's gating pattern: the role-pick screen shows
  whenever `!bothJoined` (not `!me`), so "Rematch with swapped roles" (which resets
  `names` to `{}`) re-prompts *both* devices to pick a role, even the one whose
  local `me` is still set from the previous game - otherwise that device would get
  stuck seeing a stale waiting screen instead of a chance to pick again.
  Verified end-to-end against real Firebase with two isolated browser contexts: the
  full 3-Part case (a first-try solve, a trap-then-retry solve, and a forced
  judge-reveal after 2 misses - confirming the judge shows the *correct* pair, not
  what was actually played), the verdict screen's Trust/Focus/duo classification,
  the recap screen, and that a rematch correctly re-prompts both devices for a
  role. Also verified: `prefers-reduced-motion` disables both the card flip and the
  stamp-land animation, and the hand's `radiogroup`/`radio` roles +
  `aria-checked` + `aria-live` regions all behave correctly. Confirmed FTW is
  unaffected by the shared `app/layout.tsx`/`app/globals.css` additions via a live
  two-device FTW playthrough.
- **Stage 3 (done, post-launch polish):** four user-requested changes, entirely
  scoped to `lib/games/cocounsel/`/`components/cocounsel/`/`app/cocounsel/page.tsx`
  - zero diff to any file outside that tree.
  - **Back button.** `components/cocounsel/BackButton.tsx` - a fixed-position
    `←` link to `/`, rendered once in the page (not threaded through every
    screen component, unlike the shared 1v1 `Header`'s inline approach, since
    Co-Counsel's screens don't share one common header shape). `<main>` carries
    `pt-14` top clearance so the button never overlaps the Wordmark logo or a
    role-colored band's own top-left text.
  - **White, responsive layout.** `COLOR.paper` changed from the visual spec's
    `#EEF0F6` to `#FFFFFF` (a deliberate, documented deviation from the spec,
    per user request) - a single token change, since every consumer of
    `COLOR.paper` (the page background, the bottom action bar, the stamp's
    masking background) was already semantically "match the page background."
    `CONTAINER_MAX_WIDTH_CLASS` (`lib/games/cocounsel/theme.ts`) replaces the
    old fixed `max-w-[480px]`: `480px` on mobile (unchanged - "perfect for
    phone") growing to `720px` by the `lg` breakpoint, shared between the main
    page wrapper and `PartScreen`'s fixed bottom bar (a separate
    `position:fixed` stacking context that can't inherit the page's width, so
    it needs the same class applied directly to stay aligned).
  - **3 tries per case, not 2 per Part.** `MAX_ATTEMPTS_PER_PART` (2) renamed
    to `MAX_CASE_ATTEMPTS` (3) in `constants.ts` - a deliberate deviation from
    the design doc's "2 attempts per Part" (its own "Still Open" section
    already flagged this exact number as worth revisiting after a real
    playthrough). The fix was almost entirely a one-line change:
    `continueAfterReveal` no longer resets `attempts: 0` when advancing to the
    next Part, so the existing "miss count hits the max → judge reveals"
    check in `lockIn` automatically became case-wide instead of per-Part,
    with no other logic changes needed. The judge can now trigger on the very
    first miss of a Part if an earlier Part already spent the rest of the
    budget - verified with a dedicated cross-Part accumulation test
    (`game.test.ts`) and confirmed live against real Firebase.
  - **The link-sharer picks the case.** Previously every device independently
    saw (and had to tap through) the case-picker screen, even though it's
    just a confirmation tap in v1 (one real case). Now only the device that
    visits with no `#room` in the URL at all - the one about to generate a
    fresh room and share its link - sees it; a device that opens an existing
    link skips straight to role-pick. Implemented via a `useState` lazy
    initializer reading `window.location.hash` (runs synchronously on the
    very first client render, strictly before any effects - including
    `useGameSession`'s own hash-generating effect - so it reliably observes
    the hash before that effect can rewrite it). **Hit and fixed a real
    hydration bug while building this**: the `showCasePicker` check was
    initially placed *before* the existing `!game` loading-gate in the
    screen's ternary chain, so it could render `CasePicker` before `game` had
    resolved from `null` - a moment that's supposed to be universally
    identical between server and every client (that's what makes the `!game`
    branch hydration-safe to begin with) - producing a real "Hydration failed"
    console error on the creator's own first load. Fixed by reordering the
    ternary so `!game` is checked first, unconditionally, restoring that
    universal-first-paint guarantee. `handleNewRoom` resets the captured flag
    (via the state setter, from a plain click handler - not an effect) so
    generating a fresh room via "New room" correctly makes that device the
    creator of the *new* room, independent of whatever it was for the old one.
- **Stage 4 (done, consistency pass):** three more user-requested changes, again
  entirely scoped to `lib/games/cocounsel/`/`components/cocounsel/`/
  `app/cocounsel/page.tsx`/the Co-Counsel-only block in `app/globals.css` - zero
  diff to FTW, the picker, or the shared session layer.
  - **Copy-link step matches FTW's, as its own separate screen.** The page's
    branching now mirrors FTW's exact `!game → !me → !bothJoined → playing`
    shape, with `showCasePicker` inserted ahead of it:
    `!game → showCasePicker → !me → !bothJoined → playing`. `!me` shows
    `RolePicker` (pick a role); `!bothJoined` now shows the literal shared
    `components/InviteLinkBanner.tsx` (unchanged, not a Co-Counsel reskin) -
    previously `!bothJoined` went straight back to `RolePicker` a second time,
    with no distinct "waiting, copy the link" step at all. `CasePicker` and
    `RolePicker` both had their embedded "Room X" / copy-link UI stripped
    entirely (that's `InviteLinkBanner`'s job now, one step later, same as
    FTW's own `RolePicker` not showing a room code either) - `CasePicker` is
    now purely about the case, `RolePicker` purely about the role.
  - **Back button matches FTW's style.** `BackButton.tsx`'s classes now
    literally match the shared `Header`'s back-link (`bg-black/40`, `h-9 w-9`,
    no `backdrop-blur-sm`) - still `position: fixed` rather than threaded
    inline per-screen like FTW, since Co-Counsel has no single shared header
    component the way FTW does (its screens split between `Wordmark`-topped
    screens and full-bleed `HeaderBand`/`ResultsHeader` colored bands).
  - **Co-Counsel-only manual light/dark toggle** - deliberately *not* shared
    platform infrastructure; FTW is completely untouched and may get its own
    independent toggle later if ever wanted. `lib/games/cocounsel/useTheme.ts`
    holds `type ThemeMode = "light" | "dark"` state backed by `localStorage`
    under the Co-Counsel-specific key `"cocounsel-theme"`. Unlike the
    `isCreator` lazy-`useState`-initializer pattern (safe only because the JSX
    depending on it stays gated behind `!game`), the theme is applied as a
    `data-theme` attribute directly on the page's root wrapper div, which
    renders unconditionally from the very first paint - so a lazy initializer
    reading `localStorage` would hydration-mismatch for any returning
    dark-mode visitor. `useTheme` instead starts at `"light"` on every render
    (server and client's first paint alike) and only reads the real stored
    value inside an effect via `setTimeout(fn, 0)` - the same
    deferred-first-setState pattern `useGameSession`'s `now` tick already
    uses - so a stored "dark" preference applies as a same-tick correction
    right after mount instead of a server/client mismatch.
    `components/cocounsel/ThemeToggle.tsx` is a sun/moon button mirroring
    `BackButton`'s fixed top-left circle on the opposite (top-right) corner.
    The swap mechanism needed no `dark:` Tailwind variant or
    `@custom-variant` opt-in: every Co-Counsel component already reads colors
    via `style={{color: COLOR.xxx}}`, never Tailwind color utility classes
    (confirmed and enforced - see the `bg-white` note below), so
    `lib/games/cocounsel/theme.ts`'s **neutral/surface** tokens (`ink`,
    `paper`, `white`, `text2`, the card-edge/rule/gutter/disabled tokens)
    became `var(--cc-xxx)` references, a source-of-truth-only change with
    zero edits to any of their ~15 consuming files, since CSS variables
    resolve at paint time regardless of which theme is active. Brand/role
    colors (`investigator`/`defendant`/`yellow`/`green`/`amber`) stayed plain
    hex - already saturated enough to read on a dark background, and part of
    the game's identity rather than an eye-strain concern. `app/globals.css`
    gained a "Co-Counsel:" scoped `:root { --cc-ink: ...; }` (light) +
    `[data-theme="dark"] { --cc-ink: ...; }` block, following the existing
    `stamp-land`/`card-lift` precedent of Co-Counsel-only rules living in
    that same shared file.
    **Bug found and fixed while verifying dark mode live**: seven components
    (`ClaimCard`, `CasePicker`, `VerdictScreen`, `RecapScreen` ×2,
    `TranscriptSheet`, `PartScreen`, `RevealScreen`) used Tailwind's literal
    `bg-white` utility class for card surfaces instead of `COLOR.white`,
    which is exactly the "never Tailwind color utility classes" rule this
    whole mechanism depends on - undetectable by any automated check (tsc/
    eslint/vitest/build all passed with it in place), only visible by
    actually loading dark mode in a browser: those cards stayed hardcoded
    white while their `COLOR.ink` text turned light, becoming unreadable.
    Fixed by moving every instance to `style={{backgroundColor: COLOR.white}}`.
    Verified via a live two-device Playwright run: the restructured flow
    end-to-end (case pick → role pick → shared `InviteLinkBanner` while
    waiting, confirmed via its own text rather than a custom box → second
    device joins → play proceeds), confirming neither `CasePicker` nor
    `RolePicker` show any room-code/copy-link UI; dark mode toggled and
    confirmed to persist across a reload; screenshots of the case-picker,
    role-pick, invite-link, and a Part screen in both themes (including the
    `bg-white` fix); zero console errors throughout. A quick FTW regression
    check confirmed its background/fonts/lack-of-theme-toggle are completely
    unaffected.
- **Stage 5 (done): running out of attempts ends the whole case, not just the
  current Part.** Previously the judge revealing the correct pair after the 3rd
  total miss was a "freebie" - play continued to the next Part exactly as if it
  had been solved, eventually reaching the normal celebratory `VerdictScreen`
  regardless of how many Parts were actually judge-revealed. Now it's a genuine
  loss state.
  - **`game.ts`**: `AttemptOutcome`/`RevealInfo.outcome` split the old single
    `"judgeRevealed"` cap-reached case into two. Reaching the cap on the case's
    **last** Part is still `"judgeRevealed"` (the correct pair IS shown, same as
    before). Reaching it on an **earlier** Part is now `"adjourned"` - shows what
    was actually *played*, not the correct pair, since "only give the final
    answer if they fail at the last Part" per the design rule. `continueAfterReveal`
    sends *either* straight to `CASE_DONE` regardless of Part index (previously
    only last-Part `judgeRevealed` did - an earlier-Part `judgeRevealed` used to
    advance to the next Part, which can no longer happen since that situation
    now produces `adjourned` instead). A solved reveal is still the only outcome
    that can advance to the next Part. How the case ended is read back from
    `game.log.at(-1)?.outcome` once `CASE_DONE` renders (`lastReveal` is already
    cleared by then) - `"solved"` is the only celebratory ending.
  - **New `components/cocounsel/AdjournedScreen.tsx`**, picked by
    `app/cocounsel/page.tsx`'s `CASE_DONE` branch whenever the log's last entry
    isn't `"solved"`, alongside (not replacing) `VerdictScreen`/`RecapScreen`.
    States which Part the case ended on. If the ending was `"judgeRevealed"`
    (last Part) shows `caseDef.verdict.text` as closure and offers "See the full
    case file" (`RecapScreen`, unchanged); if `"adjourned"` (earlier Part), shows
    only the dismissal message and **no** verdict/recap option at all - a
    Recap would spoil every Part's correct pair regardless of how the case
    actually ended, so it's only ever offered when nothing is left to protect.
    Single action either way, "Start a new case", reusing the exact same
    `setGame(newGame(CASE_ID))` handler the "Rematch" button already used (same
    room, same roles, no case-reconfirmation screen) - confirmed via a
    clarifying question before building this.
  - **`Stamp.tsx`** gained a `"red"` `StampColor` (`COLOR.defendant`) for the
    Adjourned framing, distinct from green (success)/amber (retry)/ink (wrong).
    **`RevealScreen.tsx`**: `judgeRevealed`'s stamp also switched to red with
    reworded copy (it no longer means "continue playing", it means "the case is
    over, the judge is just telling you the answer first"); a new `showTheory`
    check (`isFinal && outcome !== "adjourned"`) keeps `isFinal` covering all
    three "no more retries" outcomes while still never revealing a Part's
    `theory` for an `"adjourned"` ending, even though the Part itself has one
    (only the case's last Part lacks a `theory` - adjourned only ever happens
    earlier).
  - **Found and fixed a real regression while verifying this live**: Co-Counsel's
    new "Start a new case" button got both devices permanently stuck on
    `InviteLinkBanner` after resetting. Root cause and fix are the shared
    `useGameSession` self-healing-identity addition documented under
    "Multi-game architecture" above - not specific to this feature, but this is
    where it was caught (a prior session's restructuring of Co-Counsel's
    branching had silently broken the "re-prompt for a role on reset" behavior
    its original design depended on; FTW's own "Reset game" had the identical
    latent bug the whole time, just never exercised).
  - Verified live, two devices: a cap-out on an earlier Part - `AdjournedScreen`
    shows no verdict/recap/answer at all, "Start a new case" resets in-place and
    both devices correctly re-show `RolePicker` to reclaim their roles, reaching
    fresh Part-1 gameplay again in the same room; a cap-out on the case's last
    Part - the correct pair is revealed in `RevealScreen`, and `AdjournedScreen`
    shows the case verdict text with "See the full case file" available; both
    confirmed in dark mode too. The ordinary win path (solving every Part) is
    completely unaffected - existing `VerdictScreen`/`RecapScreen` flow, unchanged.
- **Stage 6 (done): back link moved inline, a `TranscriptSheet` line-count bug
  fixed.** Two user-reported issues.
  - **The back link is no longer `position: fixed` over the whole viewport** -
    the user wanted it next to the logo, like the shared 1v1 `Header`'s inline
    back-link, not floating disconnected in the screen's literal top-left
    corner. `components/cocounsel/BackButton.tsx` (the old fixed component) is
    deleted; new `BackLink.tsx` is the same visual treatment
    (`bg-black/40`/`h-9 w-9`/white arrow) but a plain inline element, placed at
    each of Co-Counsel's three header shapes: prepended into `Wordmark.tsx`
    (covers `CasePicker`/`RolePicker`/`RecapScreen`, and `app/cocounsel/page.tsx`'s
    `!bothJoined` branch, which gained a `Wordmark` above `InviteLinkBanner` -
    previously that screen had no header at all), alongside `HeaderBand.tsx`'s
    `PartProgress` row (the gameplay Part screen), and at the top of
    `ResultsHeader.tsx`'s investigator half (reveal/verdict/adjourned screens).
    `<main>`'s `pt-14` top clearance stays - it's still needed for the
    still-fixed `ThemeToggle`, just no longer doubles as back-button clearance.
  - **`TranscriptSheet.tsx`'s "What you know" sheet was rendering 30+ empty
    ruled lines for a 4-line paragraph.** Root cause: the gutter (line numbers)
    and the text `<p>` are flex row siblings under the *default* `align-items:
    stretch` - the `<p>`'s measured `offsetHeight` (what computes `lineCount`,
    driving how many line-number spans the gutter renders) was being inflated
    to match the gutter's own rendered height via that stretch, which is
    itself driven by `lineCount` - a circular dependency where any tiny
    overshoot compounds every `ResizeObserver` tick with no ceiling. Fixed with
    one class: `items-start` on the row breaks the stretch, so the paragraph's
    measured height is always its genuine intrinsic content height, regardless
    of the gutter's size. Verified live: a 10-line Part 1 transcript now shows
    exactly 10 ruled lines, not 31.
- **Stage 7 (done): the back link goes to case selection (owner only), not
  the game picker; a tier-badge visual bug fixed.** Two more user-reported
  issues, the first refined across two follow-up corrections.
  - **`BackLink` no longer leaves Co-Counsel at all - for the room's
    OWNER.** Per the user: "Pick a case" is Co-Counsel's own default/home
    screen, and the back link should return there - restarting a case
    (Rematch/"Start a new case") is the *only* path that goes to
    `RolePicker`, and leaving the game entirely is still available via the
    Footer's separate "All games" link, not the back link. `BackLink.tsx`
    changed from a `<Link href="/">` to a plain `<button onClick={onBack}>`
    (aria-label "Back to case selection"), threaded as a prop through
    `Wordmark`/`HeaderBand`/`ResultsHeader` and every screen that renders
    them. **A joiner never gets a case-selection "home" to return to at
    all, though** - only the room's owner chose the case (the one who
    shared the invite link), so a joiner's back link leaves Co-Counsel
    entirely instead (this was a correction after the first pass let *any*
    device reach `CasePicker` via back - re-tightened to check `isJoiner`).
    `app/cocounsel/page.tsx`'s `handleBack` is the shared dispatcher every
    non-`CasePicker` screen's `onBack` uses: `isJoiner` routes straight to
    `handleBackToGameRoom` (`router.push("/")`); the owner instead sets
    `forceCasePicker`, which `showCasePicker` ANDs with `!isJoiner`
    (`!isJoiner && (forceCasePicker || !caseConfirmed)` - `isJoiner` gates
    it unconditionally, `forceCasePicker` can never override that gate).
    Nothing about the room/role claims/game progress is touched by setting
    `forceCasePicker`, so the owner re-confirming via "Choose this case"
    (which also clears it) resumes exactly wherever the shared game state
    actually has them, not a reset. `CasePicker`'s OWN back link is a
    separate case - from Co-Counsel's home screen, back goes up a level to
    the game picker directly via `handleBackToGameRoom`, same as a joiner's
    back link anywhere else, rather than re-showing itself as a no-op (this
    screen is owner-only anyway, so no `isJoiner` branch is needed there).
    `RecapScreen`'s pre-existing `onBack` prop (its own "Back to the
    verdict" button, an unrelated concept) was renamed to `onBackToVerdict`
    to free up `onBack` for the new shared meaning.
  - **The "Medium"/"Hard" tier tabs on `CasePicker` read as struck through**
    - the outer dashed box's own top border was visible THROUGH the tab,
    cutting across the tier name, because (unlike the solid ink-filled "Easy"
    tab immediately above it, which is opaque) the dashed tier tabs had no
    `backgroundColor` at all - transparent, so whatever the absolutely-
    positioned tab visually overlapped (the box's own border) showed straight
    through. Fixed by giving them `backgroundColor: COLOR.paper` (matching
    the page background, like "Easy"'s solid fill masks its own overlap) and
    raising/enlarging them to match "Easy"'s exact offset/padding
    (`-top-3.5`/`py-1`, was `-top-3`/`py-0.5`) for a consistent notch across
    all three tier tabs.
- **Stage 8 (done): a stuck "Joining…" button, a joiner seeing case
  selection anyway, a white gap above full-bleed bands.** Three more
  user-reported issues, the second a genuine regression from Stage 7's own
  fix.
  - **`JoinRoomForm`'s button could get permanently stuck reading "Joining…"**
    after joining a room then leaving it (e.g. via the Footer's "All games"
    link or browser back) and returning to the picker - the same category of
    bug as the earlier `useGameSession` identity-stranding fix (see "Multi-
    game architecture" above): Next's client-side navigation can reuse this
    exact component instance rather than remounting it, so `status` was
    never reset back to idle once a join succeeded (there'd seemed no need
    to, since the page was about to navigate away). `goTo` now resets it
    regardless.
  - **Joining Co-Counsel through the picker's "Join a room" form (not a raw
    shared link) could show the case-selection screen to a joiner** - a
    second-order consequence of switching `goTo` from `router.push` to a
    hard `window.location` navigation (below): `app/cocounsel/page.tsx`'s
    `isCreator` reads `window.location.hash` via a `useState` lazy
    initializer specifically because that's the ONE moment guaranteed to run
    before `useGameSession`'s own hash-generating effect can rewrite it (see
    that state's own doc comment) - correct for an organic page load, but a
    client-side `router.push()` transition from a different route doesn't
    reliably guarantee the destination's hash is already settled on
    `window.location` by that same first-render moment, confirmed live. **An
    initial fix attempt moved the detection into a `useEffect` instead**,
    which broke the common case instead: `useGameSession`'s own hash-
    generating effect fires first (`useGameSession` is called earlier in
    this component, and React runs effects in hook-declaration order), so by
    the time a *later*, independently-deferred effect re-checked the hash,
    `useGameSession` had often already rewritten it from empty to a freshly
    generated code - misreading genuine creators as joiners. Reverted that
    attempt; the real fix is in `JoinRoomForm.tsx` instead (see below),
    leaving `isCreator`'s lazy initializer exactly as it always was.
  - **`JoinRoomForm.tsx`'s `goTo` now does a hard navigation**
    (`window.location.href`, set from a `useEffect` reacting to a
    `destination` state value - this project's `react-hooks/immutability`
    lint rule disallows mutating `window.location` directly in a plain event
    handler, "consider using an effect" - rather than `next/navigation`'s
    `router.push`), sidestepping the whole class of client-side-navigation
    timing/caching issues above: a genuine page load guarantees
    `isCreator`'s lazy initializer sees a fully-settled URL, and leaves
    nothing for a future "Joining…"-stuck bug like the one above to reuse
    either.
  - **A visible white gap sat above Co-Counsel's full-bleed colored bands**
    (`HeaderBand`/`ResultsHeader`) - `<main>`'s `pt-14` top padding, still
    reserved for the fixed-position `ThemeToggle` after Stage 7 moved the
    back link inline (its own doc comment said as much at the time), pushed
    every screen down uniformly, including bands meant to start flush with
    the viewport's top edge. Fixed the same way Stage 7 fixed the back
    link: `ThemeToggle.tsx` is no longer `position: fixed` - it's inline,
    paired opposite `BackLink` in each of Co-Counsel's three header shapes
    (`Wordmark`'s row via `justify-between`; `HeaderBand` gained its own
    back-link+theme-toggle row, kept SEPARATE from the `PartProgress` row
    below it since that row's own content already spans close to the full
    content width - cramming a 5th element in risked overflow on narrow
    viewports; `ResultsHeader`'s investigator half keeps `BackLink`,
    `ThemeToggle` mirrors it on the defendant half). `<main>`'s `pt-14` is
    gone entirely - nothing fixed-position remains that needs it.
  - Verified live: the join-via-form flow no longer shows case selection to
    a joiner while the owner's own fresh-visit flow is unaffected; the Join
    button reads "Join" (not stuck) after leaving and returning to the
    picker; the page's very top pixel is the band's own color (not white) on
    the Part/reveal screens, with the back link and theme toggle both
    visible and functional inline on every header shape; dark mode toggling
    and persistence are unaffected. Zero console errors throughout.
- **Stage 9 (done): two devices racing to claim the same role could both
  succeed.** User-reported: "when someone picks a role, normally the other
  should not be able to pick role - this doesn't work yet." Root cause and
  fix live in the shared `lib/session/identity.ts`/`useGameSession.ts` - see
  the detailed write-up under "Multi-game architecture" above (this bug and
  its fix apply to FTW's `RolePicker` too, not just Co-Counsel's, since both
  go through the same `setIdentityName`/`pickIdentity`). The regression
  hit and fixed *while verifying this fix live* - a fresh room's state has
  no `names` key at all (Firebase drops an empty `{}` on write), and the new
  guard code's first version read `state.names[role]` without normalizing
  that first, breaking the ordinary first-role-pick happy path on every new
  room - was caught specifically by testing against a brand-new Co-Counsel
  room rather than a reused one, underscoring why this needed a live
  two-device Playwright run and not just the unit tests.
- **Stage 10 (done): a deliberate "continue as X / switch role" choice when
  rejoining a room, instead of always silently resuming the remembered
  role.** User-requested, after noticing a device always auto-resumed
  whichever role it played last time it had this room open - by design (a
  seat claim is sticky in `localStorage` so a device never loses its seat on
  an unrelated change), but the user wanted the option to override that.
  - **`lib/session/identity.ts`** gained `releaseIdentityName(state, role)` -
    the shared-state counterpart to `setIdentityName`, but it clears a seat
    instead of claiming one (builds a fresh `names` object without that
    role's key, the same Firebase-rejects-explicit-undefined pattern as
    every other field-clearing spot in this codebase; a no-op, never throws,
    releasing a seat nobody holds). `useGameSession.ts` gained
    `releaseIdentity()`, pairing that with clearing this device's own local
    `me` pointer - unlike `pickIdentity`, there's no race to guard against
    (a device can only ever release its OWN seat, no competing writer to
    lose to), so the local `me` is cleared immediately rather than waiting on
    the shared transaction. Both are genuinely generic session primitives
    (not Co-Counsel-specific internally) and live in the shared layer per
    this file's own architecture split, but FTW doesn't call either one -
    zero behavior change there, confirmed live.
    **Superseded by Stage 11 below** - releasing only the initiating
    device's own seat turned out not to be enough for a real "switch", so
    neither `releaseIdentityName` nor `releaseIdentity` exist under those
    names anymore; this paragraph is kept as the narrative record of how the
    feature started.
  - **Scoped to Co-Counsel's own `app/cocounsel/page.tsx` +
    new `components/cocounsel/ConfirmRoleScreen.tsx`.** `isFreshGame`
    (`partIndex === 0 && attempts === 0 && no locks set`) gates the whole
    feature: a device with an already-remembered seat sees the new
    "Welcome back! Last time you were X, the Y." confirm screen ONLY while
    the case is still genuinely untouched - once there's any real progress,
    reopening the room resumes straight into play exactly like before, with
    no prompt at all (switching isn't offered once a match is active, so a
    confirm screen with nothing to confirm would just be nagging on every
    ordinary refresh/reopen). `roleConfirmedThisVisit` is local,
    unpersisted `useState(false)` - resets on every fresh mount of the page
    (i.e. every time the room is opened), which is what makes this
    re-prompt on each rejoin rather than only the very first time ever; it's
    also set `true` directly inside `RolePicker`'s own pick handlers, so a
    brand-new pick (first time ever claiming a seat) is never immediately
    followed by a redundant "continue as X?" prompt on the very next
    render. "Continue" just sets that flag; "Switch role instead" calls
    `releaseIdentity()`, which naturally falls through to the existing
    `!me ? RolePicker` branch with the freed role now selectable again (or,
    if the other player's seat was also already released the same way,
    both roles open - the two devices effectively swap by each
    independently choosing to let go of their own seat, not by one device
    unilaterally overwriting the other's).
  - Verified live against real Firebase, two isolated browser contexts: a
    fresh pick never shows the confirm screen (no redundant prompt right
    after picking); reloading a tab that already has a remembered seat shows
    the confirm screen with correct, case-accurate copy; "Switch role
    instead" frees the seat, returns to `RolePicker` with that role
    re-pickable, and re-picking it works end-to-end; "Continue" on the other
    device resumes normally; and - the key safety check - reloading AFTER a
    card has actually been locked in resumes straight into the "Locked in,
    waiting" state with no confirm screen at all, confirming the mid-game
    guard holds. `tsc`/`eslint`/117 Vitest cases (5 new, covering
    `releaseIdentityName`)/`next build` all clean. A quick live FTW
    regression check (name entry, room creation) confirmed zero impact from
    the two additive, FTW-unused `lib/session/` changes.
- **Stage 11 (done): auto-assign the remaining role, and make "switch role"
  open the choice for BOTH players.** Two follow-up user requests building
  directly on Stage 10's work.
  - **Auto-assign.** With exactly two roles, once one is taken the other is
    already decided - a new effect in `app/cocounsel/page.tsx` auto-claims
    the sole open role the moment it becomes the only one left, instead of
    making the second player tap a button whose outcome is no longer a real
    choice. Fires only while genuinely eligible to see `RolePicker` (game
    loaded, case confirmed, no seat of mine to confirm) and only when
    exactly one role is open - both open (nobody's picked) or both taken
    (nothing to decide) leave it alone, which is also what makes this safe
    after a "switch role" release without any extra bookkeeping (see below).
    **Hit and fixed a real self-race while verifying this live**:
    `pickIdentity` sets `me` only AFTER its shared write is confirmed, but
    the shared write landing is what updates `investigatorTaken`/
    `defendantTaken` in the first place - and that update can reach this
    component and re-render BEFORE the subsequent `meStore.set(role)` line
    actually runs (they're two separate steps separated by an `await`). On
    that in-between render, `me` was still null while the OTHER role
    (not the one just clicked) now read as the only open one - exactly the
    auto-assign trigger condition - so a device that explicitly clicked
    "I'm the Defendant" could watch its OWN auto-assign effect race in and
    silently hand it Investigator instead, overwriting its own explicit
    pick. First caught by a live two-device Playwright run doing a genuine
    swap (not just a fresh join) - a sequential-pick-only test wouldn't have
    exercised this, since it only shows up when a device's own pick and its
    own auto-assign effect can plausibly interleave. Fixed with a
    `pickingRef` (a ref, not state - react-hooks/refs forbids reading a ref
    during render, so it's only ever touched inside the effect and
    `RolePicker`'s click handlers, never in the render body) set whenever a
    pick - explicit or auto-assigned - is in flight on THIS device, which
    the auto-assign effect checks and backs off from.
  - **"Switch role instead" now opens the choice for both players, not just
    the initiator.** `lib/session/identity.ts`'s `releaseIdentityName`
    (Stage 10, single-seat) is replaced by `releaseAllIdentityNames` -
    clears every seat at once, since with only two seats, releasing just the
    initiator's own seat left the other one still held, so the only "open"
    seat remaining was the very one just given up - not a real switch, just
    an elaborate way to reclaim your own old role. `useGameSession.ts`'s
    `releaseIdentity` is likewise replaced by `releaseAllIdentities`,
    clearing this device's own local `me` immediately (as before - still no
    race to guard against here) and writing an empty `names` to the shared
    state. The OTHER player's device needs no new mechanism to notice - its
    local `me` gets cleared by the same self-heal effect that already
    re-prompts both devices after "Rematch"/"Reset case" wipe `names` back
    to `{}`. Once both devices land back on a fully open `RolePicker`,
    auto-assign (above) naturally completes the swap: the initiator must
    pick manually (two roles open, nothing for auto-assign to decide), and
    the moment they do, the OTHER device - still waiting - auto-claims
    whichever role is left, with no click needed on their end either.
  - Verified live against real Firebase, two isolated browser contexts: a
    fresh join still requires the FIRST player to pick manually, but the
    SECOND player gets auto-assigned the remaining role within half a
    second, no click at all; reloading one device, clicking "Switch role
    instead", and confirming BOTH devices land back on a fully open
    `RolePicker` (not just the initiator's); the initiator manually picking
    the role they didn't have before (the actual swap) while the other
    device auto-assigns into the remaining one, instantly, with each
    device's FINAL role correctly matching what was actually clicked (the
    self-race bug above, confirmed fixed - before the fix, this exact
    sequence silently gave the initiator back their OLD role instead of the
    one they clicked); the mid-game guard re-verified unaffected now that a
    fresh join auto-resolves the second seat. `tsc`/`eslint`/117 Vitest
    cases (identity tests updated for `releaseAllIdentityNames`)/
    `next build` all clean. FTW re-confirmed unaffected (name entry, room
    creation) by the `lib/session/` changes, which it still doesn't call.
- **Stage 12 (done): guest IDs and room-level seats** (the platform-wide rework;
  see FTW Status, "Multi-game platform Stage 9", and "Architecture").
  Co-Counsel-specific effects:
  - **Seats survive "Rematch"/"Start a new case"**: both players keep their roles
    and go straight into Part 1.
  - **"Switch role instead" is an atomic swap** (`handleSwitchRole`), not a
    release-both-and-re-pick. The other device simply finds itself in the other
    role.
  - **`RolePicker` gained takeover props** (`canTakeOverInvestigator`/
    `canTakeOverDefendant`).
  - **Only the creator gets the room-name field** on the invite screen.
  - **`isCreator` (the case-picker gate) still uses the empty-hash lazy
    initializer**. It still works because `useRoom` only writes the hash after
    the room exists, so the first render always sees it empty.

  Verified against the emulators: the creator picks Defendant, the joiner via the
  hub form is auto-assigned Investigator, and a reload followed by "Switch role
  instead" swaps both seats in one update.
