---
name: borderrun
description: Detour (formerly Border Run, slug borderrun), the link-two-countries-by-land geography game - solo, daily, races, map data, routes, EN/FR names. Use when changing or debugging lib/games/borderrun/, components/borderrun/, app/borderrun/ or scripts/borderrun-data.mjs.
---

# Detour

A geography game, named Detour on 2026-11-01 (it was Border Run, a working
title; the slug stays `borderrun`, like `/borderrun` and its rooms).
Based on Travle, with closed borders as the twist (the user's picks,
2026-10-26). Played two ways:
- **Solo** at `/borderrun/solo`: the daily route and Endless (below).
- **With others** at `/borderrun#room`, in the hub's "Play from anywhere":
  Challenge or Survival, private or matchmade ("Racing others", `reference.md`).

- **A route**: a start and an end country on one map (`Area`), one or two
  **closed borders**, and a **par**: how many countries the shortest open
  route has between the two.
- **You name countries** (English or French, any accents or case, with
  autocomplete). The route is complete once your guesses link start to end
  through open borders, any way round.
- **Each guess is graded** (`closenessOf`): `best` on a shortest route,
  `close` on one at most two countries longer, `off` otherwise (islands and
  countries off the route's side of the map included).
- **Score = time + 15 s per guess past the par** (`PENALTY_MS`). Refused
  guesses (unknown, not on this map, the start or end, a repeat) cost nothing.

Two tabs: **Daily route** (one route a day for everyone on the shared board,
docs/daily.md) and **Endless** (a map picker and Start; New route, Change,
Show a route to give up). The names' language is a switch in the header (EN /
FR, saved; first visit follows the browser), which only changes what's
displayed: input accepts both languages always.

## Reference, next to this file

- `reference.md`: the daily rotation (`SCHEDULE` in `daily.ts`), what a reload keeps
  (`components/borderrun/storage.ts`: nothing is lost), racing others on the shared
  race layer (`docs/race.md`: rounds are routes, the score with its penalty,
  `borderrunRuns`, the screens, rules and tests, the live test), and the route
  generator (`generateRoute` closes a border that **every** shortest route crosses).
- `map.md`: how `scripts/borderrun-data.mjs` builds `countries.json` and
  `shapes.json` (deterministic: rerun it only to change the data), what counts as a
  border, the closed-border marks, zoom and pan (`useZoom`), how the run grows
  (`links`), the names (`placeLabels`) and the finished map's line.

## Files

| Path | What |
| :--- | :--- |
| `lib/games/borderrun/constants.ts` | `GAME_TITLE`, `PENALTY_MS`, `AREAS`, par limits, `PAR_RANGE` per map |
| `lib/games/borderrun/countries.ts` | `COUNTRIES`, `findCountry` (EN/FR/aliases, accents and articles ignored), `suggest`, `capitalDistanceKm` |
| `lib/games/borderrun/areas.ts` | Each map's countries (Russia and Turkey on Europe and Asia; Oceania only on the world map), its view box, its name |
| `lib/games/borderrun/route.ts` | `Route`, `neighboursOf` (map + closed borders), `distances`, `shortestPath`, `closenessOf`, `generateRoute`, the seeded RNG |
| `lib/games/borderrun/play.ts` | The guess log: `refusalOf`, `addGuess`, `replay`, `status` (complete, path, extra, penalty), `links` (the run so far, for the map) |
| `lib/games/borderrun/daily.ts` | The `DailyGame`: `SCHEDULE`, `verify` replays the guesses and returns `penaltyMs` |
| `lib/games/borderrun/race.ts` | Racing others, on `lib/games/race/` (`docs/race.md`): `RaceState`, `Run`, `routeFor`, `playOf`, `scoreOf`, `race` |
| `app/borderrun/page.tsx` | The room page: session, runs, deadlines, matchmaking |
| `app/borderrun/solo/page.tsx` | The solo page (`Stage`) |
| `components/borderrun/race/Screens.tsx` | The race room's shell and lobby settings; the rest is `components/race/` |
| `lib/games/borderrun/theme.ts` | Colours (match `borderrun.css`), share squares |
| `components/borderrun/Stage.tsx` | The page shell: title sign, EN/FR switch, mode tabs; `online` adds Daily |
| `components/borderrun/Rules.tsx` | How to play (`docs/how-to-play.md`): the header's ? (Stage's `rules`, passed by the site's solo page, and the race shell) and a link in the race lobby's settings. Tailwind classes, so it stays out of the exported Stage. A rules change (grading, the penalty) updates it too |
| `components/borderrun/RouteMap.tsx` | The SVG map (Miller projection, fixed size per map), its zoom (`useZoom`) and names (`placeLabels`) |
| `components/borderrun/Controls.tsx` | `Segmented`, `RouteHeader`, `Toolbar`, `GuessInput` (combobox), `GuessList`, `PlayMap`, `CapitalLine` |
| `components/borderrun/EndlessGame.tsx`, `DailyGame.tsx` | The two modes |
| `components/borderrun/borderrun.css` | **All styles, plain CSS**, every rule under `.br-page` |
| `exports/borderrun/` | The offline single-file export (Endless only; Overpass inlined) |

## The generator

`generateRoute(seed, {area, minPar, maxPar})` closes a border that **every** shortest
route crosses, once or twice; deterministic per seed. How: `reference.md`.

## Gotchas

- **Plain CSS under `.br-page`**: the export compiles only Tailwind's base,
  and the shared `daily-*` classes are also styled by Rank & File's CSS,
  so every rule is scoped to this page.
- **The map never changes size** within a route (the user's rule for
  Rank & File's board, kept here): its aspect comes from the map's view
  box, not from what's drawn.
- **Suggestions keep the input's focus** (`onPointerDown` preventDefault), so
  a phone's keyboard stays up between guesses. The first suggestion is
  highlighted: Enter takes it. Text with no suggestion goes through
  `findCountry`, and a refusal names the reason.
- **Guess times never go backwards** (`addGuess` refuses them, so does the
  daily check): the daily takes the max of the server-offset clock and the
  last guess.
- **Overpass weights**: the site loads 400-800 for Detour (app/layout.tsx).

## Verifying

- `npm test`: `lib/games/borderrun/borderrun.test.ts` (data, names, routes on
  every map, play, daily verify) and `lib/daily/daily.test.ts` (the penalty
  through the service).
- `ui-review` for `borderrun` and `hub`; drive it with a scratch script (the
  live-test script below shows how to read the route and its answer).
- **Every change**: `node .claude/skills/live-test/scripts/border-run.mjs
  [baseUrl] [profile]` on `iphone-se` and `desktop`.
