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
    **Self-heals a device whose seat claim (`me`) outlives the shared `names`
    it was built on** - a game resetting its own state in place (e.g. FTW's
    "Reset game", Co-Counsel's "Rematch"/"Start a new case") calls
    `setGame(createInitialState())`, which wipes the shared `names` back to
    `{}`, but `me` is a separate, local-only store on EACH device that
    doesn't get touched by that write on either side. Without self-healing,
    whichever device(s) still had `me` set would never re-show `RolePicker`
    (so `names` never gets repopulated) while `bothJoined` reads false -
    stranding them on an `InviteLinkBanner` they can never get past. A
    `hadNameRef` ref (not component state - this doesn't need a re-render of
    its own) tracks whether `names[me]` has been truthy at any point; only a
    true→false transition (an actual reset) clears the local `me`, not
    `names[me]` simply not having landed yet (`pickIdentity` sets `me`
    locally/synchronously but writes the shared name through a
    `gameStore.transaction`, which can take a real round-trip on Firebase).
    **Found and fixed this session** after Co-Counsel's own "Start a new
    case" (built for the Adjourned ending below) got stuck exactly this way
    in live two-device testing - traced to last session's restructuring of
    Co-Counsel's branching from `!bothJoined → RolePicker` to the split
    `!me → RolePicker` / `!bothJoined → InviteLinkBanner` shape (to match
    FTW's), which silently broke the "re-prompt for a role on reset"
    behavior Co-Counsel's original design had relied on. FTW turned out to
    have the identical latent bug in "Reset game" the whole time (same root
    cause, just never exercised); this fix covers both without either game's
    page needing any changes.
  - `roomMeta.ts` - `RoomMeta` (`{ gameSlug, name? }`), stored at `games/{room}/meta`
    (another sibling store path, like `presence`). `useGameSession` bootstraps
    `gameSlug` into it the first time a room's hash exists (backfilling an existing
    pre-this-feature room too, not just a fresh one - a no-op transaction once meta
    already has a value), and exposes `roomName`/`setRoomName` so any game can let
    players give their room an optional display name. This is what makes "join a
    room by code" possible from the picker without asking which game it's for -
    `readRoomMeta(room)` (a one-off lookup via `Store.readOnce()`, not the live
    `subscribe`/`getSnapshot` pair everything else uses, since there's no ongoing
    subscription to an arbitrary typed-in code) is how `components/JoinRoomForm.tsx`
    finds out where to route. `setRoomName` clears the name by building a fresh
    `{ gameSlug }` object rather than spreading the old value and setting
    `name: undefined` - the same Firebase-rejects-explicit-undefined lesson as
    everywhere else that clears an optional field.
    **Also backs joining by room name, not just code.** `normalizeRoomName`
    (trim + lowercase) and `findRoomsByName(name)` read a name→room-codes
    index at `roomsByName/{normalizedName}` (via the new
    `createRoomNameIndexStore`, see Store design notes) - a genuinely
    separate top-level path from `games/`, not nested under any room, so it
    needs its own Firebase rule rather than riding the existing
    `games/$roomId` cascade (see README's "Database rules"). `setRoomName`
    (in `useGameSession.ts`) keeps this index roughly in sync - removing the
    room's old name entry and adding the new one - best-effort and NOT
    atomic with the meta write (a different store/path entirely).
    `findRoomsByName` tolerates that: every candidate code the index returns
    gets validated against its own live `readRoomMeta` before being trusted,
    which is also what makes a renamed-away room's stale index entry harmless
    without needing a separate cleanup pass to be perfectly reliable.
    `components/JoinRoomForm.tsx` treats a typed room code as authoritative
    when present (name field ignored); given a name alone, zero matches is
    "not found", one match routes directly, and 2+ matches renders an inline
    disambiguation list (room code + game title per row) instead of guessing.
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
  hash) can't clobber each other's state. `createRoomNameIndexStore(name)` is the
  one exception - a separate top-level `roomsByName/` path backing "join a room by
  name" (`lib/session/roomMeta.ts`), deliberately NOT built on `createGameStore`
  (different path shape, different localStorage key scheme) so that already-working
  function stays untouched; see Store design notes and README's "Database rules".
- **Shared, reusable as-is by any game**: `components/Button.tsx`, `Header.tsx`
  (takes a `title` prop - no game-specific import; always renders a `←` link back to
  `/`, so no game ever traps a player once they've started it), `Footer.tsx` (also
  has an "All games" link, as a second way back; shows a user-set room name
  alongside the raw code, via the `roomName` prop), `RolePicker.tsx`,
  `InviteLinkBanner.tsx` (the `room`/`roomName`/`onRenameRoom` props back its
  optional "name this room" field; `accentColor`/`accentShadowColor`/
  `accentTextColor` theme its button - default to FTW's own pink so FTW's call site,
  which passes none of them, stays pixel-identical), `RoleStickers.tsx` (takes a
  generic `roles: {emoji,label,name,isYou}[]` array, so each game supplies its own
  role names/emoji through the same pill-badge component), `JoinRoomForm.tsx` (the
  picker page's "enter a room code or name to jump back in" box - a code routes
  directly via `RoomMeta`; a name goes through `findRoomsByName`, routing directly
  for exactly one match or rendering an inline disambiguation list for more than
  one - with no game picked ahead of time either way), `GamePickerCard.tsx` (one
  `GameEntry` → the picker's per-game card - image band, tagline, info-pill tags,
  and a themed "Start a room" pill; the whole card is a single `<Link>`, with the
  pill rendered as a styled `<span>` rather than a real `<button>`, since nesting
  an interactive element inside the anchor would be invalid HTML).
- **Per-game, not shared**: each game gets `lib/games/<slug>/` (its own pure state
  machine + constants + tests, mirroring `lib/games/ftw/game.ts`'s pattern: throw on
  an invalid transition, no mutation, `Vitest` coverage for every transition and
  edge case) and `components/<slug>/` (its own visuals - card faces, board layout,
  etc. - nothing about e.g. `CardFace.tsx`'s gradient-number design is reusable
  across games with a different theme). `app/<slug>/page.tsx` wires `useGameSession`
  to that game's own logic and components.
- **Adding a new game later**: add a `GameEntry` to `lib/games/registry.ts` (now
  including `image` - a header illustration under `public/games/` - `tags` - the
  picker card's info pills, e.g. `["2 players", "Live or anytime"]` - and
  `accentColor`/`accentShadowColor`/`accentTextColor` for its "Start a room" pill,
  typically the same per-game palette already passed to `InviteLinkBanner`), then
  its own `lib/games/<slug>/`, `components/<slug>/`, `app/<slug>/page.tsx` -
  nothing else shared needs to change.

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
  ESLint config flags as `react-hooks/set-state-in-effect`). Also `readOnce()`:
  Promise<T|null>, a direct one-off backend read independent of `getSnapshot()`'s
  cache (which only ever gets warm via an active `subscribe()`) - for looking up a
  room this component isn't otherwise subscribed to, e.g. `lib/session/roomMeta.ts`'s
  `readRoomMeta` backing the picker's "join a room by code" form.
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
  - **Join a room by code, from the picker.** `lib/session/roomMeta.ts` is a new
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
    `lib/session/roomMeta.ts`'s `roomsByName` index (and the Firebase rule it
    needs - see README's "Database rules") is unchanged from the first pass.
  - Verified live: desktop/mobile/exact-760px-edge screenshots against both
    mockup images: switch keyboard nav and ARIA state; join-by-code, by a
    unique name, by an ambiguous name (two real rooms, one FTW one Co-Counsel,
    both actually named identically) showing the disambiguation list with both
    routing correctly; the not-found error state and its clear-on-edit
    behavior; card click-through with the per-game `aria-label`. Zero console
    errors throughout, `tsc`/`eslint`/`vitest`/`next build` all clean.

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
