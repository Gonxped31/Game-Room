# First to Worst - build history

How First to Worst was built, from the single-file prototype onward. Platform-wide stages (the multi-game split, the picker, joining, the guest-ID rework) are in `platform.md`.

**This is history, not documentation of the current system.** Entries describe what
was true when they were written, and many describe mechanisms that were later
replaced (most notably by the guest-ID rework: seats moved out of game state, the
per-tab `me` pointer, the polling heartbeat and the open database rules are all
gone). For how things work now, see the root `CLAUDE.md` and the project skills in
`.claude/skills/`.

## Background

**Everything below this point is history.** It predates the guest-ID rework (see
the root `CLAUDE.md` for how seats, names, rooms and presence work now), and much
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

## Post-launch additions

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

## UI polish round

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

## Build stages

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
