# Game Room — a platform for private, link-shared games

A small platform for private 2-player games played through a shared link.
- `/` is the hub (game picker, join by code or name, "Your rooms").
- Each game lives at `/<slug>#<roomCode>`.
- No sign-in: every browser gets an invisible guest ID.
- Games: **Same Page** (`/same-page`, slug `ftw`; `/ftw` redirects), **Co-Counsel** (`/cocounsel`), **Night
  Highway** (`/nighthighway`, plus `/nighthighway/solo`), **Buzzer Quiz**
  (`/buzzerquiz`, 2-4 players), **Word Scramble** (`/wordscramble`, 2 teams,
  2-8 players), **Checkmate Grid** (`/regions`, solo, with a daily puzzle; races
  at `/regions/race`) and **Border Run** (`/borderrun`, a geography race; plus
  `/borderrun/solo` with a daily route). The two races (Challenge for 2-4
  players, Survival for 4-8) share one layer: `docs/race.md`.

This file holds what must stay true on **every** change. Everything else loads on
demand:

| Need | Where |
| :--- | :--- |
| Working on Same Page (formerly First to Worst) | `first-to-worst` skill (`.claude/skills/first-to-worst/`) |
| Working on Co-Counsel | `co-counsel` skill |
| Working on Night Highway (3D race, deterministic traffic, live ghost car) | `night-highway` skill |
| Working on Buzzer Quiz (2-4 players, buzz in, EN/FR question bank) | `buzzerquiz` skill |
| Working on Word Scramble (2 teams, unscramble against the clock, EN/FR words) | `wordscramble` skill |
| Working on Checkmate Grid (chess-piece region puzzle: solo and daily, Challenge and Survival races), or the shared daily puzzles and their leaderboard | `checkmate-grid` skill; `docs/daily.md` |
| The shared race layer (Challenge and Survival for solo games) | `docs/race.md` |
| Working on Border Run (link two countries by land: solo and daily, Challenge and Survival races; map data, routes, EN/FR names) | `borderrun` skill; `docs/daily.md` |
| Adding (or removing) a game | `add-game` skill |
| Changing, testing or deploying database rules; `permission_denied` errors | `database-rules` skill |
| Any visual change: which spec applies, past UI pitfalls, phone/desktop screenshots | `ui-review` skill |
| Testing a change with two players on phone + desktop (emulators + Playwright) | `live-test` skill |
| Original specs and mockups | `references/` (`ftw/`, `co-counsel/`, `game-room/`, `night-highway/`, `buzzer-quiz/`, `scramble/`) |
| The work queue, including deferred work waiting on a trigger ("when X ships, do Y") | `todo` skill |
| Branching, committing, rebasing, pushing, merging into `main` | `git` skill |

**Before finishing any task, check the todos** (`node .claude/skills/todo/scripts/todo.mjs list --all`)
for items this work triggers. Do them, or tell the user they're now due. When
deferring work that depends on a future event, add a todo (`add`, tagged with the
game's slug, plus a `detail` with the trigger, what to do and why) instead of
leaving it in chat. Only ever touch todos through that script.

## Architecture

### Guest identity (`lib/session/shared/auth.ts`)

- Firebase **Anonymous Auth**, invisible.
  - **There is no sign-in screen, and never will be** (a product decision).
  - `useGuestAuth()` gives `{status, uid}`; `ensureGuestUid()` for one-off reads.
  - If sign-in fails, pages show `CONNECTION_ERROR_MESSAGE`. There is never a
    silent fallback to local mode.
- **One guest ID per browser**, shared by all its tabs, and **one seat per guest
  per room**. Test two players with a normal window plus a private window (or two
  Playwright contexts), never two tabs.
- **Local mode** (no Firebase config) uses a fake uid in sessionStorage, one per
  tab, so two tabs *can* play each other locally.

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

Reference: `docs/architecture.md` (room data model tree, environment notes). Nested `CLAUDE.md` files in `lib/session/`, `lib/store/`, `lib/games/` and `components/` hold the code map and area rules; they load when you work there.

Layout overview: `ARCHITECTURE.md`. Session habits (one todo per session, `/clear`, `/compact`, no CLAUDE.md edits mid-session): `docs/workflow.md`.

## Conventions

- **Start every task on a new branch from `origin/main`.** `main` is production
  (every push auto-deploys); merging into it needs the user's approval (`git`
  skill).
- **Navigating into a room** from another page is a hard navigation (`<a>` or
  `window.location`), never `router.push`/`next/link`. Co-Counsel's creator check
  reads the hash on its first render.
- **Never read the clock, `window` or storage during render.** Use effects, timer
  callbacks, or `useSyncExternalStore` with a server snapshot. Next's Cache
  Components and this repo's `react-hooks/*` lint rules enforce this.
- **Ship the client before the rules.** When a rules change alters what clients
  may write, deploy the app first: new rules under the previous client refuse its
  writes (room creation included).
- **`AGENTS.md`**: this Next.js version has breaking changes. Check
  `node_modules/next/dist/docs/` before using Next APIs.

## Commands

```bash
npm run dev        # dev server at localhost:3000 (one per project)
npm run build      # production build (also type-checks)
npm run lint       # eslint
npm run test       # vitest: lib/**/*.test.ts (game logic, prompt bank, update builders, presence)
npm run test:rules # database.rules.json against the Database emulator (tests/rules/, needs Java)
npx tsc --noEmit   # type-check only
```

CI (`.github/workflows/ci.yml`) runs lint, `tsc`, `npm test` and
`npm run test:rules`.

Use `./scripts/check` (typecheck, lint, tests; one line per failure; `--rules`, `--verbose`) instead of raw test/lint commands; `./scripts/build` and `./scripts/test-rules` print one line unless they fail.

Before calling a change done:
- **Every change**: lint, `tsc`, `npm test`.
- **Rules or game-state changes**: also `npm run test:rules`.
- **Anything visible**: also the `ui-review` skill (phone and desktop screenshots).
- **Anything multiplayer**: also the `live-test` skill.


Todos: use `node .claude/skills/todo/scripts/todo.mjs` only (see the todo skill); never read or edit `todos/` or `todo-archive.md` directly.
