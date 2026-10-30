---
name: lasthop
description: Reference for working on Last Hop (slug lasthop), the 1v1 hop-forward duel on a Track (one row) or a Grid - its rules, why boards are never mirror images and are played twice, the board generator and solver, the match and chess clock, the state machine, the board UI and gotchas. Use whenever changing or debugging anything under lib/games/lasthop/, components/lasthop/ or app/lasthop/, or answering questions about how Last Hop plays.
---

# Last Hop

A 1v1 duel (`/lasthop#room`) built on the old Frogs and Toads puzzle, made
competitive (the user's design, 2026-10-29/30).

## Rules

- Each player has pieces of one colour. **A** moves right (and on a Grid, also
  down); **B** moves left (and up). Never backward.
- A move **slides** one square into an empty one, or **jumps exactly one
  opposing piece** into the empty square behind it. Never over your own piece,
  never over two.
- **If it's your turn and you have no move, you lose the round.** So rushing
  across burns moves you'll want later: the game is about saving moves and
  blocking theirs. A always moves first.
- **Modes**: **Track** (8-11 squares, 3-4 pieces a side, every A starting left
  of every B) and **Grid** (4x4 or 5x5, A in the top-left corner, B in the
  bottom-right). Either player picks the mode in the lobby.
- **Chess clock**: Track 1 min each +2 s a move, Grid 2 min each +3 s a move
  (`CLOCKS`). Running out loses the round. The clock starts 3 s after a round
  is dealt (`START_DELAY_MS`, "Get ready"). A player who goes offline keeps
  running down their clock.
- **Match**: rounds in pairs. Each board is played twice with the players
  swapping colours (`aSeatOf`: `firstA` in odd rounds, the other seat in even
  ones; `firstA` is drawn at the start of a match). The match ends once the
  trailing player can't catch up by the end of round 4 or of the current pair,
  whichever is later (`matchDecided`): 3-0 after 3 ends it, 2-2 after 4 plays
  another pair. Still level after `MAX_ROUNDS` (10): a draw.

## Why boards are never mirror images

On a board that is its own mirror image (turned half a turn with the colours
swapped), **the second player can copy every move turned half a turn and always
win**: on 4x4 Grids the copy is always legal. So `generateBoard` rejects them,
and fairness comes from the pair instead (both players play both sides). The
generator tests in `board.test.ts` check it.

## Files

| Path | What |
| :--- | :--- |
| `lib/games/lasthop/board.ts` | `Board` (`w`, `h`, row-major `cells` of `A`/`B`/`.`), `legalMoves`, `applyMove`, `mirrored`, `solve` (perfect play: who wins, game length), `generateBoard` (+ `playable`, `FALLBACK`) |
| `lib/games/lasthop/game.ts` | The state machine (`LastHopState`): `startMatch`, `move`, `flag`, `nextRound`, `toLobby`, `setMode`; `dueAt`, `clockLeft`, `seatOf`/`colourOf`/`moverOf` |
| `lib/games/lasthop/constants.ts` | Modes, clocks, delays, round limits |
| `app/lasthop/page.tsx` | Session (`useGameSession`), deadlines (`flag` or `nextRound`), screens |
| `components/lasthop/` | `Board.tsx` (wells, pieces, select then move, the hop animation), `Screens.tsx` (header, player bars with clocks, lobby, round banner, match over, footer, dialog), `ui.tsx` (tokens, buttons, `formatClock`), `lasthop.css` (board sizes, animation) |
| `database.rules.json` → `lasthop` | Validates the whole state; `maxPlayers` must be 2 |
| `.claude/skills/live-test/scripts/last-hop.mjs` | Desktop vs a phone (`[phoneProfile]`, default `iphone`): a whole Track match and a Grid round |

## The generator

- **Track**: picks `2k` distinct squares, the leftmost `k` for A. Keeps it if
  it isn't its own mirror, both sides can move, and `solve` says perfect play
  lasts at least `MIN_TRACK_LENGTH` (12) moves whoever starts. Tracks are small
  enough to solve whole (under ~40k positions).
- **Grid**: too big to solve, so it keeps boards whose random games average at
  least `MIN_GRID_PLAYOUT` (20) moves.
- The page generates the board in the transaction (`Math.random`); `nextRound`
  only uses it when a new pair starts (`needsFreshBoard` lets the device skip
  generating one).

## The board UI

- **The viewer's pieces come from the bottom (or right) and move up (or
  left)**: whoever plays A sees the board turned half a turn (`rotated`, done by
  reversing the render order, so display coordinates come from `xy`). The
  opponent's bar is on top, yours below. Spectators see it unturned.
- **Pieces wear their player's colour** for the whole match (p1 tangerine, p2
  mint), whichever side they play that round.
- A Track is a **column on phones** (cells sized from `100dvh`, 34-54px) and a
  **row from 640px**. The chevron in each piece points forward
  (`lh-fwd`/`lh-back`, rotated by CSS per layout).
- Tap a piece that can move (white ring) → its targets show (dashed yellow,
  "move here") → tap one. On your turn, pieces that can't move are dimmed. The
  bars show each side's available moves, so running out is visible.
- The landing piece hops in from `last.from` (CSS vars `--d` or `--dx/--dy`,
  keyed on `moves`); off under reduced motion.

## Gotchas

- **Don't make A/B a player's identity**: seats swap colours every round.
  Everything shown to players goes through `seatOf`/`colourOf`.
- **`clocks` holds what was left when the current turn started**; the running
  clock is `clockLeft(state, seat, now)`. `move` charges `now - turnStartedAt`
  (never negative, so a move during "Get ready" is free) and adds the increment.
- `move` refuses once the mover's flag time has passed, so a late move can't
  beat a `flag` that's due.
- The rules cap `round` and `score` at 10 and `history` keys at `0-9`, matching
  `MAX_ROUNDS`. Raise them together.
