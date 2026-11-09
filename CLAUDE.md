# Partyfox — link-shared party games

Formerly Game Room (partyfox.io): private rooms shared by link for 1 to 8
players, plus solo games, races and daily puzzles.
- `/` is the hub (game picker, join, "Your rooms").
- A room lives at `/<slug>#<roomCode>`.
- No sign-in: every browser gets an invisible guest ID.
- Games (routes, slugs, modes: `ARCHITECTURE.md`): Same Page, Co-Counsel, Night
  Highway, Buzzer Quiz, Word Scramble, Rank & File, Detour and Last Hop.

This file holds what must stay true on **every** change. Skills load by
description (Same Page: `first-to-worst`; Rank & File: `checkmate-grid`), folder
rules from nested `CLAUDE.md` files, the rest from:

| Need | Where |
| :--- | :--- |
| Layout, games, routes | `ARCHITECTURE.md` |
| Data model tree, environment notes, hub components | `docs/architecture.md` |
| Session code map, matchmaking | `docs/session.md` |
| Races (Challenge, Survival) | `docs/race.md` |
| Daily puzzles, leaderboard (`lib/daily/`) | `docs/daily.md` |
| Each game's How to play | `docs/how-to-play.md` |
| English and French (URLs, words, style, content) | `docs/i18n.md` |
| Source tracking, games-finished counter | `docs/tracking.md` |
| Link previews and `/invite` routes | `docs/link-previews.md` |
| Original specs and mockups | `references/` (per game) |
| Session habits | `docs/workflow.md` |

## Architecture

### Guest identity (`lib/session/shared/auth.ts`)

- Firebase **Anonymous Auth**, invisible. **There is no sign-in screen, and never
  will be.** If sign-in fails, pages show `CONNECTION_ERROR_MESSAGE`, never a
  silent fallback to local mode.
- **One guest ID per browser**, shared by all its tabs, and **one seat per guest
  per room**. Test two players with a normal window plus a private window (or two
  Playwright contexts), never two tabs. Only **local mode** (no Firebase config)
  has a fake uid per tab, so two tabs *can* play each other there.

### Room data model (`database.rules.json` is the source of truth)

- **The rules only allow writes at named child paths.** Never `set`, `update` or
  transact `games/{room}` itself. Game state is transacted at
  `games/{room}/{slug}`.
- **Any signed-in guest can read a room by its code** (spectators can watch); only
  seated members can change it. Nobody can list `/games` or `/roomsByName`, or read
  another guest's `/users/{uid}`.
- **Game state shapes are validated by the rules.** Changing a game's state type
  means changing the rules and `tests/rules/` in the same change (`database-rules`
  skill).

## Working here

- **Every feature, screen, game and piece of content ships in English and French
  together** (`docs/i18n.md`); a new page needs its `/fr` twin.
- **Start every task on a new branch from `origin/main`.** `main` is production
  (every push deploys on Vercel) and moves only through `node scripts/merge.mjs`,
  after the user approves (`git` skill).
- **Before finishing any task, check the todos**
  (`node .claude/skills/todo/scripts/todo.mjs list --all`) for items this work
  triggers: do them, or tell the user they're now due.
- **Deferred work is a todo with its trigger** ("when X ships, do Y"), never a note
  in chat: `add`, tagged with the game's slug, with a `detail` (trigger, what,
  why). **Todos only through that script**, never `todos/` or `todo-archive.md`
  directly (`todo` skill).
- **New rules, skills, hooks or docs for agents** follow the `agent-setup` skill: a
  check beats a written rule, and nothing is written twice.
- **Navigating into a room** from another page is a hard navigation (`<a>` or
  `window.location`), never `router.push`/`next/link` (Co-Counsel reads the hash on
  its first render).
- **Never read the clock, `window` or storage during render.** Use effects, timer
  callbacks, or `useSyncExternalStore` with a server snapshot. Cache Components
  and the `react-hooks/*` lint rules enforce it.
- **Ship the client before rules that tighten.** When new rules would refuse the
  previous client's writes (room creation included), deploy the app first. Rules
  that only add optional paths or fields go first (`database-rules` skill).
- **`AGENTS.md`**: this Next.js version has breaking changes. Check
  `node_modules/next/dist/docs/` before using Next APIs.

## Commands

| Command | What it does |
| :--- | :--- |
| `node scripts/check.mjs` (`./scripts/check`) | Doctor, `tsc`, lint, `npm test` (`scripts/check.json`), one line per failure; `--fast` skips tests, `--rules` adds rules tests, `--verbose`. Use it, not raw test or lint output |
| `node scripts/doctor.mjs` | Agent setup: size limits, dead paths, hooks |
| `npm run dev` | Dev server at localhost:3000 (one per project) |
| `./scripts/build`, `./scripts/test-rules` | `npm run build` (also type-checks) and `npm run test:rules` (`tests/rules/` on the emulator, needs Java), one line unless they fail |

`npm test` is vitest over `lib/**/*.test.ts`. CI (`.github/workflows/ci.yml`) runs
lint, `tsc`, `npm test` and the rules tests.

Before calling a change done:
- **Every change**: `node scripts/check.mjs`.
- **Rules or game-state changes**: also `npm run test:rules` (`--rules`).
- **Anything visible**: also the `ui-review` skill (phone and desktop, `/` and `/fr`).
- **Anything multiplayer**: also the `live-test` skill.
