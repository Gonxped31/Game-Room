# Architecture

Next.js app (App Router) on Firebase Realtime Database with invisible Anonymous Auth. Players' clients talk to the database directly, guarded by `database.rules.json`. The only server code is the owner's `/admin` dashboard: `app/api/admin/*` route handlers using `firebase-admin` (which bypasses the rules) behind a password cookie.

## Directories

| Path | Purpose |
| :--- | :--- |
| `app/` | Routes: `page.tsx` is the hub, `app/<slug>/page.tsx` each game, `error.tsx` crash screens |
| `components/` | Shared UI; `components/<slug>/` per game; `components/hub/` the hub |
| `lib/games/<slug>/` | Each game's pure state machine, constants, content, Vitest tests |
| `lib/games/registry.ts` | `ALL_GAMES` (playable) and `GAMES` (shown on the hub) |
| `lib/session/` | Seats, presence, room hooks (`useRoom`, `useSession`, `useGameSession`) |
| `lib/session/shared/` | Auth, seat/room write builders (`updates.ts`), presence, server clock |
| `lib/store/` | Backend-agnostic store: Firebase, or `localDb.ts` when no config |
| `lib/admin/` | Server only: `firebase-admin` handle, admin password cookie (`session.ts`), route guard |
| `lib/analytics/` | Dashboard metrics: pure and platform-neutral (`metrics.ts` over a `Snapshot`); `gameRoomAdapter.ts` maps Game Room's database into it; `roomFilter.ts` filters the room list |
| `app/admin/`, `app/api/admin/` | The owner's dashboard and its route handlers (not linked from the hub) |
| `exports/<slug>/` | A solo game as one offline HTML file: page template and entry, built by `scripts/export-solo.mjs` into `downloads/` (served only to `/admin`, by `app/api/admin/downloads/[slug]`) |
| `tests/rules/` | Database rules tests (emulator, needs Java) |
| `references/` | Original specs and mockups |
| `.claude/skills/` | Per-game and per-task guides |
| `scripts/` | `check`, `build`, `test-rules` wrappers; `export-solo.mjs` (runs before `next build`) |
| `docs/` | Longer reference (`architecture.md`: data model, environment) |

## Entry points

- Hub: `app/page.tsx` -> `components/hub/Hub`.
- A game: `app/<slug>/page.tsx` calls `useGameSession` (2 players) or `useSession` (2-8), then renders `components/<slug>/`.
- Rooms live at `/<slug>#<roomCode>`.

## Data flow

1. `useGuestAuth` signs in anonymously; `useRoom` waits for auth and a `#code`.
2. `useRoom` listens to `meta`, `seats`, `members`, `players`, `presence` and the game state separately.
3. A move is a pure transition from `lib/games/<slug>/`, applied through `gameStore.transact` at `games/{room}/{slug}`.
4. Seat and room changes are multi-path updates from `updates.ts`, sent with `updateRoot()`.
5. Rules validate every write; every device sees the result through its listeners.
6. Timed steps store a server-time deadline; `useDeadline` fires on every device and `assertDue` lets only the first commit win.

## Adding things

- A game: `add-game` skill (registry, state machine, components, page, rules and rules tests).
- A state field: change the type, `database.rules.json` and `tests/rules/` together (`database-rules` skill).
- Shared UI: `components/`; game UI: `components/<slug>/`.

Detail: `docs/architecture.md` and the nested `CLAUDE.md` files.
