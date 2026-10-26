# Daily puzzles

One puzzle a day per game, the same for everyone, with a global leaderboard.
Built once in `lib/daily/` and `app/api/daily/[slug]/`; a game plugs in with
one `DailyGame`. First user: Checkmate Grid (`checkmate-grid` skill).

## Decisions (2026-10-25)

| Question | Decision |
| :--- | :--- |
| Same grid for everyone, or per player? | **Same for everyone** (players can talk about today's grid). |
| Comparing with friends | **A global leaderboard**, plus a Share text. |
| Repeat attempts | **One attempt per guest ID per day, and only the first attempt per connection (IP) is ranked.** Later ones from the same connection play and get a time, "Not ranked". |
| When does the day change? | **Midnight in `America/Toronto`**, for everyone (`lib/daily/day.ts`). |
| Known gap | Switching connection (phone data vs Wi-Fi) allows one more ranked try. Without sign-in (never: a product decision) that's accepted. |

## How it works

1. The page asks `GET /api/daily/<slug>` (with the guest's ID token,
   `guestIdToken()` in `lib/session/shared/auth.ts`): today's line, your
   attempt, streak, name and the board.
2. **Start** → `POST …/start`. The server derives the day's seed
   (`HMAC(DAILY_SECRET, slug + day)`), generates and saves the puzzle on first
   use, stamps `startedAt` with **its** clock (once: a second Start resumes),
   and claims the connection's hash for the ranked slot. Only now does the
   player see the grid.
3. The player solves it; the page sends the moves log → `POST …/submit`.
   The server replays it (`DailyGame.verify`), times it from `startedAt` to
   now, and writes the result. It stays off the board (unranked) when the
   connection wasn't first, the time is under `minHumanMs`, or the moves are
   machine-regular (gaps' standard deviation under 15 ms).
4. Streaks: consecutive days with a finished attempt, ranked or not.

All daily data lives under `/daily`, which **the rules close to every client**
(the root's `.read`/`.write` false; `tests/rules/daily.test.ts`). Only the
routes touch it, through firebase-admin (`adminDb()`). The rules add just the
board's `.indexOn: ms`.

Guests' ID tokens are checked by `lib/daily/token.ts` with `jose` (Google's
public keys, this project's issuer and audience), **not** firebase-admin/auth:
that module require()s the ESM-only jose 6, which Vercel's Node refuses while
loading it - imported once, it took every /admin route down (2026-10-26).
To reproduce that class of failure locally: run a standalone build with
`NODE_OPTIONS=--no-experimental-require-module`.

```
/daily/{slug}/{day}/puzzle          the day's puzzle (JSON string)
/daily/{slug}/{day}/attempts/{uid}  { startedAt, ranked, finishedAt?, ms?, unranked? }
/daily/{slug}/{day}/ips/{hash}      uid of the connection's ranked attempt (hash salted, per day; never the IP)
/daily/{slug}/{day}/board/{uid}     { name, ms }
/daily/{slug}/streaks/{uid}         { streak, lastDay }
/daily/names/{uid}                  the board name (20 chars, cleaned, short blocklist)
```

## Adding a daily game

1. Write a `DailyGame` (`lib/daily/types.ts`) in `lib/games/<slug>/daily.ts`:
   `describe(day)`, `generate(seed, day)` (deterministic), `verify(puzzle,
   moves)` (untrusted JSON in), `minHumanMs(puzzle)`.
2. List it in `DAILY_GAMES` (`lib/daily/games.ts`).
3. The page: `dailyRequest` (`lib/daily/client.ts`), `Leaderboard` and
   `Countdown` (`components/daily/`, styled by the game's own CSS through
   their `daily-*` classes).
4. Tests: the game's `verify` and generation; `lib/daily/daily.test.ts` runs
   the service on an in-memory store.

## Deploy

- **`DAILY_SECRET`** on Vercel (Production): a long random string. Without it
  the routes answer 503 "The daily puzzle isn't available here." (Preview too,
  like /admin). Changing it changes every future puzzle and resets the
  connection slots, so set it once.
- **`FIREBASE_SERVICE_ACCOUNT`**: already set for /admin.
- **Rules**: deploy after the app as usual (`npx firebase deploy --only
  database`). The board index is **required**: without it the real database
  refuses the board query ("Index not defined"), so every daily route answers
  500. The emulator doesn't enforce indexes, so local tests can't catch this.
- On the emulators (`dev-against-emulators.mjs`), the admin SDK's emulator
  hosts are set and a fixed development secret stands in.
