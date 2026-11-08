# Session workflow

Habits that keep sessions cheap and focused.

- **One task per session.** `todo next`, finish it, `todo done`, stop.
- **`/clear` between unrelated tasks.** Old context costs tokens on every turn.
- **`/compact` with a focus** when a long task must go on, e.g.
  `/compact keep the failing test names and the files changed`.
- **`/context` and `/cost`** show what's using the window, and the money, before you
  guess.
- **Change `CLAUDE.md` and MCP config between sessions**, not in the middle of one:
  either change breaks prompt caching for the rest of the session.
- **Read narrowly.** Grep, or Read with `offset` and `limit`; a hook refuses
  whole-file reads over 1500 lines.
- **Run `node scripts/check.mjs`** instead of reading raw test or lint output.
