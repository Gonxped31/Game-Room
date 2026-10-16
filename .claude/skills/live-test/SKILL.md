---
name: live-test
description: Run Game Room end-to-end with two (or more) separate players in Playwright, against the local Firebase Auth + Database emulators instead of the real project. Use to verify any change that affects multiplayer flows, seats, presence, room creation/joining, "Your rooms", or a game's UI across two devices - before claiming such a change works.
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
- **"Port taken" (9000/9099/4400/4500, or the dev port)**: something from an
  earlier run is still listening. Find the process on that port (on Windows,
  `Get-NetTCPConnection -LocalPort 9000 -State Listen` → `OwningProcess`) and stop
  it if it's a leftover `java`/`node` you started. Stopping a background task that
  ran `npx firebase emulators:start` or `npx next dev` *directly* can leave the
  real process behind on Windows. This launcher kills its whole process tree, so
  prefer it.
- **"answered 500", or every page is a 500 with a Turbopack panic in the log**
  (e.g. `node process exited ... 0xc0000142`): the dev cache was corrupted,
  typically by a dev server that was force-killed mid-write. Stop all dev servers
  for this project, delete `.next/dev`, and start again.
- When the launcher fails, it names a log file for each child process. Read it
  before guessing.

## 2. Run the standard two-player check

```bash
node .claude/skills/live-test/scripts/two-players.mjs                  # or pass a base URL
```

It covers:
- FTW: an iPhone creates a room and names it, and a desktop player joins by name
  from the hub. They play a full round.
- Presence: the other side shows as offline within a few seconds of closing.
- A third guest is read-only.
- "Your rooms" lists the room, also after a reload.
- Co-Counsel: auto-assign, and the "Switch role instead" seat swap.

It exits non-zero on failure and prints browser console errors. Zero console
errors is part of passing.

## 3. Writing a check for your own change

Copy the patterns from `scripts/two-players.mjs`:
- `newPlayer(profile, label)` - a fresh context on a device profile (`"iphone"`,
  `"iphone-se"`, `"android"`, `"desktop"`, ...), i.e. a fresh guest ID, that
  collects console errors. Mix phones and desktops.
- `joinFromHub(page, mode, value)` - opens the First to Worst card's Join panel
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
