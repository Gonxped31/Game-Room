---
name: wordscramble
description: Reference for working on Word Scramble, the 2-8 player team word game - its rules, team lobby, state machine, scrambling, server-clock timing, the typing signal, word lists (EN/FR), page flow and gotchas. Use whenever changing or debugging anything under lib/games/wordscramble/, components/wordscramble/ or app/wordscramble/, editing words.json, or answering questions about how Word Scramble plays.
---

# Word Scramble

Two teams of equal size (1v1 to 4v4) take turns unscrambling a word against a 30 s
clock (`/wordscramble#room`). Anyone on the playing team can guess, and the other
team watches. A word is worth its letters minus 1 per hint. The host (the room's
creator) sets the language (EN/FR) and the length: turns per team (3–10) or a target
score (20/30/40).

**Source of truth**:
- `references/scramble/word-scramble-game-design.md` - rules, flow, timing, content.
- `references/scramble/word-scramble-visual-spec.md` - tokens, screens, copy, motion.
  Breakpoint **900px**.

## Files

| Path | What |
| :--- | :--- |
| `lib/games/wordscramble/game.ts` | The pure state machine (`ScrambleState`), `advance`, `scramble`, `pickWord`, `plain` |
| `lib/games/wordscramble/teams.ts` | Teams: `members`, `suggestTeam`, `startProblem` (even?), `shuffleTeams` |
| `lib/games/wordscramble/words.json` | The lists, one word per line, real spelling |
| `lib/games/wordscramble/words.test.ts` | Validates them: 4–8 letters, no œ/æ, **no two words with the same letters** |
| `app/wordscramble/page.tsx` | Session (`useSession`, 8 seats, min 2), timers, guesses, hints, typing |
| `components/wordscramble/` | `ui.tsx` (tokens, tiles, buttons), `Screens.tsx` (lobby, scoreboard, end), `TurnScreen.tsx`, `TileBoard.tsx` (drag and drop) |
| `database.rules.json` → `wordscramble`, `wordscrambleTyping` | The state (`maxPlayers` must be 8); each seat's typing signal |
| `.claude/skills/live-test/scripts/word-scramble.mjs` | 2v2: desktop + two iPhones + Android |

## How a game runs

`lobby → [turn → (stealOffer → stealing) → result → scoreboard] × N → end`

- **Teams** live in the state (`teams`: seat to A/B), so Rematch keeps them. A newcomer
  in the lobby is put on the smaller team (the page does it); anyone can switch. Start
  needs every seated player on a team and both teams the same size. "Shuffle teams"
  re-deals and returns to the lobby.
- **Turns**: Team A plays the even ones. The first turn starts 3 s after Start ("Team A
  starts"). Every timed step (turn end, result, scoreboard) is a server-time
  `deadline`, applied by whichever device sees it pass (`useDeadline` + `assertDue`).
  `advance` draws the next word itself, inside the transaction.
- **The word never lives in the state**, only `wordId`. `guess` and `hint` take the
  word from the caller, and every device looks it up in `words.json`. Guesses compare
  `plain()`: uppercase, accents stripped. Tiles show plain letters too, so É gives
  nothing away.
- **Scramble**: `scramble(word, seed)` is never the word, and moves at least half the
  letters from 5 up. Hints place the leftmost letters, and are refused below 2 letters
  left to find.
- **Steal**: when time runs out (`timeUp`), the phase becomes `stealOffer` for 3 s.
  The first member of the other team to `claimSteal` gets `stealing`: 10 s and one
  `stealGuess`. `stealTimeout` counts as a miss, and `noSteal` applies when nobody
  claims. A steal is worth `stealValue` = ceil(worth / 2), won or lost, so scores can
  go negative (the rules allow −999..999). `advance` needs the current word to time
  out a steal.
- **Words**: `pickWord(bank, game, forTurn, random)`. Team B's word (odd turns)
  matches the length of Team A's word that round, so a clean game is level. Even turns
  change the length when they can. `usedWordIds` lives for the whole room session (it
  isn't cleared by Rematch or the lobby) and starts over only once a repeat was
  unavoidable. The rules allow up to 999 entries.
- **Ends**: turns mode, after both teams' last turn. Target mode, after a pair of turns
  in which a team reached the target (capped at 20 turns per team). A tie is a draw.
- **Guessing is drag and drop** (`components/wordscramble/TileBoard.tsx`). Each
  player arranges the tiles on their own device: drag into a slot, or tap to fill the
  next one. Confirm sends the word.
  - Drags use pointer events with `touch-none` (HTML5 drag-and-drop doesn't work on
    phones). The drop target is found with `elementFromPoint` and `data-slot` /
    `data-row`.
  - Hint letters are locked in their slots, and the board resets when a hint lands
    (its `key` includes `hints`).
  - On desktop, letter keys place tiles, Backspace takes one back, and Enter
    confirms.
- **"Is arranging…"**: `wordscrambleTyping/{seat}: { at }`, written at most every 2 s
  while a player moves tiles. Teammates show it for 3 s.

## Public rooms (matchmaking)

"Play online" rooms (`meta.publicLang`, `docs/matchmaking.md`) use the default
settings and have no host. `usePublicRoom` starts the game by itself once an even
number (2+) of players is online. `balanceTeams` evens out the teams among them
first, keeping picks that fit. The lobby hides the settings and the uneven-teams
warning.

## Gotchas

- Adding words: run `npm test`. It refuses a word that's an anagram of another in
  the same language, since a right answer would otherwise be refused. It can't see
  anagrams outside the list ("LISTEN" vs a "SILENT" we don't have), so avoid
  well-known pairs by hand.
- `ChunkyButton` drops its inline colors when disabled: inline styles beat Tailwind's
  `disabled:` classes, which once left a disabled Confirm looking clickable.
- Phone tiles shrink with the word's length (56 px down to about 37 px for 8 letters)
  so the row never wraps at 375 px.
- Players who leave mid-game keep their team until a Rematch, which drops them
  (`onlySeated`).
