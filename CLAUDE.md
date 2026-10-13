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
- Stage 5: README (setup, deploy, rename, known limitations).
