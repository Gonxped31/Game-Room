# Night Highway: shared traffic, the race, the ghost car, matchmaking

How two devices race the same road. The `night-highway` skill's `SKILL.md` (next to this file) has the rules that matter on every change.

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
  `startAt`, `results`, `wins`, `history`.
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
- **The sound is set up at the first click or key press**, never in the frame a
  countdown starts: creating the `AudioContext` blocks for ~200 ms, which froze
  every race's start (and a rejoin). Under software WebGL (headless Playwright,
  ~2 fps) that freeze was even captured as a black frame.

## The live ghost car (`live.ts`)

- Each racer `set()`s its car to `games/{room}/nighthighwayCars/{seat}` every
  `LIVE_INTERVAL_MS` (100 ms): `{ race, t, s, x, v, score, paint }`. A plain set at
  its own path, not the game state: no transaction contention, and the rules let
  only the seat's holder write it.
- `GhostTrack` buffers the other's samples and interpolates 150 ms behind real
  time (extrapolating briefly if samples stop). The engine draws a clone of the
  player's car in their paint with their name above it, and the HUD shows their
  score and the gap.

## Best on a computer

The registry marks Night Highway `bestOnComputer` (heavy 3D: phones may lag), so
the hub's cards carry a "Best on a computer" tag (a notice on the phone card).
Phone players who arrive by a room link never see the hub, so the game says it
too: `PhoneNote` on the name entry, waiting and matchmaking cards, and the same
line on the solo title card, shown by CSS on a coarse pointer only
(`.nh-phone-note` in screens.css), never by reading the device in render.

## Matchmaking (`docs/matchmaking.md`)

- Hub "Matchmaking" pairs two strangers in a public room (`NIGHTHIGHWAY_MATCH` in
  `lib/games/matchGames.ts`): one queue for everyone (`publicLang: "any"`, no
  language), default switches.
- The page runs `usePublicRoom`: once both are online, the first race starts by
  itself 5 s later (`startRace`, which throws outside `LOBBY`, so only the first
  device's commit counts). After that it's Ready as usual.
- Screens: `MatchLobby` (waiting for a driver, the countdown, or "the other driver
  left" with Find another driver), and `MatchLinks` (Leave room) under the results
  instead of `RoomLinks`.
- The browser's Back button is Leave room in the lobby and on the results
  (`leaveOnBack`), never mid-race. "Drive solo" leaves the room first
  (`leaveTo`).
- **Leaving** (any room): no corner ← on room screens (`Card`'s `back`, set only
  on `Message`). Name entry, waiting for the driver, `RoomLinks` and the match
  screens each have a "Leave room" link. The solo page keeps its ←.
