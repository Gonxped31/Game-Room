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

## Night Highway desert, stages 2 and 3 (next time work on Night Highway resumes)

- **Do:** stage 1 shipped on 2026-10-17 (the Desert switch, the sunset, the
  scenery and the hills). Still to do, as discussed with the user:
  - **(2) Sand:** patches drifting across lanes that slow the car and cut grip,
    with dust plumes; laid out from the race seed like the pickups (a new layout
    next to `pickups.ts`, integer-op randomness only).
  - **(3) Jumps:** a fast crest launches the car: no steering in the air, flying
    over traffic below (an air-time / jumped-a-car bonus), and landing matters (a
    lane, maybe onto a car; a hard landing costs speed). Same jumps for both
    racers, from the seed. The hills (`heightAt` in `road.ts`) are only a
    picture today and use `Math.cos`, so jumps must take their crests from the
    integer-seeded segment layout (`segmentHill`), not from float heights.
  - Commit after each stage.
- **Why:** the desert was split into three stages; the user wanted to see stage 1
  first.
- **Where:** `components/nighthighway/engine/engine.js`,
  `lib/games/nighthighway/road.ts`, a new sand layout next to `pickups.ts`, the
  `night-highway` skill.

## Night Highway desert ships (pushed and deployed)

- **Do:** publish `database.rules.json` **before** deploying the app this time:
  the new client writes `options.desert` in every game-state write, which the old
  rules refuse (`$other: false`); the new rules accept the old client (the field
  is optional). Then race in the desert on a real phone.
- **Why:** this change adds a field, which reverses the usual "client first"
  order.
- **Where:** `database.rules.json` (`nighthighway/options/desert`).

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
