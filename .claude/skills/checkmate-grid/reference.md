# Rank & File: design decisions, solo behaviour, racing others

The detail behind the `checkmate-grid` skill's `SKILL.md` (next to this file).

## Why one per row and column for every piece

**Why one per row and column for every piece, even knights** (tried and
measured, 2026-10-25; the user chose to keep the rule for all): with only
"one per region + real chess attacks", knight, king and bishop puzzles can't
be made unique. For a single solution, every empty square must be attacked by
some other region's piece (or that region's piece could move there): 72
squares on a 9×9, while 9 knights or kings attack at most 72 between them.
The generator failed every time, even with 25× more repair steps. Rooks,
queens and mix worked. The row and column rule is the puzzle's frame (as in
Queens); the pieces' chess moves add to it.

## Solo behaviour (the user's calls)

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
timing, scoring, how a round ends, the screens). Rank & File's own parts:
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

## Verifying the daily end to end

- The daily end to end needs the emulator dev server (it sets the admin SDK's
  emulator hosts) and separate browser contexts; give each its own
  `x-forwarded-for` header, or every guest after the first is unranked by the
  one-ranked-attempt-per-connection rule.
