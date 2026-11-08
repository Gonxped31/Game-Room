# Last Hop: the generator, the board UI and How to play

The `lasthop` skill's `SKILL.md` (next to this file) has the rules, files and gotchas; this is the detail.

## The generator

- **Track**: picks `2k` distinct squares, the leftmost `k` for A. Keeps it if
  it isn't its own mirror, both sides can move, and `solve` says perfect play
  lasts at least `MIN_TRACK_LENGTH` (12) moves whoever starts. Tracks are small
  enough to solve whole (under ~40k positions).
- **Grid**: too big to solve, so it keeps boards whose random games average at
  least `MIN_GRID_PLAYOUT` (20) moves.
- `generateBoard(mode, random, avoid)` never deals `avoid` (the board just
  played): Tracks are a small space, and a new pair once repeated the last.
- The page generates the board in the transaction (`Math.random`); `nextRound`
  only uses it when a new pair starts (`needsFreshBoard` lets the device skip
  generating one).

## The board UI

- **The viewer's pieces come from the bottom (or right) and move up (or
  left)**: whoever plays A sees the board turned half a turn (`rotated`, done by
  reversing the render order, so display coordinates come from `xy`). The
  opponent's bar is on top, yours below. Spectators see it unturned.
- **Pieces wear their player's colour and pawn** for the whole match,
  whichever side they play that round. Colour is the seat's (p1 tangerine, p2
  mint). **Each player picks their own pawn** (the user's call, 2026-10-30:
  a personal choice, so the guest picks too): Square, Circle, Frog, Bunny,
  Bear, Star, Heart, Ghost (`PAWNS`), drawn flat in `pawns.tsx`. Picked in the
  lobby, the matchmaking waiting screen or after a match (`setPawn` refuses
  mid-match and the other player's pawn); defaults p1 Square, p2 Circle
  (`pawnOf`). Reset keeps the picks. They show on the board, the player bars,
  the round list and the How to play drawings; the hub art and tile keep the
  defaults.
- A Track is a **column on phones** (cells sized from `100dvh`, 34-54px) and a
  **row from 640px**. The chevron in each piece points forward
  (`lh-fwd`/`lh-back`, rotated by CSS per layout).
- Tap a piece that can move (white ring) → its targets show (dashed yellow,
  "move here") → tap one. On your turn, pieces that can't move are dimmed. The
  bars show each side's available moves, so running out is visible.
- The landing piece hops in from `last.from` (CSS vars `--d` or `--dx/--dy`,
  keyed on `moves`); off under reduced motion.

## How to play

`components/lasthop/Rules.tsx`: the full rules in a modal `<dialog>`, opened
from the header's **?** (every screen) and the lobby's "Read the full rules"
(the user asked for an explainer, 2026-10-30). Its drawings (slide, jump,
blocked, the Grid's two directions) use the viewer's own shape and colour.
Keep it in step with the rules here when they change (clocks come from
`CLOCKS`).
