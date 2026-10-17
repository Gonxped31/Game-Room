---
name: iai
description: Reference for working on Iaï, the ink-painting samurai game - its engine port (2D canvas + WebGL post), the reworked gameplay (walking, jumping, health, endless difficulty, the returning oni), the redesigned art (armoured hero, wolf spirit, hannya oni), solo mode, and two-player co-op on one field (host-run fight, snapshots, the partner's cuts). Use whenever changing or debugging anything under lib/games/iai/, components/iai/ or app/iai/, or answering questions about how Iaï plays.
---

# Iaï

A samurai sword game in a sumi-e (ink-painting) style. Enemies run in from both
sides; you cut at the right moment (a cut within 70 ms of the ideal is perfect).
Rōnin, armoured warriors (two hits), shinobi (feint, then dash), archers (cut
their arrows, or reach and cut them down), and an oni that wakes and returns.
A combo multiplier (up to ×8) and a wolf-spirit gauge (Shift unleashes a wave).

- **Solo** (`/iai/solo`, the hub's Start): the engine's own title and results
  screens, best score per device (localStorage `iai.best`).
- **Co-op** (`/iai#room`): two samurai on one field, until both fall.

**Source of truth**: `references/iai/iai.html` (the original, in French, a
60-second run with a fixed samurai). Game Room's version changes a lot (below).

## What changed from the original

- **No timer: health** (`lib/games/iai/rules.ts`): 100 HP, a blade or arrow 20,
  the oni's fist 34; every 10th hit in a row heals 10. The run ends when every
  samurai has fallen.
- **Endless**: difficulty keeps climbing (`enemyTopSpeed`, `postBossGap`); the oni
  wakes at 42.5 s, then returns 55 s after each defeat with more health
  (`bossHp`, `nextBossAt`).
- **Movement**: A/D (or ←/→) walk and turn, W (or ↑) jumps, Space slashes the way
  you face, Shift unleashes the wolf. Phones: ◀ ▶ JUMP on the left, 斬 on the right,
  the wolf button in the HUD. Jumping clears arrows (chest high) and enemy swings
  and fists (`AIRBORNE_Y`); stepping back during an enemy's wind-up makes it miss.
- **Enemies chase a samurai** (the nearest to their entry side) at their own
  speed, in world space: walking away really gains ground, and walking moves
  only your samurai (never re-anchor an enemy to `target.x + side * d`). `d` is
  recomputed each frame from the real distance. They turn around if you jump
  over them; knock-backs aim at a world spot fixed when the blow lands (`rx`).
  A swing is rooted once it winds up. Perfect cuts are judged by distance and
  closing speed (`judge`), not by the spawn's planned arrival time, since you
  may have moved.
- **Art**: the hero is armoured (lacquered cobalt, gold lacing, kabuto with gold
  kuwagata horns, a plain iron face guard; the white plume is the original's
  hair physics); the spirit is a wolf; the oni follows the hannya mask. All
  painted procedurally, in the original's brush technique.
- English text; health (and time survived) under the score, clear of the oni.

## Files

- `components/iai/engine/engine.js` - **the engine: the original's script**, ported
  (plain JavaScript, typed by `engine.d.ts`). Changes are marked `Game Room:`. It
  was generated from the reference by scripts, then edited directly; edit it
  directly now. `createEngine(root, { mode, exposeForTests })` returns
  `{ startSolo, startCoop, receive, stopCoop, setPartnerName, destroy }`.
- `components/iai/Stage.tsx` - the canvas and the original's markup (memoized: the
  engine writes into it). `mode="coop"` leaves out the engine's title and results
  screens (the page shows lobby and results).
- `components/iai/iai.css` - the original's styles, scoped under `.iai`
  (keyframes `iai-*`), plus Game Room's additions at the end. `fonts.css` - the
  original's embedded fonts, verbatim (Yuji Boku, Cormorant Garamond; the canvas
  draws with them by name). The hub card uses next/font's Cormorant
  (`--font-cormorant`).
- `components/iai/Screens.tsx` - co-op screens (name entry, waiting, lobby and
  results, "Ready", host left).
- `app/iai/solo/page.tsx` (solo, with "Fight together" → `/iai`), `app/iai/page.tsx`
  (co-op), `app/iai/layout.tsx`.
- `lib/games/iai/rules.ts` - balance (health, healing, the oni's schedule and
  strength, difficulty, ranks). `coop.ts` - the co-op room state. Both tested.
- The hub's Start goes to `/iai/solo` via the registry's `startPath`.

## Co-op

- **The room's first seat (p1) hosts**: its engine runs the whole fight. Every
  0.1 s it sends a compact snapshot (enemies, arrows, the oni and its arms, both
  samurai, score/combo/gauge, the wolf wave, the end) to
  `games/{room}/iaiLive/p1` as `{ run, d: JSON string }`.
- **The partner (p2)** mirrors the snapshots (`guestReceive` / `animateMirror`:
  positions smoothed, poses animated locally, effects inferred - an enemy gone
  from the snapshot gets an ink burst and a corpse; a health drop plays the hit).
  It moves its own samurai locally and sends `{ x, y, face, moving, events }`
  every 66 ms to `iaiLive/p2`. **Its cuts are judged on its own screen** and sent
  as `hit` events (target id + verdict); the host applies them (`hostReceive`).
  Locally cut targets are hidden for 1.5 s so a late snapshot can't resurrect them.
- **The host decides all damage**, including to the partner (using the partner's
  last reported position).
- Ids (`GAME.uid`) name enemies, arrows and oni arms on both screens.
- **Room state** (`coop.ts`): LOBBY → (both Ready) RUNNING at `startAt` (server
  time, `RUN_START_DELAY_MS`) → DONE with the host's `CoopResult`; `best` is the
  room's best. If the host goes offline mid-run, the partner can only go back to
  the lobby (`abandonRun`).
- The other samurai wears their name (`setPartnerName`); yours is unlabelled.
- Rules: `database.rules.json` validates `iai` and `iaiLive/$seat` (each seat
  writes only its own; `d` ≤ 30 000 chars). Change a shape → update the rules and
  `tests/rules/gameState.test.ts`, then `npm run test:rules`.

## Verifying a change

- `npm test` (rules, co-op state), `npm run test:rules` for shape changes.
- **Live**: `node .claude/skills/live-test/scripts/iai-coop.mjs` (`live-test`
  skill) - a full co-op run, desktop host vs Android partner.
- **Test hooks** on `window.Iai`: `GAME`, `P`, `R`, `PLAYERS` (live getter),
  `COOP`, `INPUT`, `slash(p)`, `howl(p)`, `startRun`. Summon the oni early with
  `GAME.nextBoss = GAME.t + .5`.
- Screens: `ui-review` skill. Headless rendering is slow; the solo countdown and
  boss intro take a while in real time.
