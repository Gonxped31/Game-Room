---
name: checkmate-grid
description: Reference for working on Checkmate Grid (slug regions), the Queens-style region-logic puzzle with chess pieces - solo (endless and daily) and as a race with others (Challenge, Survival, matchmaking by mode) - its rules and pieces, the solver and seeded generator, the board UI, the offline export and gotchas. Use whenever changing or debugging anything under lib/games/regions/, components/regions/ or app/regions/, or answering questions about how Checkmate Grid plays. For the shared daily system (lib/daily/, app/api/daily/), also read docs/daily.md.
---

# Checkmate Grid

A puzzle (the title is a working name; the slug stays `regions`). An N×N
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
solved. **The lock belongs to the puzzle it was used on** (`puzzleId`: the
Endless puzzle's fingerprint, the Daily day): New puzzle, Next puzzle and
Change → Start all give an unlocked button. Each mode saves its last press
with its puzzle (wall clock, `AUTO_MARK_KEY` in `storage.ts`), so a reload or
a tab switch on the same puzzle keeps the lock, counting while the page is
closed. Locked means `aria-disabled` (still focusable), so in Playwright a tap
during the lock needs `click({ force: true })`; a plain click waits it out.

**A puzzle being built** (the 30 ms timeout after Start / New puzzle, so
"Shuffling…" paints) is cancelled by a newer deal, Change or leaving the tab:
a late one must never land, or it would be saved and resume on reload.

State: plain React state per component, plus the localStorage helpers in
`storage.ts` for whatever must survive a reload. No Zustand: the project
doesn't use it, and it isn't needed at this size (the user offered it,
2026-10-26); worth revisiting if several games share a lot of saved state.

## Racing others (`lib/games/regions/race.ts`, `app/regions/race/page.tsx`)

Challenge and Survival run on the shared race layer (`docs/race.md`: modes,
timing, scoring, how a round ends, the screens). Checkmate Grid's own parts:
- **Rounds are puzzles**: one piece for every round, or "mixed" (rook, king,
  knight, queen, mix in turn); the grid grows from 6×6 by one every two
  rounds, up to 9×9, and from the third round the logic must reach level 2
  (not for rooks) (`roundSpec`).
- **The state holds only the seed**: every device builds the puzzle with
  `generate` (`puzzleOf`, cached per device; the generator is the same in
  every engine). If no puzzle that hard comes from a seed, any level will do,
  the same on every device.
- **Score**: the time of the solving move, no penalty; `found` is the pieces
  that clash with none, which the player's own board already shows, so the
  others' counts ("3 of 7 pieces") say how far, never where.
- **Runs**: `regionsRuns/{seat}` (`moves`: every tap, ✕ included). The page
  keeps its own moves in state (a drag sets several cells before React
  re-renders) and **appends each move on its own** (`updateRoot` at
  `moves/{n}`; the first move of a round writes the whole run). A reload
  takes the moves back from the database. Undo and Clear are new moves
  (the cell back to what it was), so the run only grows; Undo's list is
  this device's, and a reload empties it.
- **Auto ✕** works as in solo, locked per round (`room:startsAt`).
- **Results**: the picked player's board; an unsolved one shows the answer's
  pieces faintly (`Board`'s `answer`).
- **Rules**: `regions` (`pieces`, `seed`, `extra` always 0) and
  `regionsRuns/$seat` (`moves`, 1000 at most, `cell` 0–80, `to` 0–2).
- **Live test**: `.claude/skills/live-test/scripts/checkmate-grid-race.mjs`
  (it reads each board from the page and solves it).

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
- **Every change**: `node .claude/skills/live-test/scripts/checkmate-grid.mjs
  [baseUrl] [profile]` on `iphone-se` and `desktop` - the edge cases (Auto ✕
  per puzzle, reloads, tab switches, build races), not just the basic path
  (the user's ask, 2026-10-26). Add a case to it for every new interaction.
- The daily end to end needs the emulator dev server (it sets the admin SDK's
  emulator hosts) and separate browser contexts; give each its own
  `x-forwarded-for` header, or every guest after the first is unranked by the
  one-ranked-attempt-per-connection rule.
