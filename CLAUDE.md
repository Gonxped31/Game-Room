# First to Worst (repo) — multi-game 1v1 platform

This repo started as a single private 2-player ranking game, **First to Worst**
("FTW" below). It's now a small **platform for 1v1 games that share a link** - `/`
is a game picker, each game lives on its own route, and they all share one generic
"2-player session" layer (room code, player identity, backend-agnostic store). First
to Worst is the first game; see the Status section for others as they're added.

## Multi-game architecture

- **Routing**: `/` is the game picker (`lib/games/registry.ts` + `app/page.tsx`, a
  server component with no session logic of its own). Each game lives at `/<slug>`
  (e.g. `/ftw`), with its own `#roomcode` hash exactly like the original
  single-game app had at `/`.
- **`lib/session/`** - game-agnostic, shared by every game, changes rarely:
  - `types.ts` - `Role` (`"p1"|"p2"`, the two seats in any 1v1 game - never
    renamed per-game; a game maps its own role names, e.g. "Master"/"Guesser" or
    "Emperor"/"Slave", onto p1/p2) and `WithIdentity` (`{ names:
    Partial<Record<Role,string>> }`, the shape every game's state must include).
  - `identity.ts` - `setIdentityName<T extends WithIdentity>(state, role, name)`,
    generic over any game's state.
  - `room.ts` - `generateRoomCode()`, a 6-char room code (ambiguous characters like
    `i`/`l`/`0`/`o` excluded).
  - `useGameSession.ts` - the hook every game's page calls once:
    `useGameSession({ gameSlug, createInitialState })` returns `{ room, game, me,
    other, names, bothJoined, online, pickIdentity, transact, setGame, newRoom }`.
    Handles room resolution (including auto-generating a fresh room for a bare
    visit - see below), the store, "who am I / has my partner joined", and presence
    (see `presence.ts` below). A game's page only has to deal with its own rules on
    top of this.
  - `presence.ts` - a seat is "online" if its heartbeat (written every
    `HEARTBEAT_INTERVAL_MS` by whichever tab holds that seat) is newer than
    `STALE_AFTER_MS` (3 missed beats). Lives at its own store path
    (`games/{room}/presence`, a sibling of `games/{room}/{slug}`), not inside any
    game's own state - it changes on a timer unrelated to gameplay, and nesting it
    in the game object would mean every heartbeat write has to merge-and-preserve
    whatever the game state happens to be instead of just "I'm here". One presence
    store per *room*, not per game, so a seat reads the same online/offline
    regardless of which game is currently open. `useGameSession` writes its own
    heartbeat on an interval while `me` is set, best-effort deletes it on unmount
    (covers a clean "back to games" navigation near-instantly), and otherwise relies
    purely on staleness (covers a closed tab/dead connection, ~`STALE_AFTER_MS`
    slower). A local tick drives re-evaluating staleness even when the partner's
    heartbeat simply stops arriving - no write ever happens on a timeout, so nothing
    would otherwise re-render. That tick starts at `null` and is only ever set from
    inside a `setTimeout`/`setInterval` callback, never read directly during
    render - reading the live clock during render is what Next's Cache Components
    flags as an unstable value a prerender could capture, and setting React state
    synchronously in an effect body (rather than from a callback reacting to an
    external timer) is what this project's `react-hooks/set-state-in-effect` ESLint
    rule flags. `RoleStickers` renders an optional small green/gray dot per seat
    when a game passes `online` through (e.g. `app/ftw/page.tsx`); omitting the prop
    skips the dot entirely, so this is opt-in per game, not required.
- **`lib/session/multiplayer/`** - a second, parallel session layer for games with
  **3+ players**, since `lib/session/`'s `Role` is a closed `"p1"|"p2"` union by
  design (its own doc comment says "never renamed per-game") and everything built on
  it - `WithIdentity`, `useGameSession`'s `other`/`bothJoined`, `RolePicker`,
  `Header`'s `myScore`/`theirScore` props - bakes in exactly 2 seats somewhere. Rather
  than widen `Role` (which every existing 1v1 game, including FTW, depends on),
  this is a **fully separate module that duplicates the small amount of
  2-seat-shaped logic** instead of generalizing it - the same "parallel module over
  shared abstraction" pattern as E-Card getting its own `lib/games/ecard/` instead of
  reusing FTW's. Every file under the top-level `lib/session/` is untouched by this
  (`git diff` on `types.ts`/`identity.ts`/`presence.ts`/`useGameSession.ts` is empty),
  so FTW's behavior provably can't be affected.
  - `types.ts` - `SeatId` (`string`, not a literal union - generated as `"p1".."pN"`
    by `seatIds(maxPlayers)` since N varies per game) and `WithMultiplayerIdentity`
    (`{ names: Partial<Record<SeatId,string>> }`, the N-player counterpart to
    `WithIdentity`).
  - `identity.ts` - `setMultiplayerIdentityName`, a direct counterpart to
    `setIdentityName` generalized from `Role` to `SeatId`.
  - `presence.ts` - re-exports `HEARTBEAT_INTERVAL_MS`/`STALE_AFTER_MS` from the 1v1
    `presence.ts` (pure constants, no reason to duplicate those) and defines
    `isSeatOnline`, the `SeatId`-generalized counterpart to `isOnline`.
  - `useMultiplayerSession.ts` - the hook: `useMultiplayerSession({ gameSlug,
    maxPlayers, createInitialState })` returns `{ room, game, seats, me, otherSeats,
    names, joinedSeats, unclaimedSeats, allJoined, online, pickIdentity, transact,
    setGame, newRoom }`. Mirrors `useGameSession` internally (same hash-based room
    resolution duplicated rather than extracted into a shared hook, for the same
    don't-touch-the-working-file reasoning; reuses `createGameStore` and
    `generateRoomCode` **unchanged**, since neither has any player-count coupling to
    begin with) - the only real differences are seat-count-driven: `online`/seat
    lists are built by mapping over `seats` instead of two hardcoded `p1`/`p2`
    object-literal entries, and `unclaimedSeats`/`allJoined` replace the 1v1 hook's
    `!names.p1 ? "p1" : ...` chain and `bothJoined` boolean. Presence is written to
    the same `games/{room}/presence` path the 1v1 layer uses (intentional - presence
    is per-*room*, not per-game, and `SeatId` is a superset of `Role`'s two values,
    so there's no shape conflict).
  - **No game is built on this yet** - it's backend-only, added ahead of having a
    specific 3+ player game in mind. `components/RoleStickers.tsx` would work for a
    future N-player game's UI unchanged (already a generic `roles: {...}[]` array,
    no count assumption); `RolePicker`/`Header` would not (hardcoded to exactly 2
    seats/scores) and would need new N-player equivalents whenever a real game is
    built on top of this. Verified end-to-end (room auto-creation, 3 distinct seats
    claiming, the "room full" case, live presence, and store sync all working against
    real Firebase) via a throwaway test page that was deleted before committing -
    `lib/session/multiplayer/` ships with Vitest coverage for every pure function
    (`seatIds`, `setMultiplayerIdentityName`, `isSeatOnline`) but, like
    `useGameSession`, the hook itself has no unit test, consistent with this
    project's pattern of verifying hooks live rather than in Vitest.
- **`lib/store/`** stays fully generic and untouched by the multi-game split -
  `createGameStore<T>(room, gameSlug)` is already backend-agnostic (Firebase when
  all five `NEXT_PUBLIC_FIREBASE_*` env vars are set, else `localStorage`). The
  slug is nested **under** the room code (`games/{room}/{slug}` in Firebase,
  `game:{slug}:{room}` in localStorage) - not the other way around - so the
  existing Firebase rule (`games/$roomId: {.read:true,.write:true}`) already
  covers every game via RTDB's rule cascade, with zero console changes needed to
  add a game. This also means two different games started under the same room
  code (unlikely, but possible if someone edits the URL path while keeping the
  hash) can't clobber each other's state.
- **Shared, reusable as-is by any game**: `components/Button.tsx`, `Header.tsx`
  (takes a `title` prop - no game-specific import; always renders a `←` link back to
  `/`, so no game ever traps a player once they've started it), `Footer.tsx` (also
  has an "All games" link, as a second way back), `RolePicker.tsx`,
  `InviteLinkBanner.tsx`, `RoleStickers.tsx` (takes a generic `roles:
  {emoji,label,name,isYou}[]` array, so each game supplies its own role names/emoji
  through the same pill-badge component).
- **Per-game, not shared**: each game gets `lib/games/<slug>/` (its own pure state
  machine + constants + tests, mirroring `lib/games/ftw/game.ts`'s pattern: throw on
  an invalid transition, no mutation, `Vitest` coverage for every transition and
  edge case) and `components/<slug>/` (its own visuals - card faces, board layout,
  etc. - nothing about e.g. `CardFace.tsx`'s gradient-number design is reusable
  across games with a different theme). `app/<slug>/page.tsx` wires `useGameSession`
  to that game's own logic and components.
- **Adding a new game later**: add an entry to `lib/games/registry.ts`, then its own
  `lib/games/<slug>/`, `components/<slug>/`, `app/<slug>/page.tsx` - nothing shared
  needs to change.

## Commands

```bash
npm run dev      # dev server at localhost:3000
npm run build    # production build (also type-checks)
npm run lint     # eslint
npm run test     # vitest (lib/**/*.test.ts)
npx tsc --noEmit # type-check only
```

## Conventions

- Game/state-transition logic stays out of presentational components — it belongs in
  each game's `lib/games/<slug>/` (state machine, scoring, content banks).
- Every game's state type must satisfy `WithIdentity` (`lib/session/types.ts`) so the
  shared session layer can show "who's in this room" without knowing anything else.
- Local store (no Firebase env vars) and Firebase store share one `Store<T>`
  interface (`lib/store/types.ts`) so the UI never knows which backend is active.

## Store design notes

- `lib/store/types.ts` defines `Store<T>`: `subscribe(onChange)`, `getSnapshot()`,
  `set(value)`, `transaction(updater)`. Shaped to drop straight into React's
  `useSyncExternalStore` (not a plain `useEffect` + `setState`, which the project's
  ESLint config flags as `react-hooks/set-state-in-effect`).
- `lib/store/localStore.ts` is generic (`createLocalStore<T>(key, { crossTab })`).
  `useGameSession` uses `crossTab: true` (the default) for the shared game state —
  syncs across tabs/devices via the `storage` event, the whole point of local test
  mode — and `crossTab: false` for the per-tab "which seat am I" value. Two tabs in
  the same browser share one `localStorage`, so without `crossTab: false` a seat
  pick in one tab would silently reassign the other tab's seat too.
- `transaction()` (exposed to games as `useGameSession`'s `transact`) is how
  invalid/duplicate state transitions become safe no-ops (double clicks, double
  tabs): a game's transition function throws on an invalid move; the store layer
  catches that and returns `undefined` to abort without writing. Firebase's real
  `transaction()` aborts the same way when the updater returns `undefined`.
- **Two Realtime Database data-shape gotchas every game's `game.ts` should assume
  from the start**, found while building (and since removed) a second game -
  neither reproduces locally or in Vitest, only against the real Firebase project:
  - **Dropped empty arrays.** RTDB omits a field entirely when writing an empty
    array, so any `T[]` field that starts as `[]` round-trips as `undefined`, not
    `[]`, the next time it's read - the symptom is a live `TypeError: ... is not
    iterable`/`.filter is not a function` crash on the second real device. FTW
    guards this for `usedPrompts` via `addUsedPrompt(usedPrompts: string[] |
    undefined, ...)` - any new array field needs the same `value ?? []` treatment
    on every read.
  - **Explicit `undefined` is rejected, not dropped, on the way out.** Fixing
    every *read* isn't enough - Firebase's `transaction()`/`set()` actively
    throws (`"Data returned contains undefined in property ..."`) if the object
    being *written* has an own property explicitly set to `undefined` (as
    opposed to the property being absent, which is fine). A *spread* of an
    object that's merely missing a key stays missing (safe), but an
    object-literal key explicitly assigned a possibly-undefined expression
    (`foo: maybeUndefined`) or a literal `undefined` (written to *clear* a
    field) both create a real own-property-with-undefined-value that gets
    rejected. The fix is to normalize every array field through a `value ?? []`
    helper at the top of every exported state-transition function (so a
    dropped-on-read array never gets re-spread into a write), and to clear an
    optional field by building a fresh object without that key rather than
    spreading the old one and setting it to `undefined`.

---

## First to Worst (`lib/games/ftw/`, `components/ftw/`, `app/ftw/page.tsx`)

A private 2-player ranking game, no login/accounts/lobby. Ported from the single-file
prototype at `references/first-to-worst.html` (source of truth for UI/flow/animations,
except where `references/instructions.md` overrides it — scoring in particular).

- `ITEMS_PER_ROUND` (`lib/games/ftw/constants.ts`) is the only place the "5 cards per
  round" rule is encoded. Never hardcode 5 in components or logic.
- `GAME_TITLE` (`lib/games/ftw/constants.ts`) is the working title shown in the UI. No
  logos or box art from the commercial game it's inspired by.
- Scoring is per-card exact match (see `references/instructions.md`), not Jaccard/
  similarity. A round score of 4 is mathematically impossible — this is expected.

**Everything below this point predates the Stage 1 multi-game refactor** and was
written when FTW was the entire app living at `app/page.tsx` with `lib/game.ts`,
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
- **Named players + master/guesser stickers.** Each player's display name, keyed by
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
- **Invite links + multi-pair rooms.** A visitor with no `#room` in the URL at all
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
  refs through `CardTable`. Dropping on an already-filled "mine" slot overwrites
  it, and the displaced number simply reappears in hand. Verified with real
  mouse-event sequences (move/down/move/move/up, not just `.click()`).

### Status

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

---

## Co-Counsel (`lib/games/cocounsel/`)

A 2-player cooperative asymmetric deduction game, fully specified in
`references/co-counsel/co-counsel-game-design.md` (rules, scoring, launch case
content) and `references/co-counsel/co-counsel-visual-spec.md` (design tokens,
component specs, screen-by-screen copy, motion, accessibility) - read those first for
anything not covered here. One player is the **Investigator** (external evidence),
the other the **Defendant** (internal facts); each "Part" of a case, both secretly
lock in one card, trying to find the matching pair while talking out loud.

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
  write (confirmed by `useGameSession.ts`'s existing `names ?? {}` guard, which
  exists for the identical reason).

### Status

- **Stage 1 (done):** case data (`cases.json`), types (`caseTypes.ts`), the
  validator (`caseValidator.ts`), and the game state machine (`game.ts`) - no UI yet.
  36 Vitest cases: schedule/transition correctness, hand/turn-order rejection, the
  documented Part 1 trap pair's exact flag outcome, Focus-flag computation against
  the documented Part 3 memory lures, the judge-reveals-after-2-misses path, every
  validator check (including that the real shipped case passes cleanly), and a full
  first-try playthrough of the whole case reaching a 100%/100% "Mind-Reading Team"
  result. Verified: zero diff to any existing `lib/session/*` or `lib/games/ftw/*`
  file.
