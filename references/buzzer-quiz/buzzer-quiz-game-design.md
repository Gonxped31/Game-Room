# Buzzer Quiz: Game Design

The rules, flow, state and content of Buzzer Quiz. The look, layout, copy and motion
are in `buzzer-quiz-visual-spec.md`; where the two overlap, this file owns behavior and
the visual spec owns presentation.

Name: **Buzzer Quiz**. Slug: `buzzerquiz` (route `/buzzerquiz`, state at `games/{room}/buzzerquiz`).

## What the game is

2 to 4 players, each on their own device, race to buzz in on multiple-choice questions.
Whoever buzzes picks one of 4 choices, and everyone sees the pick. A right pick scores;
a wrong pick is struck out for everyone, its picker is locked out of that question, and
the others can buzz again. The fewer choices left, the fewer points. Everyone plays for
themselves, the host included.

## Players and roles

- **2 to 4 players.** The game can't start with fewer than 2.
- **Host** = the room's creator (`meta.createdBy`). Only the host edits the settings and
  presses Start. The host plays like everyone else.
- Players join through the usual Game Room link or code. Someone arriving mid-game
  watches as a spectator and joins at the next Rematch.
- Player colors (`--p1`..`--p4`) follow seat order, which is join order.

## Settings (host, before Start)

| Setting | Values | Default |
| :--- | :--- | :--- |
| Language | English, Français | the host's browser language, else English |
| Topics | one or several of the 6 topics | none: at least 1 is needed |
| Questions | 5, 10, 15, 20 | 10 |

The 6 topics: Geography, Cinema & TV, Science, Sport, Music, History. With several
topics, questions are drawn evenly across them in random order.

The visual spec shows setup *before* the room exists ("Create room"). In Game Room a
room exists as soon as its page opens, so setup is the room's first phase: the host sees
the setup screen, the others see the waiting room with the current choices. "Create
room" becomes "Continue to the waiting room", and the host can go back with "Edit".

## Flow

```
setup -> lobby -> [countdown -> question <-> answering -> result] x N -> final
```

1. **Countdown (3 s).** The next question's reveal time is set on the server clock
   (`revealAt`). Every device counts down to it.
2. **Question.** At `revealAt`, the question and its 4 choices appear on every device.
   A 15 s question timer starts. Buzzing is open to everyone not locked out.
3. **Buzz.** See "Buzz resolution". The winner moves to *answering*; the question timer
   pauses.
4. **Answering (5 s).** Only the buzzer can pick. Their pick is shown to everyone.
   - **Right:** they score (see "Scoring"), the question ends -> *result*.
   - **Wrong:** that choice is struck for everyone, the buzzer is locked out, the
     question timer resumes, buzzing reopens -> back to *question*.
   - **No pick in 5 s:** treated like a wrong answer without striking anything: the
     buzzer is locked out, buzzing reopens.
5. **The question ends with no points** when:
   - only one choice is left (it's the answer), or
   - every player is locked out, or
   - the question timer runs out.
6. **Result (3 s):** the answer is shown, then the next countdown starts. After the
   last question -> *final*.
7. **Final:** ranking by score. Rematch keeps the players and settings and starts a new
   countdown with new questions. "New topics" returns to setup.

## Buzz resolution (fairness)

"First buzz the server receives" favors whoever has the fastest connection, which on
phones decides most close calls. Instead:

- Each device shows the question at `revealAt` (server clock via
  `watchServerTimeOffset`) and measures the player's **reaction time** locally: from
  the moment it showed the question (or reopened buzzing after a wrong answer) to the
  tap.
- A buzz is a transaction that adds `{ seat, ms }` to the game state's `buzzes`. A
  handful of buzzes per question is far too little traffic to need a separate node.
- When the first buzz for that round arrives, a **300 ms window** opens. When it
  closes, the **lowest `ms` wins**. Ties go to the lower seat.
- The UI locks the buzzer on the device right after a tap, so a double tap can't send
  twice.
- Reaction times are self-reported. Like the other games, we trust each other; no
  anti-cheat.

The visual spec's line "the first buzz the server receives wins" is replaced by this.
What players see is the same: one "Léa buzzed!" banner.

## Scoring

| Choices left when answered right | Points |
| :--- | :--- |
| 4 | 3 |
| 3 | 2 |
| 2 | 1 |
| 1 | the question ends, 0 for everyone |

- A wrong answer costs nothing except being locked out of that question.
- **Ties at the end** share the rank ("Léa and Max win!"). The final screen needs a
  tied variant; the visual spec doesn't draw one yet.

## Timing and who advances the game

There's no game server. Every deadline (`revealAt`, buzz window end, answer deadline,
question deadline, result end) is stored in the game state as a server timestamp.
Every device runs a timer for the current deadline and, when it passes, transacts the
transition. Transitions are idempotent (they check the phase and the deadline), so it
doesn't matter how many devices try or who is first. A disconnected player can't stall
the game.

## State

The real type is `QuizState` in `lib/games/buzzerquiz/game.ts`. In short:

- `phase`: setup, lobby, countdown, question, buzzing (the 300 ms window), answering,
  result, final.
- `settings` (`lang`, `topics`, `length`), `players` (fixed at Start), `questionIds`,
  `seed` (choice order), `index`, `round`.
- Timing: `deadline` ends the current timed phase. `openedAt` is when buzzing opened
  for this round. `questionEnd` is when the question times out; while it's paused, the
  remaining time is kept in `timeLeft` instead.
- `buzzes` (`{ seat, ms }` for this round), `buzzer`, `struck` (bank choice indexes),
  `locked`, `lastPick`, `outcome`, `scores`.

Choices are bank indexes, where 0 is always the right answer. `choiceOrder(seed,
index)` shuffles them for display. Arrays are dropped when empty, and `normalize()`
restores them.

## Content

- `lib/games/buzzerquiz/questions.json` (or one file per language), validated by a test.
- Each question: `{ id, lang, topic, question, choices: [4 strings], answer: 0-3 }`,
  with the right answer listed first in the file and shuffled at play time.
- Target: about 40 questions per topic per language (about 480 in all), so a 20-question
  game on a single topic doesn't repeat within a few games.
- Rules for writing questions: one clearly right answer, three plausible wrong ones,
  nothing that goes out of date quickly ("current president of…"), choices short enough
  for a 390 px wide tile (about 30 characters), question about 120 characters at most.
- French questions are written in French, not translated word for word.
- Every question gets fact-checked before shipping.

## Edge cases

- **The buzzer disconnects while answering:** the 5 s answer deadline still runs out,
  and they're locked out as usual.
- **A player leaves mid-game:** their score stays on the board. Their seat can be
  taken over after 2 minutes offline, as in every Game Room game.
- **Fewer than 2 players connected:** the game keeps running; it's not paused.
- **Host leaves:** the game keeps running (any device advances it). Rematch is
  available to every player; only setup is host-only.

## Not in v1

- Power cards (Freeze, Double, 50/50, Steal, Shield): todo T-041. Reserve the space
  next to the buzzer, as the visual spec says.
- Custom questions, more than 4 players, teams.

## Open questions

- None yet.
