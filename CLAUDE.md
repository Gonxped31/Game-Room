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

## Status

- **Stage 1 (done):** static card-table UI in local component state, including the
  3D flip animation and the full RANKING → GUESSING → REVEALED loop (role-switch via
  "Change role" to play both sides in one tab). No `lib/game.ts`, no store, no
  persistence yet — intentional, arrives in Stage 2/3.
- Stage 2: game logic/state machine + localStorage persistence + tests.
- Stage 3: Firebase backend with transactions.
- Stage 4: prompt bank, custom prompts, round swap polish, a11y, reduced motion.
- Stage 5: README (setup, deploy, rename, known limitations).
