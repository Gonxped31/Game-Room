# Word Scramble: Game Design

The rules, flow, state and content of Word Scramble. The look, layout, copy and motion
are in `word-scramble-visual-spec.md`; where the two overlap, this file owns behavior
and the visual spec owns presentation.

Name: **Word Scramble**. Slug: `wordscramble` (route `/wordscramble`, state at `games/{room}/wordscramble`).

## What the game is

Two teams take turns unscrambling a word against the clock. On your team's turn,
anyone on the team can type guesses; the first right guess scores the word's length.
Hints place one letter in its slot but take a point off. The other team watches,
read-only, and plays the next word.

## Players and teams

- **2 to 8 players in 2 teams of equal size:** 1v1, 2v2, 3v3 or 4v4. Start is disabled
  until the teams are even (and each has at least 1 player).
- Everyone is on their own device.
- Players pick Team A or B in the lobby and can switch until Start. **Rematch** keeps
  the teams; **Shuffle teams** reshuffles them evenly at random.
- **Host** = the room's creator. Only the host changes the settings and presses Start.
- Someone arriving mid-game watches as a spectator and joins a team at the next Rematch.

## Settings (host, in the lobby)

| Setting | Values | Default |
| :--- | :--- | :--- |
| Language | English, Français | the host's browser language, else English |
| Length | Turns: 3–10 per team / Target score: 20, 30, 40 | 5 turns per team |

- **Turns:** each team plays the same number of turns, alternating, Team A first.
- **Target score:** play continues in pairs of turns (A then B); the game ends after a
  pair in which a team has reached the target. Both teams always play the same number
  of turns.

## Flow

```
lobby -> [turn -> result -> scoreboard] x N -> end
```

1. **Turn (30 s).** At `startAt` (server clock), every device shows the scrambled word
   and starts the timer. The playing team can guess and use hints; the other team
   watches the same board read-only.
2. **Guess.** Each playing-team member arranges the tiles on their own device:
   - drag a tile into a slot, or tap it to send it to the next empty one;
   - tap or drag a placed tile to send it back, or drop a tile on a filled slot to swap;
   - Confirm once every slot is filled.

   This replaces the visual spec's guess field. Only confirmed words are shared:
   they're compared uppercase, without accents ("TIGRÉ" = "TIGRE"). Wrong ones cost
   nothing and go to the team's guess feed. The board shakes and keeps the
   arrangement, and Clear sends every tile back. The first right word ends the turn.
   Teammates see "X is arranging…" while someone moves tiles. On desktop, typing a
   letter places a matching tile, Backspace takes one back, and Enter confirms.
3. **Hint.** Any playing-team member can ask for one: the leftmost letter not yet placed
   drops into its slot, and the word is worth 1 point less. Disabled when it would
   leave fewer than 2 letters to find. Hints don't add time.
4. **Steal (when time runs out).** For 3 s, every member of the other team sees
   **Steal!**. The first to tap it gets 10 s and **one try**, arranging the tiles
   like a normal turn, with the hints already placed. A steal is worth half the word's
   current value, rounded up: right adds it to the stealing team, wrong (or no answer)
   takes the same off. Scores can go below zero. If nobody taps Steal, the word is
   revealed as before.
5. **Result (about 3 s).** Right: "Got it!", who found it, how fast, the points. Time's
   up: the word is revealed, no points.
6. **Scoreboard (3 s).** Turn progress, both scores, the words so far, who plays next.
7. **End.** The team with more points wins. Rematch / Shuffle teams / Back to Game Room.

## Scoring

- A word is worth its number of letters, minus 1 per hint.
- A hint can't take the value under 2 (see "Hint").
- Wrong guesses cost nothing. Time running out scores nothing for the playing team.
- A steal wins or loses `ceil(worth / 2)` for the other team.
- **A tie at the end** is a draw ("It's a draw!"). The end screen needs a draw variant;
  the visual spec doesn't draw one yet.

## Scrambling

- The scrambled order comes from a seed stored in the turn, so every device shows the
  same order.
- It is never the word itself, and for words of 5+ letters at least half the letters
  are out of place.
- Tiles show letters uppercase **without accents** (É -> E), so the scramble never gives
  away where an accented letter goes. The reveal and the "So far" list show the real
  spelling.

## Timing and who advances the game

As in Buzzer Quiz: every deadline (`startAt`, the turn's end, result and scoreboard
ends) is a server timestamp in the state. Each device transacts the transition when it
passes; transitions are idempotent. A disconnected player can't stall the game.

## State

The real type is `ScrambleState` in `lib/games/wordscramble/game.ts`, and the team
helpers are in `teams.ts`. In short:

- `phase`: lobby, turn, stealOffer, stealing, result, scoreboard, end.
- `stealer` (who is stealing), and `stolen` (`{ seat, points }`, the steal's outcome on
  the result). A history entry carries `steal` (±points) when one happened.
- `settings` (`lang`, `mode`, `turnsPerTeam`, `target`), and `teams` (seat to A/B).
- `turn` (Team A plays even turns), `wordId`, `seed` (the scramble), `hints`.
- `startAt` is when the word appears. `deadline` ends the turn, the result or the
  scoreboard.
- `guesses` (this turn's wrong ones), `found` (who found it and how fast), `scores`,
  `history`, `usedWordIds`.
- Typing indicator: `games/{room}/wordscrambleTyping/{seat}: { at }`. Each seat writes
  only its own, at most every 2 s while typing.

The word never lives in the state, only its id. `guess` and `hint` take the word from
the caller. Arrays are dropped when empty, and `normalize()` restores them.

## Content

- `lib/games/wordscramble/words.json` (or one file per language), validated by a test.
- Each entry: `{ id, lang, word }`, with the real spelling (accents included).
- **Common words only,** 4 to 8 letters, that most players know: no proper nouns, no
  plurals or conjugated forms, nothing offensive, and no word whose letters also spell
  another common word (otherwise a right answer would be refused).
- A few hundred per language, spread across lengths.
- **No word twice in a room's session**: the room remembers every word it has shown,
  across rematches and returns to the lobby. Words repeat only once the whole list for
  that language has been played, and then the cycle starts over.
- **Fair lengths**: a word is worth its letters, so in each round Team B gets a word
  as long as Team A's. The length changes from one round to the next when possible.
  With no hints and no steals, two teams that find every word end level. If no unused
  word of the right length is left (late in a long session), the nearest length is
  used.
- French words are chosen for French players, not translated.

## Edge cases

- **Two right guesses at the same moment:** the guess is a transaction, so the first
  one to commit wins and the other sees the turn already over.
- **The whole playing team disconnects:** the timer runs out and the turn scores
  nothing.
- **A player leaves and the teams become uneven:** the game continues. Even teams are
  only checked at Start.

## Not in v1

- Power-ups, a board shared live between teammates, more than 2 teams.

## Open questions

- None yet.
