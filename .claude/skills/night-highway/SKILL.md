---
name: night-highway
description: Reference for working on Night Highway, the 3D night-freeway racing game - its engine port (three.js r128), the deterministic shared traffic, the race state machine and server-clock timing, the live ghost car channel, solo mode, and gotchas. Use whenever changing or debugging anything under lib/games/nighthighway/, components/nighthighway/ or app/nighthighway/, or answering questions about how Night Highway plays.
---

# Night Highway

A 60-second drive down a 3D freeway after midnight: weave through traffic, chain
near misses for points (combo up to ×9), and see how far one minute takes you.
- **Race** (`/nighthighway#room`): two players drive the same road at the same
  time, through identical traffic, each seeing the other as a ghost car. Higher
  score wins; the room keeps a series tally.
- **Solo** (`/nighthighway/solo`): the original single-player game, no room. Best
  score per device (localStorage `night-highway:best`).

**Source of truth**: `references/night-highway/Night Highway.html`, the original
single-file game (visuals, controls, physics, scoring).

## Files

- `components/nighthighway/engine/engine.js` - **the engine: a port of the
  reference's script**, kept as close to it as possible (so it stays plain
  JavaScript; `engine.d.ts` types its API). Every change from the original is
  marked `Game Room:`.
  - **It's generated, but kept in git.** A port script built it from the
    reference and the changes since are small edits; edit the file directly now,
    keeping the `Game Room:` markers so the two stay comparable.
  - `createEngine(root, { mode, fonts, ... })` boots on the stage markup and returns
    `{ startSolo, startRace, stopRace, setOpponent, trafficChecksum,
    raceTrafficChecksum, destroy }`.
  - Uses `three@0.128.0` from npm (the reference's version). Don't upgrade
    casually: r128 APIs it relies on (`WebGLMultisampleRenderTarget`,
    `sRGBEncoding`) were removed later.
- `components/nighthighway/Stage.tsx` - the full-screen stage: the reference's
  markup as JSX, **memoized so it never re-renders** (the engine writes into it
  every frame). Boots the engine in an effect via a dynamic import, so three.js
  never loads on the server. React StrictMode mounts twice; `destroy()` must
  leave nothing behind (listeners, rAF, the WebGL context).
- `components/nighthighway/nighthighway.css` - the reference's stylesheet, scoped
  under `.nh` (keyframes prefixed `nh-`). `screens.css` - the race page's own
  screens.
- `components/nighthighway/Screens.tsx` - the race page's screens (name entry,
  waiting for the other driver, lobby/results, waiting for their result, "Get
  ready"), in the reference's title-card style.
- `app/nighthighway/page.tsx` (race), `app/nighthighway/solo/page.tsx` (solo),
  `app/nighthighway/layout.tsx` (title, dark theme colour).
- `lib/games/nighthighway/`:
  - `traffic.ts` - `TrafficSim`, the same-direction traffic (see below).
  - `game.ts` - the race state machine, plus the scoring rules the engine uses
    (`nearMissPoints`, `MAX_COMBO`, `COMBO_SECONDS`, `NEAR_MISS_*`).
  - `live.ts` - `LiveCar` and `GhostTrack` (interpolating the other car).
  - `useRace.ts` - `useServerClock`, `useLiveCars`, `useTicker`.
  - `constants.ts` - `RUN_SECONDS` (60), `COUNTDOWN_SECONDS` (3),
    `COUNTDOWN_SPEED`, `RACE_START_DELAY_MS`, `RESULT_GRACE_MS`,
    `LIVE_INTERVAL_MS`, `LANES`, `START_LANE`.
- Fonts (`app/layout.tsx`): Big Shoulders (variable, `opsz` axis - Google's
  current name for "Big Shoulders Display"; it's also the hub card's title),
  Overpass, Overpass Mono. The engine draws canvas text with the real family
  stacks, which `Stage` reads from the CSS variables.

## Shared traffic (`traffic.ts`)

- **A race's traffic must be identical on both devices**, so the "fixed" mode is
  fully deterministic:
  - a seeded generator (mulberry32, integer ops only), fixed 1/30 s steps;
  - **only arithmetic every JS engine computes identically**: `+ - * /`,
    comparisons, `Math.imul/min/max/abs/floor/round`. **Never `Math.exp`, `sin`,
    `pow`** (their last bits can differ between Safari and Chrome); the original's
    `damp()` factors are precomputed constants (`EASE_BRAKE`, `EASE_CRUISE`);
  - it never looks at the players, so nothing a player does can make copies drift.
  - Cars are spread over the whole road a race can reach (`FIXED_ROAD_START` to
    `FIXED_ROAD_END`), with the start grid clear.
- "recycle" mode (solo and the cinematic title screen) keeps 16 cars around the
  player and respawns them ahead, like the original.
- **The engine maps sim cars onto instanced slots every frame** (`syncTraffic`,
  `z = dist - s`), nearest first. `dist` is the player's distance down the road.
- **Traffic can't be shoved any more** (both racers must keep identical traffic):
  rear-ending a car drops the player behind it; a car catching up nudges the
  player ahead. Oncoming traffic never meets the player, so it stays local and
  random.
- Tests: `traffic.test.ts` (same seed → same state however it's stepped, no lane
  overlaps through a whole race, coverage). The live check compares V8 and
  JavaScriptCore directly (`raceTrafficChecksum`).

## Race state (`game.ts`) and timing

- `GameState`: `phase` (`LOBBY | RACING | DONE`), `race` (count), `ready`, `seed`,
  `startAt`, `results`, `wins`, `history`, plus the always-empty `names`.
- `setReady(game, role, ready, now, seed)` - the second Ready starts a race:
  `startAt = now + RACE_START_DELAY_MS` (server time), a fresh `seed`.
- `submitResult` - one per seat; both in → `DONE`, winner (ties are `"tie"`),
  `wins`, `history`.
- `giveUpOnMissingResults(game, now)` - after `RESULT_GRACE_MS` past the race's
  end, a missing result (that tab closed) is given up on; the finisher wins.
- **Normalize on read**: `normalizeGame()` runs in every transition and once on
  every snapshot in the page, because RTDB drops the empty `ready`/`results`/
  `history`.
- **Timing comes from the server's clock** (`useServerClock` →
  `watchServerTimeOffset`), never a device's own: race time `rt = serverNow -
  startAt`. Before 0: "Get ready". 0-3 s: a scripted countdown, both cars side by
  side in their `START_LANE` at `COUNTDOWN_SPEED`. 3-63 s: driving. At 63 s each
  device submits its result.
- **Slow frames are made up in a race** (50 ms sub-steps, up to 0.25 s per frame);
  solo keeps the original's 50 ms cap. Without this, a device drawing under 20 fps
  covers less road in its 60 seconds.
- A device that reloads mid-race rejoins where the countdown would have put it,
  with a fresh score. The engine never restarts a race number it finished.
- No pause/restart in a race (the clock is shared).

## The live ghost car (`live.ts`)

- Each racer `set()`s its car to `games/{room}/nighthighwayCars/{seat}` every
  `LIVE_INTERVAL_MS` (100 ms): `{ race, t, s, x, v, score, paint }`. A plain set at
  its own path, not the game state: no transaction contention, and the rules let
  only the seat's holder write it.
- `GhostTrack` buffers the other's samples and interpolates 150 ms behind real
  time (extrapolating briefly if samples stop). The engine draws a clone of the
  player's car in their paint with their name above it, and the HUD shows their
  score and the gap.

## Rules

`database.rules.json` validates `nighthighway` (state) and `nighthighwayCars/$seat`
(live cars). If you change either shape, update the rules and
`tests/rules/gameState.test.ts`, then run `npm run test:rules`
(`database-rules` skill).

## Verifying a change

- `npm test` (traffic, state machine, ghost interpolation), and `npm run
  test:rules` for shape changes.
- **The live race check**: `node .claude/skills/live-test/scripts/night-highway-race.mjs`
  (`live-test` skill) - a full race, desktop vs iPhone, about 1.5 minutes.
- Screens: `ui-review` skill. Give the road time to draw (`--wait=9000`):
  headless WebGL is slow. Playwright's WebKit on Windows renders variable-font
  weights hairline-thin; judge weight on Chromium or a real phone.
- A real iPhone is still owed a look (see `docs/follow-ups.md`).
