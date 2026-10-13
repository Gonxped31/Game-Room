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
    other, names, bothJoined, pickIdentity, transact, setGame, newRoom }`. Handles
    room resolution (including auto-generating a fresh room for a bare visit - see
    below), the store, and "who am I / has my partner joined". A game's page only
    has to deal with its own rules on top of this.
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
  (takes a `title` prop - no game-specific import), `Footer.tsx`, `RolePicker.tsx`,
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

- **No-repeat prompts within a session.** `GameState.usedPrompts` tracks
  every distinct prompt text seen this session - shuffled past, custom-written, or
  played - and is never allowed to shrink or duplicate (`addUsedPrompt`). `randomRound`
  takes that list and excludes all of it, so neither "Shuffle prompt"
  nor "Next round" repeats a prompt until the full 300-entry bank has come up once;
  after that it cycles, still avoiding an immediate repeat of the very last prompt.
  Tested: a full 300-pick cycle has zero duplicates, and a
  60-shuffle Playwright run against the real UI came back with 60/60 unique prompts.
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
- **Stage 4 (done):** 300 built-in prompts (each validated to have exactly
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
- **Multi-game platform Stage 2 (done):** `lib/games/registry.ts` (`APP_TITLE`
  "Game Night" + a flat `GAMES` array) backs a new `app/page.tsx` - a server
  component listing games as link cards to `/<slug>`, replacing the Stage 1
  redirect. `Footer` gained an "All games" link back to the picker. Root
  `metadata.title` switched from FTW's `GAME_TITLE` to the platform's
  `APP_TITLE`. Verified: `/` renders the picker with no redirect, clicking into
  First to Worst lands on a fresh room, "All games" returns to the picker, and
  the browser back button restores the room (hash intact) - standard navigation
  history, no special-casing needed. Re-ran the FTW regression suite to confirm
  the Footer addition didn't break anything.
- **Multi-game platform Stage 3 (done):** `lib/games/ecard/game.ts` - E-Card's
  pure state machine, no UI yet (that's the next stage). `Role` (p1/p2, the seat)
  stays distinct from `EcRole` ("emperor"|"slave", the in-game role this round) -
  `emperorSeatOf`/`ecRoleOfSeat`/`seatOfEcRole` convert between them.
  `emperorSeatOf(round)` alternates by 3-round block (`Math.ceil(round/3)`, odd
  block → p1), giving the 6/6 split over 12 rounds. `initiativeOf(round)`
  alternates by absolute round number (not by block), matching the brief's
  "Round 1 Emperor first, Round 2 Slave first" example. A round's hands reset
  every round (`buildHand`: 1 special + 4 citizens per side, deterministic IDs
  like `emperor-c1`) - not carried across rounds. `placeCard(game, role, cardId)`
  validates turn order via `nextToPlace` (derived from `initiative` + which
  placements already exist, not stored separately) and hand membership; a
  second placement always reveals+resolves immediately via a tiny win table
  (citizen vs citizen is the *only* reachable tie, since each side only ever
  holds one copy of its own special card - emperor-vs-emperor can't happen). A
  tie discards both cards and must go through `continueRound` (fresh exchange,
  same round, same initiative, already-shrunken hands); a decisive result
  updates `totals`/`history` and must go through `nextRound` (fresh 5-card deal
  per the next round's schedule) - calling the wrong one of the two for the
  current result throws, same no-op-via-transaction pattern as FTW.
  `isGameComplete` is true once round 12 resolves decisively; `nextRound`
  rejects advancing past it. Going to the 5th/final exchange (both sides down to
  just their special card after 4 citizen-ties) naturally falls out of the hand-
  shrinking logic with no special-casing - emperor vs slave is always decisive.
  24 Vitest cases: schedule correctness (6/6 split, block-vs-round distinction
  for seats vs initiative), the inverse seat/role conversions, turn-order and
  hand-membership rejection, tie vs each decisive outcome (and their payouts -
  1x to Emperor, 5x to Slave), `continueRound`/`nextRound` guard rejection in
  both directions, and a full 12-round simulated game checking the seat split
  and that `totals` reconciles exactly against summed `history` payouts.
