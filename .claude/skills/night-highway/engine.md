# Night Highway: files, the engine and the offline download

Every file and what it holds, and how the solo game ships as one offline HTML file. The `night-highway` skill's `SKILL.md` (next to this file) has the rules that matter on every change.

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
  ready"), in the reference's title-card style. Every card but an error has
  How to play's ? in its top corner (`Rules.tsx`, `docs/how-to-play.md`; the
  lobby and the matchmaking lobby have a link, and the solo page's ? sits in
  its top links, outside `Stage`, so the offline download, which compiles no
  Tailwind utilities, leaves it out). The engine ignores keys pressed in an open
  dialog. A rules change (scoring, controls, options) updates `Rules.tsx` too.
- `app/nighthighway/page.tsx` (race), `app/nighthighway/solo/page.tsx` (solo),
  `app/nighthighway/layout.tsx` (title, dark theme colour).
- `lib/games/nighthighway/`:
  - `traffic.ts` - `TrafficSim`, the same-direction traffic (`race.md`).
  - `sand.ts` - the desert's deep sand layout (the desert circuit, `circuits.md`).
  - `game.ts` - the race state machine, plus the scoring rules the engine uses
    (`nearMissPoints`, `MAX_COMBO`, `COMBO_SECONDS`, `NEAR_MISS_*`).
  - `live.ts` - `LiveCar` and `GhostTrack` (interpolating the other car).
  - `pickups.ts` - the pickup layout and constants (`circuits.md`).
  - `road.ts` - the curves (`circuits.md`).
  - `useRace.ts` - `useServerClock`, `useLiveCars`, `useTicker`.
  - `constants.ts` - `RUN_SECONDS` (60), `COUNTDOWN_SECONDS` (3),
    `COUNTDOWN_SPEED`, `RACE_START_DELAY_MS`, `RESULT_GRACE_MS`,
    `LIVE_INTERVAL_MS`, `LANES`, `START_LANE`.
- Fonts (`app/layout.tsx`): Big Shoulders (variable, `opsz` axis - Google's
  current name for "Big Shoulders Display"; it's also the hub card's title),
  Overpass, Overpass Mono. The engine draws canvas text with the real family
  stacks, which `Stage` reads from the CSS variables.

## The offline download (`exports/nighthighway/`)

- Solo, as one HTML file that plays offline (/admin, "Download a solo game"):
  `main.tsx` renders this same `Stage` in solo mode; `scripts/export-solo.mjs`
  bundles it with Vite (React, three.js, the engine, `lib/games/nighthighway`)
  and inlines the JS, CSS, Tailwind's base (`tailwind.css`: preflight is what
  hides `[hidden]`) and the fonts. Runs before every `next build`.
- So **the engine must never fetch anything at play time** (no URLs, workers or
  files): the file plays from disk, with no network.
- Check after a change: `npm run export:solo`, then open
  `downloads/nighthighway.html` from disk with the network off.
