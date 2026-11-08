---
name: live-test
description: Two or more players end to end in Playwright, phones and desktop, against the emulators. Use before claiming a multiplayer, seat, presence, room, "Your rooms" or cross-device UI change works.
---

# Live two-player testing (emulators + Playwright)

Unit and rules tests don't cover hooks, rendering or two-device flows; this does.
It never touches the real Firebase project.
- Each Playwright **browser context** is a separate guest ID, like two people's
  devices. Two *tabs* in one context share a guest ID and can hold only one seat.
- **Players are real device profiles**, shared with the `ui-review` skill
  (`PROFILES` in `.claude/skills/ui-review/scripts/screenshots.mjs`): iPhones run
  in WebKit (Safari's engine), and Android and desktop in Chromium. The standard
  check has an iPhone play against a desktop browser, which is how the games are
  actually played.
- **Needs Playwright's WebKit and Chromium browsers** (`npx playwright install
  webkit chromium`, one time per machine).

## 1. Start the emulators and a dev server pointed at them

```bash
node .claude/skills/live-test/scripts/dev-against-emulators.mjs        # port 3123 by default
```

Run it in the background. It prints `READY http://localhost:3123` once both are
up, and stops both on exit.
- Shell env vars override `.env.local`, so the app talks only to the emulators.
- **Next allows one dev server per project.** If it fails with "Another next dev
  server is already running", stop that one first. Only stop a server you started
  yourself; otherwise ask the user.
- The emulators need Java.
- **"Port taken"**, or **every page a 500 with a Turbopack panic** (a corrupted
  `.next/dev`): what to do is in `reference.md` (next to this file). When the
  launcher fails, it names a log file for each child process: read it before guessing.

## 2. Run the checks

Every script is in `.claude/skills/live-test/scripts/`, exits non-zero on failure and
prints browser console errors: zero console errors is part of passing. What each one
covers, step by step: `reference.md`.

| Check | Run | About |
| :--- | :--- | :--- |
| Standard: Same Page round, presence, a read-only third guest, "Your rooms", Co-Counsel auto-assign and swap | `two-players.mjs [baseUrl]` | |
| Night Highway race (desktop vs iPhone, options, identical traffic) | `night-highway-race.mjs [baseUrl] [screenshotDir]` | 1.5 min |
| Buzzer Quiz (host + iPhone + Android, simultaneous buzz) | `buzzer-quiz.mjs [baseUrl] [screenshotDir]` | 1 min |
| Word Scramble (2v2: desktop + three phones, hint, drag, steal) | `word-scramble.mjs [baseUrl] [screenshotDir]` | 1.5 min |
| Last Hop (a whole Track match, host-only controls, then matchmaking) | `last-hop.mjs [baseUrl] [screenshotDir] [phoneProfile]` | 3 min |
| Rank & File races (Challenge, 4-player Survival, matchmaking by mode) | `checkmate-grid-race.mjs [baseUrl] [screenshotDir]` | 4 min |
| Rank & File solo edge cases, on `iphone-se` and `desktop` at least | `checkmate-grid.mjs [baseUrl] [profile]` | 2 min each |
| Detour races (Challenge, 4-player Survival, separate queues) | `border-run-race.mjs [baseUrl] [screenshotDir]` | 4 min |
| Detour solo edge cases, on `iphone-se` and `desktop` at least | `border-run.mjs [baseUrl] [profile]` | 1 min each |
| Matchmaking (queues by language, Back = leave, lone-player merge) | `matchmaking.mjs [baseUrl] [screenshotDir]` | 4 min |

The solo edge-case checks go past the basic path: add a case to them for every new
interaction.

## 3. Writing a check for your own change

Copy the patterns from `scripts/two-players.mjs`:
- `newPlayer(profile, label)` - a fresh context on a device profile (`"iphone"`,
  `"iphone-se"`, `"android"`, `"desktop"`, ...), i.e. a fresh guest ID, that
  collects console errors. Mix phones and desktops.
- `joinFromHub(page, mode, value)` - opens the Same Page card's Join panel
  (popover on desktop, sheet on phones), picks `"code"` or `"name"`, types and
  submits. A room of another game opens too: routing follows the room's own game.
- `adminRead(path)` - reads emulator data while bypassing the rules (`Authorization:
  Bearer owner`). Use it to assert on the database itself (seats, names, game
  state) rather than only the UI.
- `until(fn, what)` - polls with a timeout. Prefer it over fixed sleeps.
- **FTW card placement**: click a hand card (`button[aria-label^="Number"]`), then
  a slot (`[data-drop-id] button`).
- **Taking over a seat** needs the holder offline for 2 minutes. Either wait, or
  test it in the rules tests (`tests/rules/`) instead.
- **Local mode** (no Firebase): run `npm run dev` with the five
  `NEXT_PUBLIC_FIREBASE_*` vars set to empty strings. There, two *tabs* of one
  context are two players, since the fake guest ID is per tab.

Write ad-hoc scripts to the scratchpad, not the repo, unless they're worth
keeping as a standard check.

## 4. Clean up

- Stop the background launcher (step 1), then confirm nothing is still listening
  on 9000/9099/3123.
- Delete any `firebase-debug.log`/`database-debug.log`. They're git-ignored, but
  don't leave them around.
