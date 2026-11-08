---
name: first-to-worst
description: Same Page (formerly First to Worst, slug ftw), the 2-player ranking game - rules, state machine, prompts.json. Use when changing or debugging lib/games/ftw/, components/ftw/, app/same-page/, or asked how it plays.
---

# Same Page (formerly First to Worst)

A private 2-player ranking game. Each round has a prompt and exactly 5 items.
The **ranker** (`master` in the code) privately puts rank notes 1 (best) to 5
(worst) on them, the **guesser** tries to match that order, and both are revealed
and scored. Roles swap every round.

- **Source of truth for UI, copy and motion**: `references/ftw/first-to-worst-game-design.md`
  (the "Same Page: Visual Spec": a notebook on a lilac desk, sticky-note ranks).
- `references/ftw/first-to-worst.html` is the original First to Worst prototype,
  superseded wherever the spec differs.
- **Names**: the UI says Same Page everywhere (`GAME_TITLE`), but the data slug
  stays `ftw` (`meta.gameSlug`, `games/{room}/ftw`, the rules, saved rooms). The
  route is `/same-page` (registry `path`); `next.config.ts` redirects `/ftw`, and
  browsers keep the `#code` across the redirect.

Detail, next to this file: `reference.md` (every file and what it exports, topics and
live placement in full, seats and players, the page's render order and leaving, input,
sizing and motion) and `prompts.md` (the prompt bank's shape, checks and conventions).

## Key files

- `lib/games/ftw/game.ts` - the pure state machine (`newGame`, `lockIn`, `submitGuess`,
  `nextRound`, `setPrompt`). Each throws on an invalid transition and never mutates.
- `lib/games/ftw/scoring.ts` - per-card exact match. **A score of 4 is mathematically
  impossible** (if four cards match, so does the fifth). Expected, not a bug.
- `lib/games/ftw/constants.ts` - `GAME_TITLE` (the only place the title lives),
  `ITEMS_PER_ROUND` (**the only place "5" is encoded; never hardcode it**), text caps.
- `components/ftw/Rules.tsx` - How to play (`docs/how-to-play.md`). A rules change
  updates it too.

## State and Firebase

- `GameState` contains `round`, `totals{p1,p2}`, `current{prompt, items[5],
  status, masterOrder?, guessOrder?, score?, placed?}`, `usedPrompts[]`,
  `history[]` and `topics?[]`.
- **Topics** (`setTopics`): **only the round's master changes them** (it throws for
  anyone else); absent means every topic. Detail: `reference.md`.
- **Live placement progress** (`current.placed`): the IDs of the filled slots, **never
  the numbers**, because the other player can read the room.
- **Its shape is validated by `database.rules.json`** (the `ftw` node).
  - If you add or rename a field, update the rules **and** the cases in
    `tests/rules/gameState.test.ts`, then run `npm run test:rules`. Otherwise the
    database refuses the new state.
  - Free-text caps must match the rules' caps.
- **RTDB drops empty arrays**, so `usedPrompts`/`history` can read back as
  `undefined`. Always read them as `value ?? []` (see `addUsedPrompt`).
- **Never write an explicit `undefined`.** Clear an optional field by building a
  fresh object without it.

## Prompt bank (`prompts.json`)

Adding a prompt is adding an entry to its category's array; `npm test` checks it.
**The categories are the topics players pick**: user-facing, ≤ 60 characters, and
renaming one drops it from rooms that chose it. Everything else: `prompts.md`.

## Seats and page flow

- **"Reset game"** (`setGame(newGame(...))`) restarts the game only; both stay seated.
- The board is withheld until both players have joined. "Leave room" asks first
  (`AskDialog`) once both are seated. Render order and the rest: `reference.md`.

## UI gotchas

- **Layout**: one column under 900px (banner, sheet, the hand + button dock,
  extras). From 900px `Frame` is a grid: an aside (300-380px: score card, banner,
  dock, extras) beside the sheet (up to 720px), via `grid-template-areas`, so the
  DOM order stays the phone order.
- **The dock is `sticky`, not `fixed`**, on phones while placing: the hand and
  the lock button stay reachable on short screens without the old fixed bar's
  clearance padding.
- **Tap targets**: only the placing player's rows are buttons; the waiting and
  reveal sheets are plain lists. A past bug let a tap on the *other* player's
  empty slot consume your selected card.
- **Tap, keyboard, drag** (Pointer Events, additive to tapping), **sizing** (five hand
  notes fit at 375px) and **motion** (off under reduced motion): `reference.md`.
- **Copy**: the hand caption says "item" (the bank has no per-prompt noun), and
  "{partner} locked in their order" (no guessed pronouns).

## Verifying a change

- `npm test` for logic and the prompt bank, and `npm run test:rules` if the state
  shape changed.
- For anything visible, use the `ui-review` skill (phone and desktop screenshots;
  the `iphone-se` profile is the 375px width the 5-note hand must fit).
- For multi-device flows, use the `live-test` skill: an iPhone against a desktop
  player, in Playwright, against the emulators.
