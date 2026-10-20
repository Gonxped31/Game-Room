---
name: buzzerquiz
description: Reference for working on Buzzer Quiz, the 2-4 player buzzer quiz - its rules, state machine, fair buzz resolution, server-clock timing, question bank (EN/FR), page flow and gotchas. Use whenever changing or debugging anything under lib/games/buzzerquiz/, components/buzzerquiz/ or app/buzzerquiz/, editing questions.json, or answering questions about how Buzzer Quiz plays.
---

# Buzzer Quiz

2 to 4 players race to buzz in on multiple-choice questions (`/buzzerquiz#room`).
The buzzer picks one of 4 choices, and everyone sees the pick. A wrong pick is struck
out for everyone and its player is locked out of that question. A right pick scores
3, 2 or 1 by the choices left. The host (the room's creator) picks the language
(EN/FR), the topics and the length, and plays too.

**Source of truth**:
- `references/buzzer-quiz/buzzer-quiz-game-design.md` - rules, flow, timing, content.
- `references/buzzer-quiz/buzzer-quiz-visual-spec.md` - tokens, screens, copy, motion.
  Breakpoint **900px**.

## Files

| Path | What |
| :--- | :--- |
| `lib/games/buzzerquiz/game.ts` | The pure state machine (`QuizState`), `advance`, `pickQuestions`, `choiceOrder`, `ranking` |
| `lib/games/buzzerquiz/constants.ts` | Timings, topics, lengths, players |
| `lib/games/buzzerquiz/questions.json` | The bank, one question per line; `choices[0]` is always right |
| `lib/games/buzzerquiz/questions.test.ts` | Validates the bank (lengths, 20 per topic per language, French spacing) |
| `app/buzzerquiz/page.tsx` | Session (`useSession`, 4 seats, min 2), timers, buzz and pick |
| `components/buzzerquiz/` | `ui.tsx` (tokens, buzzer, tiles, scores), `Screens.tsx`, `QuestionScreen.tsx` |
| `database.rules.json` → `buzzerquiz` | Validates the whole state; `maxPlayers` must be 4 |
| `.claude/skills/live-test/scripts/buzzer-quiz.mjs` | 3 players, desktop + iPhone + Android |

## How a question runs

`setup → lobby → [countdown → question ⇄ buzzing → answering → result] × N → final`

- **No game server.** Every timed step has a server-time deadline in the state
  (`dueAt(game)`). Every device runs `useDeadline` and transacts `advance`. The
  transitions call `assertDue`, so only the first commit counts.
- **Reveal**: when the countdown ends, every device shows the question at once,
  even before anyone has committed `reveal` (the page checks the clock). That's why
  `onBuzz` applies `reveal` first when the state is still in `countdown`.
- **Buzz fairness**: each device measures the reaction time itself, from when it
  showed the question (or reopened buzzing) to the tap (`pointerdown`, not click).
  The first buzz opens a 300 ms window (`buzzing`), and the lowest `ms` wins. Ties
  go to the lower seat. Buzzes live in the state (a few per question), not in a
  sibling node.
- **Wrong pick or 5 s timeout**: the player is locked out, and buzzing reopens
  (`round` + 1). The question timer pauses while buzzing/answering (`timeLeft`). The
  question ends with no points when one choice is left, everyone is locked out, or
  15 s run out.
- `players` is fixed at Start (the seated guests then). Anyone else watches, and
  joins at the next Rematch.

## Gotchas

- Choices are **bank indexes** (0 = right) everywhere in the state; only the UI
  shuffles them (`choiceOrder(seed, index)`). Rules refuse striking choice 0.
- Interface copy is English. Only the questions follow the room's language.
- The bank must keep ≥ 20 questions per topic per language, or a 20-question
  single-topic game can't start (the test enforces it). Growing it is todo T-049.
- Playwright: a `click()` on the buzzer waits while it's disabled. To race two
  players, dispatch `pointerdown` on both at once (see the live test).
