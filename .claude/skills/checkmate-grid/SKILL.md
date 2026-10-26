---
name: checkmate-grid
description: Reference for working on Checkmate Grid (slug regions), the solo Queens-style region-logic puzzle with chess pieces - its rules and pieces, the solver and seeded generator, endless and daily modes, the board UI, the offline export and gotchas. Use whenever changing or debugging anything under lib/games/regions/, components/regions/ or app/regions/, or answering questions about how Checkmate Grid plays. For the shared daily system (lib/daily/, app/api/daily/), also read docs/daily.md.
---

# Checkmate Grid

A solo puzzle at `/regions` (the title is a working name; the slug stays
`regions`). An N×N grid (5–9) is split into N coloured regions. Place N chess
pieces, **one per row, per column and per region**, with **no piece attacking
another by its own moves**. No rooms, no rules node for game state.

| Variant | Extra rule (rows/columns are already covered) |
| :--- | :--- |
| `rook` | none: the easy level |
| `king` | no two touch, diagonals included (classic Queens) |
| `knight` | no two a knight's move apart |
| `queen` | no two on a diagonal at any distance. With one piece per row and column, a queen attacks exactly what a bishop does, so the bishop only appears in mix |
| `mix` | each region shows its own piece (rook, king, knight, bishop; at least 3 kinds) and the piece placed there must not attack any other, nor be attacked |

**Why one per row and column for every piece, even knights** (tried and
measured, 2026-10-25; the user chose to keep the rule for all): with only
"one per region + real chess attacks", knight, king and bishop puzzles can't
be made unique. For a single solution, every empty square must be attacked by
some other region's piece (or that region's piece could move there): 72
squares on a 9×9, while 9 knights or kings attack at most 72 between them.
The generator failed every time, even with 25× more repair steps. Rooks,
queens and mix worked. The row and column rule is the puzzle's frame (as in
Queens); the pieces' chess moves add to it.

Two modes, as tabs on the page: **Daily puzzle** (one grid for everyone, global
board; docs/daily.md) and **Endless** (generated on the device, best time per
piece and size kept in localStorage). Endless opens on a setup card - piece,
size, Start - and generates nothing before Start (the user's call, 2026-10-26);
while playing, Change goes back to it, New/Next puzzle keep the piece and size.
The offline download (/admin) is Endless only.

**A reload loses nothing** (`components/regions/storage.ts`, this device's
localStorage): the tab is remembered; the Endless puzzle in progress (grid,
moves, time spent) resumes, its clock continuing without the time the page
was closed, and is forgotten on a solve or Change; today's Daily moves come
back on top of the server's resumed attempt (the server keeps the puzzle and
the clock), and a solve that never reached the server is sent on resume.

**Auto ✕** is a button, the same in both modes (`useAutoMark` +
`AutoMarkButton` in `Controls.tsx`; the user's calls, 2026-10-26): a press
**shows** a faint ✕ on every square the placed pieces rule out - it never
places marks - for 3 s, then they fade out, and the button stays locked until
30 s after the press. It can't be pressed with no piece on the board or once
solved. Locked means `aria-disabled` (still focusable), so in Playwright a tap
during the lock needs `click({ force: true })`; a plain click waits it out.

## Files

| Path | What |
| :--- | :--- |
| `lib/games/regions/board.ts` | `Puzzle` (`size`, `variant`, `regions[cell]`, `pieces[region]`), `attacks`, `clashes`, `clashTable`, `check` |
| `lib/games/regions/solver.ts` | `solutions(puzzle, limit)` (exact, branches on the unit with fewest open cells); `solveByLogic` (person-style deductions, levels 1–4; the hardest used is the difficulty) |
| `lib/games/regions/generate.ts` | `generate(seed, { size, variant, minLevel?, maxLevel? })`: placement → regions grown evenly (weight 1/size²) → break every other solution by moving one of its cells into a neighbouring region → keep once `solveByLogic` finishes within the level range → `relabel` (region numbers in reading order, so they leak nothing) |
| `lib/games/regions/play.ts` | A game in progress: `marks` (empty / ✕ / piece), the `moves` log `{cell, to, t}`, `setMark`, `undo`, `clearAll`, `replay`, `ruledOut` (auto-✕) |
| `lib/games/regions/daily.ts` | The `DailyGame` for docs/daily.md: weekly `SCHEDULE` (Mon rook 6 … Sun mix 9), `verify` replays the moves |
| `lib/games/regions/theme.ts` | Colors (match `regions.css`), region pastels, chess glyphs, rule lines |
| `components/regions/Stage.tsx` | The page shell, mode tabs; `online` adds Daily (the site), off for the export |
| `components/regions/Board.tsx` | The grid: tap cycles, drag from an empty cell paints ✕, arrow keys + Enter/Space |
| `components/regions/EndlessGame.tsx`, `DailyGame.tsx` | The two modes |
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
- The page height on a 375px phone: the board's bottom rows sit below the
  fold until you scroll once; the board itself doesn't scroll (touch-action
  none, for dragging).

## Verifying

- `npm test`: `lib/games/regions/*.test.ts` (attacks, check, every variant ×
  size generates a unique, logic-solvable puzzle, determinism, play/replay),
  `lib/daily/daily.test.ts`.
- `ui-review` for `regions` and `hub`; drive the board with a scratch script
  (scroll the board into view first on phone profiles).
- The daily end to end needs the emulator dev server (it sets the admin SDK's
  emulator hosts) and separate browser contexts; give each its own
  `x-forwarded-for` header, or every guest after the first is unranked by the
  one-ranked-attempt-per-connection rule.
