---
name: borderrun
description: Reference for working on Border Run (slug borderrun), the solo geography game - link two countries by land around closed borders - its map data and how it's built, the route generator, guess grading and penalty, the EN/FR names, endless and daily modes, the map UI, the offline export and gotchas. Use whenever changing or debugging anything under lib/games/borderrun/, components/borderrun/ or app/borderrun/, rebuilding the map data (scripts/borderrun-data.mjs), or answering questions about how Border Run plays. For the shared daily system (lib/daily/, app/api/daily/), also read docs/daily.md.
---

# Border Run

A solo game at `/borderrun` (the title is a working name; the slug stays
`borderrun`). Based on Travle, with closed borders as the twist (the user's
picks, 2026-10-26).

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

**Daily rotation** (`SCHEDULE` in `daily.ts`, Monday first): Europe 3-5,
Americas 3-5, Africa 3-5, Asia 3-5, Europe 4-6, Europe and Asia 4-6, the world
5-7 (par ranges). Endless uses the same ranges per map.

**A reload loses nothing** (`components/borderrun/storage.ts`): the tab, the
language, the Endless route in progress (route, guesses, time spent; dropped
once complete, given up or on Change) and today's Daily guesses with the
route (kept after finishing, for the map and the share squares; a completed
route that never reached the server is sent on resume).

## The map data

`scripts/borderrun-data.mjs` builds two committed JSON files from pinned
public sources (world-atlas 2.0.2 = Natural Earth 1:50m, public domain;
i18n-iso-countries 7.14.0 for codes and EN/FR alternatives; Natural Earth
5.1.2 1:50m populated places for capitals; Node's `Intl.DisplayNames` for
display names). Rerun it only to change the data: it is deterministic, so a
rerun with no script change leaves both files as they are.

| File | What | Who loads it |
| :--- | :--- | :--- |
| `lib/games/borderrun/countries.json` | 199 countries by ISO alpha-2: `en`, `fr`, `aliases`, land `borders` (318), and a `capital` (`en`, `fr`, `at` [lon, lat]) for every country with a border | Server (daily) and client |
| `lib/games/borderrun/shapes.json` | `c` centre, `p` simplified outlines, delta-encoded in 1/100° (~200 KB, ~75 KB gzipped) | Client only (`RouteMap`) |

How it's made, and why:
- **Borders are shared arcs**: two countries border each other where their
  topology outlines share an arc, so sea neighbours never count. Checked in
  tests against known pairs (and known non-pairs: France-UK, Spain-Morocco).
- **Each arc is simplified once** (Douglas-Peucker, 0.04°), so neighbours
  share the exact same border line; the map finds a closed border's spot from
  the vertices both countries have.
- **French Guiana is its own country (GF)**, split off France's polygon (it
  borders Brazil and Suriname); France's other overseas islands are dropped.
  Somaliland merges into Somalia, Northern Cyprus into Cyprus; Kosovo is XK.
  Dependencies with no land border (Guam, Bermuda…) are left out.
- **An alias two countries share** ("Congo") is dropped: display names
  decide (Congo = CG, DR Congo / RD Congo = CD).
- **Date line**: a ring that crosses it (Russia's far east, Fiji) is kept
  whole east of 180°, or it would draw as a band across the map.
- The Vatican's outline collapses at this simplification: it has only its
  centre, drawn as a dot (like every country too small to see on the map).
- **Capitals are the official seat**, not the biggest city: `CAPITAL` picks
  by name where Natural Earth lists several or the wrong one (Pretoria,
  Sucre, Dodoma, Porto-Novo…), `CAPITAL_FIX` covers what it is out of date on
  (Gitega, Astana). Tests pin a few.

## The map

**Closed borders** are drawn along their length in red (`borderLines`: the
runs of one country's outline through the other's vertices), with a small ✕
at the border's middle (`borderPoint`), so the mark is as big as the border.

**It zooms and pans** (`useZoom`, in the SVG's viewBox): the + button (from
the whole map it zooms in on what's drawn, not the map's middle), − and
"Show the whole map" once zoomed, double tap or click, pinch, ctrl + wheel
(a trackpad pinch; a plain wheel still scrolls the page), drag once zoomed.
- **Sizes are in the visible width** (`vw`), so dots, ✕s, rings and names
  keep their size on screen; tiny countries switch from a dot to their
  outline as you zoom in. Strokes are `non-scaling-stroke`.
- **Touch**: `touch-action: pan-y` on the whole map (one finger scrolls the
  page), `none` once zoomed; a non-passive `touchmove` cancels the browser's
  own pinch and scroll for two fingers or when zoomed.
- **The zoom resets with the route**: `PlayMap` keys `RouteMap` by the route,
  so finishing keeps the zoom and New route starts with the whole map.
- Live test B12 covers the buttons, drag, double tap or click and ctrl +
  wheel; pinch is only testable on a real phone.

**Names** (`placeLabels`) never hide a small country: inside a country only
when the name fits there, otherwise above or below it (beside it only for a
tall one like Chile, since beside drifts onto neighbours), clear of the
small countries drawn and of the zoom buttons' corner (measured with a
`ResizeObserver`). The start's and end's try every side, and at worst cover
a small country rather than go missing. A name with no room is left out:
zooming in makes room, and the route is spelled out under the map.

## The finished map

Once a route is over (complete, or shown on giving up), `PlayMap` passes the
route to `RouteMap`, which draws a dotted line through it (drawn in over
1.2 s, none with reduced motion) and names its countries; `CapitalLine` adds
"Lisbon → Warsaw · 2,760 km as the crow flies" under the map.
- **The line crosses each border at `crossingPoint`**: the shared vertex
  with the shortest detour from the previous point toward the next country,
  not the border's middle (`borderPoint`, still used for the closed-border ✕).
  The middle of Russia-China is on the Amur, so a route coming from the
  Caucasus looped out to Manchuria.
- **Names and the line's ends sit on `anchorOf`**: the country's centre, or
  the middle of its visible outline when the centre is off the map (Russia on
  Europe). The line's ends use the whole map, so the line stays put as you
  pan; names use the part in view.

## Files

| Path | What |
| :--- | :--- |
| `lib/games/borderrun/constants.ts` | `GAME_TITLE`, `PENALTY_MS`, `AREAS`, par limits |
| `lib/games/borderrun/countries.ts` | `COUNTRIES`, `findCountry` (EN/FR/aliases, accents and articles ignored), `suggest`, `capitalDistanceKm` |
| `lib/games/borderrun/areas.ts` | Each map's countries (Russia and Turkey on Europe and Asia; Oceania only on the world map), its view box, its name |
| `lib/games/borderrun/route.ts` | `Route`, `neighboursOf` (map + closed borders), `distances`, `shortestPath`, `closenessOf`, `generateRoute`, the seeded RNG |
| `lib/games/borderrun/play.ts` | The guess log: `refusalOf`, `addGuess`, `replay`, `status` (complete, path, extra, penalty) |
| `lib/games/borderrun/daily.ts` | The `DailyGame`: `SCHEDULE`, `verify` replays the guesses and returns `penaltyMs` |
| `lib/games/borderrun/theme.ts` | Colours (match `borderrun.css`), share squares |
| `components/borderrun/Stage.tsx` | The page shell: title sign, EN/FR switch, mode tabs; `online` adds Daily |
| `components/borderrun/RouteMap.tsx` | The SVG map (Miller projection, fixed size per map), its zoom (`useZoom`) and names (`placeLabels`) |
| `components/borderrun/Controls.tsx` | `Segmented`, `RouteHeader`, `Toolbar`, `GuessInput` (combobox), `GuessList`, `PlayMap`, `CapitalLine` |
| `components/borderrun/EndlessGame.tsx`, `DailyGame.tsx` | The two modes |
| `components/borderrun/borderrun.css` | **All styles, plain CSS**, every rule under `.br-page` |
| `exports/borderrun/` | The offline single-file export (Endless only; Overpass inlined) |

## The generator

`generateRoute(seed, {area, minPar, maxPar})`: pick a start, an end a few
steps away, then close a border that **every** shortest route crosses (from
counting shortest paths through each edge), once or twice, so the obvious
way really is blocked and each closure lengthens the route. Kept when a route
still exists and the par is in range. Deterministic per seed (the daily's
secret seed on the server; `crypto.randomUUID()` in Endless), a few ms.

## Gotchas

- **Plain CSS under `.br-page`**: the export compiles only Tailwind's base,
  and the shared `daily-*` classes are also styled by Checkmate Grid's CSS,
  so every rule is scoped to this page.
- **The map never changes size** within a route (the user's rule for
  Checkmate Grid's board, kept here): its aspect comes from the map's view
  box, not from what's drawn.
- **Suggestions keep the input's focus** (`onPointerDown` preventDefault), so
  a phone's keyboard stays up between guesses. The first suggestion is
  highlighted: Enter takes it. Text with no suggestion goes through
  `findCountry`, and a refusal names the reason.
- **Guess times never go backwards** (`addGuess` refuses them, so does the
  daily check): the daily takes the max of the server-offset clock and the
  last guess.
- **Overpass weights**: the site loads 400-800 for Border Run (app/layout.tsx).

## Verifying

- `npm test`: `lib/games/borderrun/borderrun.test.ts` (data, names, routes on
  every map, play, daily verify) and `lib/daily/daily.test.ts` (the penalty
  through the service).
- `ui-review` for `borderrun` and `hub`; drive it with a scratch script (the
  live-test script below shows how to read the route and its answer).
- **Every change**: `node .claude/skills/live-test/scripts/border-run.mjs
  [baseUrl] [profile]` on `iphone-se` and `desktop`.
