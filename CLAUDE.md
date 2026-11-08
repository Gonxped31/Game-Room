# Game Room — a platform for private, link-shared games

A small platform for private 2-player games played through a shared link.
- `/` is the hub (game picker, join by code or name, "Your rooms").
- Each game lives at `/<slug>#<roomCode>`.
- No sign-in: every browser gets an invisible guest ID.
- Games (routes, slugs, modes: `ARCHITECTURE.md`): Same Page, Co-Counsel, Night
  Highway, Buzzer Quiz, Word Scramble, Rank & File, Detour and Last Hop.

This file holds what must stay true on **every** change. Skills load by their
descriptions (Same Page's is `first-to-worst`, Rank & File's `checkmate-grid`), a
folder's rules from its own `CLAUDE.md`, and the rest from:

| Need | Where |
| :--- | :--- |
| Layout, the games and their routes | `ARCHITECTURE.md` |
| Room data model tree, environment notes, hub components | `docs/architecture.md` |
| Session code map (write builders, hooks, matchmaking) | `docs/session.md` |
| The shared race layer (Challenge and Survival for solo games) | `docs/race.md` |
| The shared daily puzzles and their leaderboard (`lib/daily/`) | `docs/daily.md` |
| Every game's How to play: what it says, where it opens | `docs/how-to-play.md` |
| Original specs and mockups | `references/` (per game, plus `game-room/`) |
| Session habits (one task per session, `/clear`, reading narrowly) | `docs/workflow.md` |

## Architecture

### Guest identity (`lib/session/shared/auth.ts`)

- Firebase **Anonymous Auth**, invisible. **There is no sign-in screen, and never
  will be** (a product decision). If sign-in fails, pages show
  `CONNECTION_ERROR_MESSAGE`. There is never a silent fallback to local mode.
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

- **Start every task on a new branch from `origin/main`.** `main` is production:
  every push auto-deploys on Vercel. `main` moves only through
  `node scripts/merge.mjs`, after the user approves (`git` skill).
- **Before finishing any task, check the todos**
  (`node .claude/skills/todo/scripts/todo.mjs list --all`) for items this work
  triggers. Do them, or tell the user they're now due.
- **Deferred work is a todo with its trigger** ("when X ships, do Y"), never a note
  in chat: `add`, tagged with the game's slug, plus a `detail` with the trigger,
  what to do and why (`todo` skill).
- **Todos only through that script**: never read or edit `todos/` or
  `todo-archive.md` directly.
- **New rules, skills, hooks or docs for agents** follow the `agent-setup` skill: a
  check beats a written rule, and nothing is written twice.
- **Navigating into a room** from another page is a hard navigation (`<a>` or
  `window.location`), never `router.push`/`next/link` (Co-Counsel reads the hash on
  its first render).
- **Never read the clock, `window` or storage during render.** Use effects, timer
  callbacks, or `useSyncExternalStore` with a server snapshot. Cache Components
  and the `react-hooks/*` lint rules enforce it.
- **Ship the client before the rules.** When a rules change alters what clients
  may write, deploy the app first: new rules under the previous client refuse its
  writes (room creation included).
- **`AGENTS.md`**: this Next.js version has breaking changes. Check
  `node_modules/next/dist/docs/` before using Next APIs.

## Commands

| Command | What it does |
| :--- | :--- |
| `node scripts/check.mjs` (`./scripts/check`) | The checks in `scripts/check.json` (doctor, `tsc`, lint, `npm test`), one line per failure; `--fast` skips tests, `--rules` adds rules tests, `--verbose`. Use it instead of raw test or lint output |
| `node scripts/doctor.mjs` | The agent setup: size limits, dead paths, hooks turned on |
| `npm run dev` | Dev server at localhost:3000 (one per project) |
| `./scripts/build`, `./scripts/test-rules` | `npm run build` (also type-checks) and `npm run test:rules` (`tests/rules/` on the Database emulator, needs Java); one line unless they fail |

`npm test` is vitest over `lib/**/*.test.ts`. CI (`.github/workflows/ci.yml`) runs
lint, `tsc`, `npm test` and `npm run test:rules`.

Before calling a change done:
- **Every change**: `node scripts/check.mjs` (lint, `tsc`, `npm test`).
- **Rules or game-state changes**: also `npm run test:rules` (`--rules`).
- **Anything visible**: also the `ui-review` skill (phone and desktop screenshots).
- **Anything multiplayer**: also the `live-test` skill.
