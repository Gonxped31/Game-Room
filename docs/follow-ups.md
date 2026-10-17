# Follow-ups

Deferred work that should happen **when something else happens**, not now. Each
entry names its trigger. When you finish a task, check whether it triggered any
entry below. If it did, do that work (or tell the user it's now due), then delete
the entry. Delete an entry too once it no longer applies.

Format: **When** (the trigger) · **Do** (the change) · **Why** (so a future reader
can judge whether it still applies) · **Where** (files involved).

---

## The first game with 3+ players ships

- **Do:**
  - Merge `useGameSession` and `useMultiplayerSession` into one session engine,
    keeping a thin 1v1 wrapper so existing game pages don't change.
  - Build N-player versions of `RolePicker` and `Header`, which are hardcoded to 2
    seats.
  - Delete the unused `setIdentityName`/`releaseAllIdentityNames`
    (`lib/session/identity.ts`) and `setMultiplayerIdentityName`
    (`lib/session/multiplayer/identity.ts`), along with their tests.
  - Drop the always-empty `names` field that `WithIdentity` forces into every game
    state.
- **Why:** both hooks are already thin mappings over `lib/session/shared/useRoom.ts`.
  They were kept apart only so the 1v1 API stayed stable until a real 3+ player
  game showed what the merged API should look like.
- **Where:** `lib/session/useGameSession.ts`, `lib/session/multiplayer/`,
  `lib/session/types.ts`, `components/RolePicker.tsx`, `components/Header.tsx`,
  both games' `game.ts` (`names: {}` in `newGame`).

## Preview deployments should stop sharing production's data

- **Do:** create a second Firebase project, deploy `database.rules.json` to it, and
  set its five `NEXT_PUBLIC_FIREBASE_*` vars on Vercel's Preview environment only.
- **Why:** previews use production's vars today, so rooms created on a preview land
  in the production database.
- **Where:** Vercel project settings and the Firebase console; no code changes.

## Night Highway gets bikes (next time work on Night Highway resumes)

- **Do:** add bikes, as decided with the user (2026-10-17):
  - **A race switch**, Vehicle: Cars / Bikes, so both riders always ride the same
    thing. It goes in `GameState.options` like Rain/Pickups (rules + rules tests,
    solo title card switch); it needs one more rules publish when it ships.
  - **A sport bike** (superbike style, matching the car), modelled in code like the
    car, with a rider who leans into turns and bends. The ghost rides one too.
  - **Physics:** about half a car's width (it can split lanes), quicker
    acceleration and sharper steering, a lower top speed than the car with nitro,
    even less grip in rain. Tighten the near-miss distance so combos still take
    skill.
  - **Crashes knock the rider down:** a short tumble and about a second to get back
    up (not the car's bump).
  - Build in two stages, committing after each: (1) the switch, physics, the
    fall, a clean simple bike and the bike ghost, checked with unit/rules tests
    and one live race; (2) polish: a more detailed model, the camera tilting into
    leans, near-miss tuning, docs.
- **Why:** paused only for lack of usage at the time; the design is settled.
- **Where:** `components/nighthighway/engine/engine.js`, `lib/games/nighthighway/game.ts`
  (options), `components/nighthighway/Screens.tsx` and `Stage.tsx` (switches),
  `database.rules.json`, `tests/rules/gameState.test.ts`, the `night-highway` skill.

## Night Highway gets a desert circuit (after bikes ship)

- **Do:** add a second circuit, as discussed with the user (2026-10-17):
  - **A race switch**, Circuit: City / Desert, in `GameState.options` like the
    others (rules + rules tests, solo title card); one more rules publish.
  - **Sunset**, not night: a low sun and a warm orange-to-pink sky over the
    desert (a real change from the city's night palette; the sky, fog, lighting
    and grading all need a sunset set of values).
  - **Scenery** in place of the city: dunes and mesas, cacti and rocks, a desert
    road surface. Modelled in code, like the city.
  - **Bumps:** hills, by bending the world vertically in the vertex shaders the way
    curves bend it sideways (`lib/games/nighthighway/road.ts`); traffic and the race
    sync stay untouched.
  - **Sand:** patches drifting across lanes that slow the car and cut grip, with
    dust plumes; laid out from the race seed like the pickups.
  - **Jumps:** a fast crest launches the car: no steering in the air, flying over
    traffic below (an air-time / jumped-a-car bonus), and landing matters (a lane,
    maybe onto a car, a hard landing costs speed). Same jumps for both racers, from
    the seed.
  - Build in stages, committing after each: (1) the switch, sunset, scenery and
    hills; (2) sand; (3) jumps.
- **Why:** bigger than bikes; agreed to do bikes first.
- **Where:** `components/nighthighway/engine/engine.js` (scenery, sky, physics),
  `lib/games/nighthighway/road.ts` (hills, jumps), a new sand layout next to
  `pickups.ts`, `game.ts` (options), `Screens.tsx`/`Stage.tsx`,
  `database.rules.json`, `tests/rules/gameState.test.ts`, the `night-highway` skill.

## Monetization work starts

- **Do:** start from `docs/monetization.md` (the plan drafted with the owner on
  2026-10-17: host-pays "Game Room Plus", premium content inside the games, light
  or no ads, Paddle/Lemon Squeezy, analytics first). Settle its two open
  questions with the owner first; the sign-in one changes a CLAUDE.md product
  decision.
- **Why:** the owner parked it to build another game first.
- **Where:** `docs/monetization.md`.

## Next time someone has a real iPhone handy

- **Do:** on a real iPhone (Safari), check:
  - FTW: are the five hand cards in the bottom bar showing their numbered faces
    (1-5), not a mirrored "RANK CARD" back?
  - FTW: does "Shuffle prompt" read as one word (not "Shuff le")?
  - Iaï: do the touch buttons (move, jump, slash, wolf) feel right, and does the
    HUD clear the notch and home bar?
  - Night Highway: does the road render smoothly (the engine lowers its own
    resolution when frames run slow), do the touch buttons steer, brake and boost,
    and does the HUD clear the notch and home bar? Is the "Night Highway" wordmark
    heavy, not hairline-thin?

  If all of that looks right, delete this entry. If not, fix it (the card flip's
  `backfaceVisibility` in `components/ftw/CardFace.tsx`; Fredoka's `ffl`
  ligature; Night Highway's `components/nighthighway/`) and verify on the phone.
- **Why:** the FTW issues show up only in Playwright's WebKit on Windows, not on
  the Android or desktop profiles. Adding the `-webkit-backface-visibility` prefix
  made no difference there. That points to how WebKit's Windows build draws 3D
  transforms and fonts, not to a real iPhone bug, but only a real device can
  confirm it. Night Highway can't be judged there either: that WebKit draws the
  3D road slowly and renders variable-font weights hairline-thin.
- **Where:** `components/ftw/CardFace.tsx`, `components/ftw/Hand.tsx`,
  `components/nighthighway/`.

## Robustness backlog (planned 2026-10-17)

Done: real-time traffic measured (Night Highway ~100 bytes, 10×/s, already
rounded), page weight checked (heavy engines already load only where used), and
crash/connection handling (`app/error.tsx`, `app/global-error.tsx`,
`ConnectionBanner`, tested by dropping a player offline mid-round). Deferred,
with their triggers:

### When the Firebase project moves to the Blaze plan (or storage nears the free tier)

- **Do:** a scheduled Cloud Function that deletes rooms idle for 30+ days
  (`lastActive`, falling back to `meta.createdAt`), with their `roomsByName`
  entry.
- **Why:** rooms are never deleted today; "Your rooms" only hides them. Cloud
  Functions need the paid plan.
- **Where:** a new `functions/` package, `firebase.json`.

### When a multiplayer regression slips past CI

- **Do:** run `two-players.mjs` in CI against the emulators (install Java and
  Playwright's browsers, start `dev-against-emulators.mjs`, then the script).
- **Why:** CI checks lint, types, unit and rules tests, but nothing renders a page
  with two players. Skipped for now because it's slow to set up.
- **Where:** `.github/workflows/ci.yml`, `.claude/skills/live-test/scripts/`.

## Iaï: the user sends the art specs (mask, wolf, body)

- **Do:** redesign the samurai's mask (after the blue wolf/kitsune mask reference
  the user shared: tall ears, sculpted fur, black nose, white ruff, bronze fangs),
  the wolf spirit (white, black ink, red markings and swirl, Okami-like), and a
  more realistic samurai body, following the specs. The jump motion is already
  done (`AIR`, `Samurai.updateAir`).
- **Why:** the user asked to hold the art until they write the specs.
- **Where:** `components/iai/engine/engine.js` (`drawHeroHead`, `paintWolf`,
  `drawTorso`/`drawLeg`/`drawArm`), the `iai` skill.

## Iaï ships (pushed and deployed)

- **Do:** deploy the app, then publish `database.rules.json` (the `iai` and
  `iaiLive` nodes); then check touch controls (◀ ▶ JUMP, 斬, wolf) on a real phone.
- **Why:** Iaï is local-only on purpose until the user says to push it.
- **Where:** `app/iai/`, `database.rules.json`.
