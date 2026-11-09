---
name: lasthop
description: Last Hop, the 1v1 hop-forward duel (Track or Grid) - rules, board generator, chess clock, paired matches. Use when changing or debugging lib/games/lasthop/, components/lasthop/, app/lasthop/, or asked how it plays.
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
  bottom-right). **The mode is picked on the hub's Start** (registry `modes`,
  `?mode=`, dropped from the link once the room exists). **In a private room
  the host decides everything, the guest only plays** (the user's calls,
  2026-10-30): the mode (a switch in the lobby and on the result screen;
  `setMode` refuses mid-match, so the host uses Reset game to go back to the
  lobby), Start, Play again and Reset game (which keeps the mode and pawns).
  "The host" is the creator, or whoever is left if the creator has gone
  (`isHost` in the page). The guest sees the host's pick and "Waiting for Sam
  to start…".
- **Matchmaking**: one queue per mode (`LASTHOP_MATCH`, `meta.publicLang` =
  `track` or `grid`; the rules keep the room's `mode` equal to it while it's
  in the lobby, the only phase it's listed in). A public room starts by itself
  once both players are online (`usePublicRoom`) and has no host, Reset game
  or New room. **After a match both players vote** (`vote`, `votes`): "Replay
  Track" or "Change to Grid"; the next match starts once both pick the same,
  a pick can be changed, and leaving is just Leave room. If the other player
  leaves, the one left gets **Find another player** (searches the queue of the
  mode the room plays now).
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
| `lib/games/lasthop/game.ts` | The state machine (`LastHopState`): `startMatch`, `move`, `flag`, `nextRound`, `setMode` (lobby or between matches), `vote` (matchmaking); `dueAt`, `clockLeft`, `seatOf`/`colourOf`/`moverOf`; `matchId` (the finished-game report's id, `docs/tracking.md`) |
| `lib/games/lasthop/constants.ts` | Modes, clocks, delays, round limits |
| `app/lasthop/page.tsx` | Session (`useGameSession`), deadlines (`flag` or `nextRound`), screens |
| `components/lasthop/` | `Board.tsx` (wells, pieces, select then move, the hop animation), `Screens.tsx` (header, player bars with clocks, lobby, round banner, match over, footer, dialog), `ui.tsx` (tokens, buttons, `formatClock(ms, lang)`, `PieceMark`), `text.ts` (every word, EN and FR), `pawns.tsx` (the pawn drawings), `lasthop.css` (board sizes, animation), `Rules.tsx` (How to play) |
| `database.rules.json` → `lasthop` | Validates the whole state; `maxPlayers` must be 2 |
| `lib/games/matchGames.ts` → `LASTHOP_MATCH` | The two matchmaking queues |
| `.claude/skills/live-test/scripts/last-hop.mjs` | Desktop host vs a phone (`[phoneProfile]`, default `iphone`): Start's mode, host-only mode, a whole Track match, a Grid round; then a matchmaking pair |

## Generator, board UI, How to play

`reference.md` (next to this file): how Tracks are solved and Grids played out, the
board UI (the A player's board turned half a turn, pawns, phone column vs 640px
row, select-then-move, the hop animation) and the How to play dialog.
`components/lasthop/Rules.tsx` is How to play: keep it in step with the rules here
when they change (clocks come from `CLOCKS`).

## Gotchas

- **Don't make A/B a player's identity**: seats swap colours every round.
  Everything shown to players goes through `seatOf`/`colourOf`.
- **`clocks` holds what was left when the current turn started**; the running
  clock is `clockLeft(state, seat, now)`. `move` charges `now - turnStartedAt`
  (never negative, so a move during "Get ready" is free) and adds the increment.
- **"Get ready" is only before a round's first move** (`moves > 0`): after
  that, a device whose server clock runs behind the mover's would otherwise
  lock the board for a moment after every opposing move.
- `move` refuses once the mover's flag time has passed, so a late move can't
  beat a `flag` that's due.
- The rules cap `round` and `score` at 10 and `history` keys at `0-9`, matching
  `MAX_ROUNDS`. Raise them together.
