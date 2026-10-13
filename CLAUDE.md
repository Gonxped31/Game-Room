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
- Stage 3: Firebase backend with transactions, same `Store<T>` interface.
- Stage 4: prompt bank, custom prompts, round swap polish, a11y, reduced motion.
- Stage 5: README (setup, deploy, rename, known limitations).
