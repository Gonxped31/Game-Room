# Detour: racing others, reloads and the generator

The detail behind the `borderrun` skill's `SKILL.md` (next to this file).

## The daily rotation

**Daily rotation** (`SCHEDULE` in `daily.ts`, Monday first): Europe 3-5,
Americas 3-5, Africa 3-5, Asia 3-5, Europe 4-6, Europe and Asia 4-6, the world
5-7 (par ranges). Endless uses the same ranges per map.

## A reload loses nothing

**A reload loses nothing** (`components/borderrun/storage.ts`): the tab, the
language, the Endless route in progress (route, guesses, time spent; dropped
once complete, given up or on Change) and today's Daily guesses with the
route (kept after finishing, for the map and the share squares; a completed
route that never reached the server is sent on resume).

## Racing others (`lib/games/borderrun/race.ts`, `app/borderrun/page.tsx`)

Challenge and Survival run on the shared race layer (`docs/race.md`: modes,
timing, scoring, how a round ends, the screens). Detour's own parts:
- **Rounds are routes**: the map is one area or "mixed" (Europe, the
  Americas, Africa, Asia, Europe and Asia, the world in turn), and the par
  climbs through the area's range as rounds go on (`routeFor`). The route
  lives in the state (`route`), drawn in the transaction.
- **Score**: the finish time plus 15 s per guess past the par (`extra`);
  `found` is route countries guessed. `playOf` replays a run: late, repeated
  or after-the-finish guesses don't count.
- **Runs**: `borderrunRuns/{seat}` (`guesses`), rewritten whole on each guess
  (a run is a few guesses).
- **Screens**: `components/borderrun/race/Screens.tsx` holds the shell (title
  sign, EN/FR switch) and the lobby's settings; the page fills the shared
  round view with `RouteHeader`, `PlayMap`, `GuessInput` and `GuessList`, and
  the results with the picked player's map and `PathLine`.
- **Rules**: `borderrun` (`map`, `route`) and `borderrunRuns/$seat`
  (`guesses`, 200 at most). Tests: `tests/rules/gameState.test.ts` (a real
  Survival game), `tests/rules/matchmaking.test.ts`.
- **Live test**: `.claude/skills/live-test/scripts/border-run-race.mjs`.

## The generator

`generateRoute(seed, {area, minPar, maxPar})`: pick a start, an end a few
steps away, then close a border that **every** shortest route crosses (from
counting shortest paths through each edge), once or twice, so the obvious
way really is blocked and each closure lengthens the route. Kept when a route
still exists and the par is in range. Deterministic per seed (the daily's
secret seed on the server; `crypto.randomUUID()` in Endless), a few ms.
