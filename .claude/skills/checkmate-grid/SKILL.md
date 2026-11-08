---
name: checkmate-grid
description: Rank & File (formerly Checkmate Grid, slug regions), the chess-piece region puzzle - solo, daily, races, solver, generator, board UI, offline export. Use when changing or debugging lib/games/regions/, components/regions/, app/regions/.
---

# Rank & File

A puzzle, named Rank & File on 2026-11-01 (it was Checkmate Grid, a working
title; the slug stays `regions`, like `/regions` and its rooms). An N×N
grid (5–9) is split into N coloured regions. Place N chess pieces, **one per
row, per column and per region**, with **no piece attacking another by its
own moves**. Played two ways:
- **Solo** at `/regions`: the daily puzzle and Endless (below). No room.
- **With others** at `/regions/race#room`, in the hub's "Play from
  anywhere": Challenge or Survival, private or matchmade ("Racing others",
  below). The rooms live under `/regions/race` so `/regions` stays the solo
  page its daily players have bookmarked.

| Variant | Extra rule (rows/columns are already covered) |
| :--- | :--- |
| `rook` | none: the easy level |
| `king` | no two touch, diagonals included (classic Queens) |
| `knight` | no two a knight's move apart |
| `queen` | no two on a diagonal at any distance. With one piece per row and column, a queen attacks exactly what a bishop does, so the bishop only appears in mix |
| `mix` | each region shows its own piece (rook, king, knight, bishop; at least 3 kinds) and the piece placed there must not attack any other, nor be attacked |

**One per row and column for every piece, even knights** (2026-10-25, the user's call):
without it, knight, king and bishop puzzles can't be made unique. Why, measured, and the
solo and race detail: `reference.md` (next to this file).

Two modes, as tabs on the page: **Daily puzzle** (one grid for everyone, global
board; docs/daily.md) and **Endless** (generated on the device, best time per
piece and size kept in localStorage). Endless opens on a setup card - piece,
size, Start - and generates nothing before Start (the user's call, 2026-10-26);
while playing, Change goes back to it, New/Next puzzle keep the piece and size.
The offline download (/admin) is Endless only.

Solo, each the user's call: **a reload loses nothing** (`components/regions/storage.ts`);
**Auto ✕** shows what the pieces rule out for 3 s, locked 30 s per puzzle (`aria-disabled`:
Playwright needs `force: true`); **a puzzle being built** is cancelled by a newer deal,
Change or leaving the tab (a late one must never land). No Zustand: plain React state.

## Racing others (`lib/games/regions/race.ts`, `app/regions/race/page.tsx`)

Challenge and Survival run on the shared race layer (`docs/race.md`). Rank & File's
own parts (rounds are seeded puzzles, the score, append-only `regionsRuns`, Auto ✕
per round, results, rules, the live test): `reference.md`.

## Files

| Path | What |
| :--- | :--- |
| `lib/games/regions/board.ts` | `Puzzle` (`size`, `variant`, `regions[cell]`, `pieces[region]`), `attacks`, `clashes`, `clashTable`, `check` |
| `lib/games/regions/solver.ts` | `solutions(puzzle, limit)` (exact, branches on the unit with fewest open cells); `solveByLogic` (person-style deductions, levels 1–4; the hardest used is the difficulty) |
| `lib/games/regions/generate.ts` | `generate(seed, { size, variant, minLevel?, maxLevel? })`: placement → regions grown evenly (weight 1/size²) → break every other solution by moving one of its cells into a neighbouring region → keep once `solveByLogic` finishes within the level range → `relabel` (region numbers in reading order, so they leak nothing) |
| `lib/games/regions/play.ts` | A game in progress: `marks` (empty / ✕ / piece), the `moves` log `{cell, to, t}`, `setMark`, `undo`, `clearAll`, `replay`, `ruledOut` (auto-✕) |
| `lib/games/regions/daily.ts` | The `DailyGame` for docs/daily.md: weekly `SCHEDULE` (Mon rook 6 … Sun mix 9), `verify` replays the moves |
| `lib/games/regions/theme.ts` | Colors (match `regions.css`), region pastels, chess glyphs, rule lines |
| `lib/games/regions/race.ts` | Racing others, on `lib/games/race/`: `GridRaceState`, `Run`, `roundSpec`, `puzzleOf`, `playOf`, `scoreOf`, `race` |
| `app/regions/race/page.tsx` | The race room page |
| `components/regions/race/Screens.tsx` | The race room's shell and lobby settings; the rest is `components/race/` |
| `components/regions/Stage.tsx` | The page shell, mode tabs; `online` adds Daily (the site), off for the export |
| `components/regions/Board.tsx` | The grid: tap cycles, drag from an empty cell paints ✕, arrow keys + Enter/Space |
| `components/regions/EndlessGame.tsx`, `DailyGame.tsx` | The two modes |
| `components/regions/Rules.tsx` | How to play (`docs/how-to-play.md`): the header's ? (Stage's `rules`, passed by the site's page, and the race shell) and a link in the race lobby's settings. Tailwind classes, so it stays out of the exported Stage. A rules change updates it too |
| `components/regions/regions.css` | **All styles, plain CSS** (`cg-*`, plus the shared leaderboard's `daily-*`) |
| `exports/regions/` | The offline single-file export (scripts/export-solo.mjs) |

## Gotchas

- **Plain CSS, not Tailwind utilities**, in `components/regions/`: the export
  compiles only Tailwind's base, so utility classes would vanish offline.
- **The board captures the pointer** (for drag-painting), so the browser's
  click lands on the board, not the cell: pointer taps are handled on
  pointer-up, and the buttons' `onClick` only answers the keyboard
  (`event.detail === 0`).
- **A drag sets several cells before React re-renders**: both modes keep the
  latest `Play` in a ref (`latest`) and build each move on it, never on the
  render's `play`.
- **Move times `t` must never go backwards**: `replay` (and so the daily
  check) refuses them.
- **Generation runs off the render** (a timeout after "Shuffling…" paints):
  it uses `crypto.randomUUID()` and can take ~0.4 s for 9×9 queen or mix.
- **Glyphs carry U+FE0E** so phones draw them as text, not emoji.
- The page height on a 375px phone: the board's bottom rows sit below the fold until
  you scroll once; the board itself doesn't scroll (touch-action none, for dragging).

## Verifying

- `npm test`: `lib/games/regions/*.test.ts` (attacks, check, every variant ×
  size generates a unique, logic-solvable puzzle, determinism, play/replay),
  `lib/daily/daily.test.ts`.
- `ui-review` for `regions` and `hub`; drive the board with a scratch script
  (scroll the board into view first on phone profiles).
- **Every change**: `node .claude/skills/live-test/scripts/checkmate-grid.mjs
  [baseUrl] [profile]` on `iphone-se` and `desktop` - the edge cases (Auto ✕
  per puzzle, reloads, tab switches, build races), not just the basic path
  (the user's ask, 2026-10-26). Add a case to it for every new interaction.
- The daily end to end needs the emulator dev server and separate browser contexts,
  each with its own `x-forwarded-for` header: `reference.md`.
