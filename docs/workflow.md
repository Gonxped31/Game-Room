# Session workflow

Habits that keep sessions cheap and focused.

- **One todo per session.** Take `todo next`, finish it, `todo done`, stop.
- **`/clear` between unrelated tasks.** Old context costs tokens on every turn.
- **`/compact` with focus instructions** when a long task must continue, e.g. `/compact keep the failing test names and the files changed`.
- **`/context` and `/cost`** show what is actually using the window and the money (MCP servers, skills, big reads) before guessing.
- **Don't edit CLAUDE.md or MCP config mid-session.** Either change breaks prompt caching for the rest of the session; make them between sessions.
- **Read narrowly.** Use Grep, or Read with `offset`/`limit`; a hook blocks whole-file reads over 1500 lines.
- **Run `./scripts/check`** instead of raw lint/test output.
