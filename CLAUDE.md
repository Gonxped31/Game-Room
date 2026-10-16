# Game Room — a platform for private, link-shared games

A small platform for private 2-player games played through a shared link.
- `/` is the hub (game picker, join by code or name, "Your rooms").
- Each game lives at `/<slug>#<roomCode>`.
- No sign-in: every browser gets an invisible guest ID.
- Games: **First to Worst** (`/ftw`) and **Co-Counsel** (`/cocounsel`).

This file holds what must stay true on **every** change. Everything else loads on
demand:

| Need | Where |
| :--- | :--- |
| Working on First to Worst | `first-to-worst` skill (`.claude/skills/first-to-worst/`) |
| Working on Co-Counsel | `co-counsel` skill |
| Adding (or removing) a game | `add-game` skill |
| Changing, testing or deploying database rules; `permission_denied` errors | `database-rules` skill |
| Any visual change: which spec applies, past UI pitfalls, phone/desktop screenshots | `ui-review` skill |
| Testing a change with two players on phone + desktop (emulators + Playwright) | `live-test` skill |
| Original specs and mockups | `references/` (`ftw/`, `co-counsel/`, `game-room/`) |
| Deferred work waiting on a trigger ("when X ships, do Y") | `docs/follow-ups.md` |

**Before finishing any task, check `docs/follow-ups.md`** for entries this work
triggers. Do them, or tell the user they're now due. When deferring work that
depends on a future event, add an entry there instead of leaving it in chat.

## Architecture

### Guest identity (`lib/session/shared/auth.ts`)

- Firebase **Anonymous Auth**, invisible.
  - **There is no sign-in screen, and never will be** (a product decision).
  - `useGuestAuth()` gives `{status, uid}`; `ensureGuestUid()` for one-off reads.
  - If sign-in fails, pages show `CONNECTION_ERROR_MESSAGE`. There is never a
    silent fallback to local mode.
- **One guest ID per browser**, shared by all its tabs, and **one seat per guest
  per room**. Test two players with a normal window plus a private window (or two
  Playwright contexts), never two tabs.
- **Local mode** (no Firebase config) uses a fake uid in sessionStorage, one per
  tab, so two tabs *can* play each other locally.

### Room data model (`database.rules.json` is the source of truth)

```
games/{roomCode}/
  meta:       { gameSlug, maxPlayers, createdAt, createdBy, name?, nameKey? }  // write-once except name/nameKey (creator only)
  seats:      { p1: uid, ... }        members: { [uid]: "p1" }               // always written together
  players:    { p1: { name }, ... }   presence: { [uid]: { online, lastSeen } }
  lastActive: number                  ftw | cocounsel: { ...game state... }  // validated per game
roomsByName/{nameKey}: roomCode                                             // unique, first come first served
users/{uid}/rooms/{roomCode}: { gameSlug, addedAt, createdByMe?, name? }
```

- **Seat and room writes are multi-path updates built by the pure functions in
  `lib/session/shared/updates.ts`**, sent with `updateRoot()`:
  - `createRoomUpdate` - seats nobody; the creator then picks a seat like anyone
    else.
  - `claimSeatUpdate`, `switchSeatUpdate`.
  - `swapSeatsUpdate` - two seated members trade seats; it can never kick anyone.
  - `leaveRoomUpdate`.
  - `takeOverSeatUpdate` - only once the holder has been offline for over 2 min.
  - `roomNameUpdate`.

  **Never hand-assemble seat or room paths elsewhere.** `seats` and `members` must
  change in the same update.
- **The rules only allow writes at named child paths.** Never `set`, `update` or
  transact `games/{room}` itself. Game state is transacted at
  `games/{room}/{slug}`.
- **Any signed-in guest can read a room by its code** (spectators can watch); only
  seated members can change it. Nobody can list `/games` or `/roomsByName`, or read
  another guest's `/users/{uid}`.
- **Game state shapes are validated by the rules.** Changing a game's state type
  means changing the rules and `tests/rules/` in the same change (`database-rules`
  skill).

### Code map

- **`lib/session/shared/`** - the room mechanics every game shares:
  - `auth.ts` - guest identity.
  - `updates.ts` - the write builders, plus the `RoomMeta`/`PresenceEntry` types.
  - `roomActions.ts` - `createRoom` (retries code collisions up to 5 times),
    `readRoomMeta`, `findRoomByName`, `renameRoom`, and the user-facing messages.
  - `presence.ts` - `.info/connected` + `onDisconnect`, keyed by uid. Cleanup
    marks a guest offline but never deletes the entry, because takeover is judged
    on `lastSeen`.
  - `useRoom.ts` - the core hook:
    - It waits for auth and a real `#code` before touching the database.
    - A bare visit creates the room *then* sets the hash.
    - It listens to `meta`/`seats`/`members`/`players`/`presence`/game separately,
      never the whole room.
    - It runs seat actions and presence, and writes `lastActive` at most once a
      minute while every seat is filled.
- **`lib/session/useGameSession.ts`** - the 1v1 hook every game page calls.
  - **Its public API is stable**: `room, game, gameStore, me, other, names,
    bothJoined, roomName, setRoomName, online, pickIdentity, releaseAllIdentities,
    transact, setGame, newRoom`.
  - **Additive fields**: `uid, connectionError, roomMissing, canRenameRoom,
    roomNameError, canTakeOver`.
  - `me` is `members[uid]`.
  - **Seats survive `setGame()` resets.**
  - `releaseAllIdentities` means "switch role": a swap, or a move to the empty
    seat.
- **`lib/session/types.ts`** - `Role` (`"p1"|"p2"`, never renamed per game) and
  `WithIdentity`, which every game state must extend. Its `names` field is now
  always `{}`: names live in `players`.
- **`lib/session/multiplayer/`** - `useMultiplayerSession` for 3–8 seats, built on
  the same `useRoom`. No game uses it yet; keep it separate from `useGameSession`
  until one does.
- **`lib/store/`** - backend-agnostic:
  - `createPathStore(path)`, `createGameStore(room, slug)`, `updateRoot`,
    `serverTimestamp` (required for the rules' `<= now` checks), `watchConnection`,
    `setOnDisconnect`.
  - The backend is Firebase when all five `NEXT_PUBLIC_FIREBASE_*` vars are set;
    otherwise `localDb.ts` (one JSON tree in localStorage, synced across tabs of
    one browser profile only).
  - `readOnce()` returns null **only** when the rules deny a read; it rethrows
    offline errors, so code never acts on "missing" data it didn't actually see.
  - UI code never knows which backend is active.
- **`lib/games/<slug>/`** - each game's pure state machine, constants, content and
  tests. **`components/<slug>/`** and **`app/<slug>/page.tsx`** - each game's UI.
  **`components/`** - shared pieces:
  - `Header`, `Footer`, `Button`, `RoleStickers`.
  - `RolePicker` - FTW's name entry, with takeover.
  - `InviteLinkBanner` - the name field shows only for the creator.
  - Hub (`components/hub/`): `Hub` (header, Continue chip, Your rooms button
    or floating pill), `GameCard` (Start + Join), `HubOverlay` (one shared
    popover on desktop / bottom sheet on mobile), `JoinPanel`,
    `YourRoomsList` (+ `HomeScreenTip`), `useSavedRooms`. Art and list tiles
    live in `components/gameRoom/`.
  - Room pages: `InAppBrowserBanner`.
  - Every page: `LocalModeBanner`.
- **`lib/games/registry.ts`** - every game (`ALL_GAMES`); the hub shows `GAMES`.
  Set `hidden: true` to take a game off the hub while keeping it playable and
  still named correctly in "Your rooms".

## Conventions

- **Game logic lives in `lib/games/<slug>/`, never in components.**
  - Transitions are pure: they throw on an invalid move (the store turns that into
    a no-op) and never mutate.
  - Every transition has Vitest coverage.
- **Realtime Database data shapes**, assumed from day one in every game:
  - Empty arrays and objects are dropped on write, so read them as `value ?? []`.
  - An explicit `undefined` is rejected on write, so clear a field by building a
    new object without it.
- **Navigating into a room** from another page is a hard navigation (`<a>` or
  `window.location`), never `router.push`/`next/link`. Co-Counsel's creator check
  reads the hash on its first render.
- **Never read the clock, `window` or storage during render.** Use effects, timer
  callbacks, or `useSyncExternalStore` with a server snapshot. Next's Cache
  Components and this repo's `react-hooks/*` lint rules enforce this.
- **Ship the client before the rules.** When a rules change alters what clients
  may write, deploy the app first: new rules under the previous client refuse its
  writes (room creation included).
- **`AGENTS.md`**: this Next.js version has breaking changes. Check
  `node_modules/next/dist/docs/` before using Next APIs.

## Commands

```bash
npm run dev        # dev server at localhost:3000 (one per project)
npm run build      # production build (also type-checks)
npm run lint       # eslint
npm run test       # vitest: lib/**/*.test.ts (game logic, prompt bank, update builders, presence)
npm run test:rules # database.rules.json against the Database emulator (tests/rules/, needs Java)
npx tsc --noEmit   # type-check only
```

CI (`.github/workflows/ci.yml`) runs lint, `tsc`, `npm test` and
`npm run test:rules`.

Before calling a change done:
- **Every change**: lint, `tsc`, `npm test`.
- **Rules or game-state changes**: also `npm run test:rules`.
- **Anything visible**: also the `ui-review` skill (phone and desktop screenshots).
- **Anything multiplayer**: also the `live-test` skill.

## Environment notes

- **Local mode is per browser profile.** It never syncs across browsers or
  devices, and it shows a "Local mode" banner. **Restart `npm run dev` after
  changing `.env.local`**: a dev server started without the Firebase config
  silently runs in local mode, which looks exactly like a sync bug.
- **A Vercel build fails** (`next.config.ts`) if any Firebase var is missing, so a
  local-only app can never ship. Preview and production share one database unless
  Preview gets its own project's vars.
- **Anonymous sign-in needs no Firebase "Authorized domains" entry.** New Vercel
  preview URLs work as-is. Only an HTTP-referrer restriction on the API key would
  need `https://*.vercel.app/*`.
- **A dev server returning 500 with a Turbopack panic** means the dev cache is
  corrupted: stop dev servers and delete `.next/dev`.
