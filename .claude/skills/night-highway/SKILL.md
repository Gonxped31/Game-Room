---
name: night-highway
description: Night Highway, the 3D racing game - three.js r128 engine, deterministic traffic, server-clock timing, ghost car, curves, pickups, rain, desert, solo. Use when changing or debugging lib/games/nighthighway/, components/nighthighway/, app/nighthighway/.
---

# Night Highway

A 60-second drive down a 3D freeway after midnight: weave through traffic, chain
near misses for points (combo up to ×9), and see how far one minute takes you.
- **Race** (`/nighthighway#room`): two players drive the same road at the same
  time, through identical traffic, each seeing the other as a ghost car. Higher
  score wins; the room keeps a series tally.
- **Solo** (`/nighthighway/solo`): the original single-player game, no room. Best
  score per device (localStorage `night-highway:best`).
- **Always on**: curves. **Options** (switches before a race; in solo, on the title
  card, remembered per device): **Pickups** (on by default), **Rain** (off) and
  **Desert** (off: the city at night).

**Source of truth**: `references/night-highway/` (`Night Highway.html`), the original
single-file game (visuals, controls, physics, scoring).

## Reference, next to this file

| File | What's there |
| :--- | :--- |
| `engine.md` | Every file: the engine port and its API, `Stage`, the CSS, the race screens, `lib/games/nighthighway/`, fonts; the offline download |
| `race.md` | Shared traffic, race state and timing, the live ghost car, "Best on a computer", matchmaking and leaving |
| `circuits.md` | Options, pickups, curves (the vertex-shader bend), the desert circuit and its hills, rain |

## Rules that hold on every change

- **The engine** (`components/nighthighway/engine/engine.js`) is a port of the
  reference's script, kept as close to it as possible. It's generated but kept in
  git: edit it directly, and mark every change from the original `Game Room:`.
  It uses `three@0.128.0`: don't upgrade casually (r128 APIs it relies on were removed).
- **`Stage` is memoized so it never re-renders** (the engine writes into it every
  frame), boots the engine in an effect, and `destroy()` must leave nothing behind:
  StrictMode mounts twice.
- **The engine must never fetch anything at play time** (no URLs, workers or files):
  the offline download plays from disk. Check with `npm run export:solo`.
- **A race's traffic must be identical on both devices**: a seeded generator, fixed
  steps, and **only arithmetic every JS engine computes identically** (never
  `Math.exp`, `sin`, `pow`). It never looks at the players, so traffic can't be shoved.
  Pickups and deep sand use integer-op randomness from the seed too.
- **Timing comes from the server's clock** (`useServerClock`), never a device's own.
- **Normalize on read**: `normalizeGame()` in every transition and on every snapshot
  (RTDB drops the empty `ready`/`results`/`history`).
- **The sound is set up at the first click or key press**, never in the frame a
  countdown starts (creating the `AudioContext` froze every race's start).
- **`setOptions` clears both Readys** and is refused mid-race, so nobody races with
  switches they didn't see.
- **New materials must go through `bendMaterial`** (or include `BEND_GLSL`), or they
  won't follow the curves. **Anything long must be subdivided** (~10 m rows), or it
  cuts through the road on a hill's dip.
- **Any new look-dependent value belongs in `CIRCUITS`** (`setCircuit()` swaps them).
- **The ghost car has its own copies of every material** (it would fade with the
  player's car while phasing).
- **The live car is a plain `set` at `nighthighwayCars/{seat}`**, never in the game
  state: no transaction contention, and only the seat's holder writes it.
- **"Best on a computer"** on phones is shown by CSS on a coarse pointer, never by
  reading the device in render.
- **Leaving**: no corner ← on room screens; each has a "Leave room" link. The solo
  page keeps its ←. Back is Leave room in the lobby and on the results, never mid-race.
- A rules change (scoring, controls, options) updates `Rules.tsx` (How to play) too.
- Every word, the engine's included, is in `components/nighthighway/text.ts`, EN and
  FR; the engine gets `text: ENGINE_TEXT[lang]` (never a string in `engine.js`).

## Rules

`database.rules.json` validates `nighthighway` (state) and `nighthighwayCars/$seat`
(live cars). If you change either shape, update the rules and
`tests/rules/gameState.test.ts`, then run `npm run test:rules`
(`database-rules` skill).

## Verifying a change

- `npm test` (traffic, state machine, ghost interpolation, pickups, curves), and
  `npm run test:rules` for shape changes.
- **Test hooks** on `window.NightHighway` (the stage sets `exposeForTests`):
  `jump(m)` skips down the road, `curvature()` / `bend(ahead)` read the curve,
  `rain()` the rain state, `circuit()` the circuit shown and `hill(ahead)` the
  road's height ahead, plus `G`, `player`, `keys` and `raceTrafficChecksum`.
- **The live race check**: `node .claude/skills/live-test/scripts/night-highway-race.mjs`
  (`live-test` skill) - a full race, desktop vs iPhone, about 1.5 minutes.
- Screens: `ui-review` skill. Give the road time to draw (`--wait=9000`):
  headless WebGL is slow. **Playwright's WebKit on Windows draws WebGL only some
  of the time** (a black road, with frames running and no errors). The original
  reference HTML does the same there, so judge the road in Chromium. Playwright's WebKit on Windows renders variable-font
  weights hairline-thin; judge weight on Chromium or a real phone.
- A real iPhone is still owed a look (todo T-017; Night Highway todos are tagged
  `nighthighway` in the `todo` skill).
