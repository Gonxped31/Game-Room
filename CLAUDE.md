# First to Worst

A private 2-player ranking game, no login/accounts/lobby. Ported from the single-file
prototype at `references/first-to-worst.html` (source of truth for UI/flow/animations,
except where `references/instructions.md` overrides it — scoring in particular).

## Stack

- Next.js (App Router) + React + TypeScript + Tailwind CSS v4
- Firebase Realtime Database (modular v10 SDK) with a localStorage fallback — Stage 3
- Vitest for unit tests — Stage 2

## Commands

```bash
npm run dev      # dev server at localhost:3000
npm run build    # production build (also type-checks)
npm run lint     # eslint
npm run test     # vitest (lib/*.test.ts)
npx tsc --noEmit # type-check only
```

## Conventions

- `ITEMS_PER_ROUND` (lib/constants.ts) is the only place the "5 cards per round"
  rule is encoded. Never hardcode 5 in components or logic.
- `GAME_TITLE` (lib/constants.ts) is the working title shown in the UI. No logos or
  box art from the commercial game it's inspired by.
- Game/state-transition logic stays out of presentational components — it belongs in
  `lib/` (scoring, state machine, prompt bank, store).
- Scoring is per-card exact match (see `references/instructions.md`), not Jaccard/
  similarity. A round score of 4 is mathematically impossible — this is expected.
- Local store (no Firebase env vars) and Firebase store share one interface so the UI
  never knows which backend is active.

## Store design notes

- `lib/store/types.ts` defines `Store<T>`: `subscribe(onChange)`, `getSnapshot()`,
  `set(value)`, `transaction(updater)`. Shaped to drop straight into React's
  `useSyncExternalStore` (not a plain `useEffect` + `setState`, which the project's
  ESLint config flags as `react-hooks/set-state-in-effect`).
- `lib/store/localStore.ts` is generic (`createLocalStore<T>(key, { crossTab })`) and
  used for both the shared game state (`crossTab: true`, the default — syncs across
  tabs/devices via the `storage` event, which is the whole point of local test mode)
  and the per-tab "which role am I" value (`crossTab: false`). Two tabs in the same
  browser share one `localStorage`, so without `crossTab: false` a role pick in one
  tab would silently reassign the other tab's role too — this mirrors the
  prototype's one-time-read behavior for role identity on purpose.
- `transaction()` is how invalid/duplicate state transitions become safe no-ops
  (double clicks, double tabs): the updater calls into `lib/game.ts`, which throws on
  an invalid transition; the store layer catches that and returns `undefined` to
  abort without writing. Firebase's real `transaction()` (Stage 3) aborts the same
  way when the updater returns `undefined`.

## Post-launch additions

- **No-repeat prompts within a session.** `GameState.usedPrompts` (lib/game.ts) tracks
  every distinct prompt text seen this session - shuffled past, custom-written, or
  played - and is never allowed to shrink or duplicate (`addUsedPrompt`). `randomRound`
  (lib/prompts.ts) takes that list and excludes all of it, so neither "Shuffle prompt"
  nor "Next round" repeats a prompt until the full 300-entry bank has come up once;
  after that it cycles, still avoiding an immediate repeat of the very last prompt.
  Tested: a full 300-pick cycle has zero duplicates (`lib/prompts.test.ts`), and a
  60-shuffle Playwright run against the real UI came back with 60/60 unique prompts.
- **Named players + master/guesser stickers.** `GameState.names` (`Partial<Record<Role,
  string>>`, lib/game.ts's `setName`) holds each player's display name, keyed by p1/p2
  (not by role, since role rotates every round) - so it's part of the shared room state,
  not local storage, and survives closing the browser or switching devices. `RolePicker`
  now asks for a name instead of "I'm the master"/"I'm the guesser": the first player to
  open an empty room names themself and becomes p1, the second names themself and
  becomes p2; if both names are already set (a device that lost its local `me`), it
  instead shows "Welcome back! Which one are you?" with the two existing names - no
  retyping. `RoleStickers` renders two small pill badges ("👑 Sam · Master", "🔎 Alex ·
  Guesser") near the top of the board once both names exist, outlining whichever one is
  the current viewer. Names also replace the generic "Master"/"Guesser" text in
  `CardTable`'s column headers, `RoundBoard`'s status messages, and the footer identity
  line, falling back to those generic words for any name not yet set. Verified with a
  Playwright run across two tabs naming themselves live (names sync into the second
  tab's RolePicker in real time via the already-crossTab game store), a role swap
  flipping which sticker is highlighted, and the "new device" recovery flow (clearing
  just the local `ftw:me:<room>` key, reloading, picking the existing name, resuming
  mid-round) - zero console errors; all existing regression scripts' selectors were
  updated for the new aria-labels and name-entry flow and re-verified passing.
- **Invite links + multi-pair rooms.** A visitor with no `#room` in the URL at all used
  to silently land in the shared `"our-private-room-id"` default - fine for one pair,
  but two unrelated pairs would collide in the same room. `lib/room.ts`'s
  `generateRoomCode()` (6 chars, ambiguous characters like `i`/`l`/`0`/`o` excluded)
  now gets assigned to `window.location.hash` on first visit instead, via a `useEffect`
  in `app/page.tsx` that deliberately checks for the empty-hash case *before* touching
  `gameStore` - otherwise the first render (still bound to the DEFAULT_ROOM placeholder)
  would read/write the shared room for one tick before redirecting. The room's
  `useSyncExternalStore` subscription now listens to the real `hashchange` event
  (replacing a `noopSubscribe`), so both this auto-redirect and the new "New room"
  footer link (generates a fresh code, clears local `me`) actually trigger a re-render.
  `InviteLinkBanner` (clipboard copy of `window.location.href`, with a 2s "Copied!"
  confirmation) shows in the sticker's slot whenever the room doesn't have both
  players' names yet - `RoleStickers` takes over once it does. Verified: a bare visit
  never touches `games/our-private-room-id`, two fully isolated Playwright contexts
  visiting with no hash land in two different rooms and play simultaneously against
  the real Firebase project with no data leaking between them (confirmed via each
  room's footer), and clipboard-copy/`New room` both work end-to-end.
- **Session recap.** `GameState.history` (`RoundRecord[]`: round, prompt, score, who was
  master) gets one entry appended in `submitGuess` - the same place `totals` already
  updates - and is preserved through `nextRound`/`setPrompt` like every other field,
  reset to `[]` by `newGame`. `SessionRecap` renders it as a collapsible `<details>`
  list ("Session recap (N rounds)") above the footer, each row showing the prompt in
  bold and round/master/score underneath - split across two lines after a single-line
  version wrapped awkwardly at 375px. Tested in `lib/game.test.ts` (one record per
  round, correct master/score, survives a round transition) and visually confirmed
  with Playwright.

## UI polish round (post-launch)

- **Removed "Change role" from the footer.** It was a dev-testing affordance (playing
  both sides in one tab) with no real use once two people are on two real devices - the
  "Welcome back, which one are you?" screen in `RolePicker` already handles a device
  that's lost its local `me` (new device, cleared storage) without it.
- **Board withheld until both players have joined.** `app/page.tsx` now renders
  `InviteLinkBanner` instead of `RoundBoard`/`SessionRecap` whenever `!bothJoined`, so a
  lone first player can't start ranking before their partner is actually in the room.
- **Primary action pinned to the screen, not just "stuck" on scroll.** `RoundBoard`'s
  hand+submit (while placing) and "Next round" (once revealed) render in a
  `position: fixed; bottom: 0` bar (`fixedBar`) instead of flowing at the end of a tall
  card table - `position: sticky` was tried first but only locks in place once you've
  scrolled far enough to reach it, which doesn't satisfy "no scrolling needed at all."
  Because a `fixed` bar is pinned to the *viewport*, not to `RoundBoard`'s own box, it
  also covers whatever else is at the bottom of the screen once scrolled all the way
  down - including the Footer, which renders after `RoundBoard` in `app/page.tsx`. The
  bottom-clearance padding for this therefore lives on `<main>` in `app/page.tsx`
  (`hasFixedBar` computed there from `status`/`placing`/`bothJoined`), not inside
  `RoundBoard` - padding added only inside `RoundBoard` left the Footer's "New room"
  link unclickable once scrolled to the bottom, caught by a Playwright regression run
  ("element intercepts pointer events"). Card/slot sizing also shrank from
  `min(17vw,76px)` to `min(15vw,68px)` throughout (`CardTable`, `Hand`) specifically so
  5 hand cards always fit on one row even at 375px - at the old size they wrapped to two
  rows once all 5 were in hand, which both added height and made the fixed bar's own
  height vary (181px vs 314px), compounding the clearance problem.
- **Drag-and-drop to place cards**, additive to tap-to-place (not a replacement - if a
  gesture never exceeds an 8px threshold it falls through as a normal click/select).
  Built with native Pointer Events in `RoundBoard.tsx`'s `handleDragStart`, not the
  HTML5 Drag and Drop API, which doesn't fire on touchscreens at all. `CardSlot` exposes
  `data-drop-id` (only when a slot is actually interactive, mirroring the existing
  `onClick` gating) so the drop handler can hit-test via
  `document.elementFromPoint(...).closest("[data-drop-id]")` instead of threading refs
  through `CardTable`. Dropping on an already-filled "mine" slot overwrites it, and the
  displaced number simply reappears in hand (derived automatically, same as removing
  any other assignment). `Hand` cards get `touch-action: none` so a real touch-drag
  doesn't also scroll the page. Verified with real mouse-event sequences
  (move/down/move/move/up, not just `.click()`): a plain tap still selects (no
  regression), a drag places a card, a drag onto a filled slot swaps and returns the
  old number to hand, and a ranking mixing drag + tap placements locks in successfully
  - zero console errors throughout, and all prior regression scripts still pass.

## Status

- **Stage 1 (done):** static card-table UI in local component state, including the
  3D flip animation and the full RANKING → GUESSING → REVEALED loop.
- **Stage 2 (done):** `lib/scoring.ts` and `lib/game.ts` as pure, tested functions
  (18 Vitest cases: match scoring incl. the all-permutations "4 is impossible" check,
  and valid/invalid state transitions). UI now reads/writes through
  `lib/store` (localStorage + `storage` event), verified across two real tabs
  with Playwright: independent role pick, live cross-tab sync, and state restored
  after a hard refresh. Still one hardcoded prompt - the bank is Stage 4.
- **Stage 3 (done):** `lib/store/firebaseStore.ts` implements the same `Store<T>`
  interface against Realtime Database (modular SDK): `onValue` for subscribe,
  `set` for direct writes, `runTransaction` for `transaction()` (aborts on
  `undefined`, same contract `lib/game.ts`'s thrown errors already produce).
  `lib/store/index.ts` picks Firebase when all five `NEXT_PUBLIC_FIREBASE_*` env
  vars are set, else falls back to localStorage - verified both ways: local mode
  re-tested with `.env.local` removed, and Firebase mode tested against the real
  `first-to-worst-74d1a` project across two fully isolated Playwright browser
  contexts (separate localStorage each, i.e. two different devices), confirming
  data really round-trips through Firebase and not an accidental local fallback.
  Role selection still never touches Firebase - stays in localStorage per the brief.
- **Stage 4 (done):** `lib/prompts.ts` (30 built-in prompts, each validated to have exactly
  `ITEMS_PER_ROUND` unique items) backs "Shuffle prompt" and `CustomPromptForm`
  ("Write my own prompt", validated client-side with an inline error). Both go through
  `lib/game.ts`'s new `setPrompt` transition (valid only while RANKING) so the change is
  shared through the store like any other write. "Next round" now picks a random prompt
  that's never the one just played. Footer shows the player's role, not just the room.
  Reduced motion verified with Playwright's `reducedMotion: "reduce"` emulation (`.flip-inner`
  transition-duration is actually `0s`, not just visually subtle).
  **Bug fixed in this pass:** `CardTable`'s master/guesser slots were both wired to the same
  tap handler regardless of whose turn it was, so clicking the *other* player's empty slot
  while placing could silently consume your selected card (the prototype guarded this
  per-cell; the port had dropped that guard). Fixed by only passing `onTapMaster`/
  `onTapGuesser` when that column is actually interactive for the current viewer right now
  - `CardSlot` renders a plain `role="img"` div (not a button) when its column isn't
  interactive, which also fixed a dead-button-in-tab-order a11y issue. Verified with a
  Playwright regression test (select a card, click the other column, confirm the card is
  still selected and unplaced).
- **Stage 5 (done):** README covers Firebase setup, recommended Realtime Database rules
  (`games/$roomId` read/write, deny-by-default everywhere else - matches what's already
  configured on the project behind `.env.local`), the five env vars, known limitations
  (no auth/anti-cheat, the score quirk, role selection being per-tab not per-room),
  Vercel deployment, and renaming via `GAME_TITLE`. All 5 build stages from the brief
  are now complete.
