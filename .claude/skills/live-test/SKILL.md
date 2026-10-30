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

**Night Highway** has its own check, since a race lasts a full minute (about 1.5
minutes in all):

```bash
node .claude/skills/live-test/scripts/night-highway-race.mjs [baseUrl] [screenshotDir]
```

It starts a solo run, then races a desktop player against an iPhone:
- Ready on both sides starts the race in the database.
- Chromium and WebKit compute identical traffic for the race's seed.
- Each switches an option on (Rain, Desert) and the other sees it; they race in
  the desert, in the rain.
- Each HUD names the other driver, and both live cars reach the database.
- Both results land when the clock runs out, and both see the results screen.

**Buzzer Quiz** has its own check too (about a minute):

```bash
node .claude/skills/live-test/scripts/buzzer-quiz.mjs [baseUrl] [screenshotDir]
```

A desktop host sets up a French 5-question quiz, and an iPhone and an Android
player join. Two players buzz at once and the lower reaction time answers. A wrong
pick is struck out on all three and locks its player out. The host answers right
by keyboard for 2 points and wins, and a player starts the rematch.

**Word Scramble** has its own check too (about a minute and a half):

```bash
node .claude/skills/live-test/scripts/word-scramble.mjs [baseUrl] [screenshotDir]
```

A desktop host and three phones form two teams of two. The uneven-teams warning shows
until the fourth player joins. They play 3 turns per team:
- a wrong arrangement shows in both teams' feeds;
- a hint costs a point and locks its letter in place;
- a tile is dragged with the mouse, the rest tapped in and confirmed;
- right guesses are scored;
- one turn times out and the other team steals it.

Then come the end screen and a rematch with the same teams.

**Last Hop** has its own check (about three minutes):

```bash
node .claude/skills/live-test/scripts/last-hop.mjs [baseUrl] [screenshotDir] [phoneProfile]
```

A desktop host (who starts a Track room from the hub) and a phone (`iphone`
by default; `iphone-se` checks the smallest Track) play a whole Track match:
the lobby only shows the mode; nothing can be picked during "Get ready" or by
the waiting player; a reload mid-round keeps the board; Leave room asks first;
a round lost on time (the clock is cut through the emulator); the pair's
second round on the same board with sides swapped; the match's end, also after
a reload. Between matches only the host switches to Grid; Play again plays a
Grid round with a clean score; Reset game keeps Grid. Then matchmaking: two
strangers search Track, land in one room, the match starts by itself, one
leaves mid-match and the other is offered "Find another player".

**Checkmate Grid's races** (`/regions/race`) have their own check (about four minutes):

```bash
node .claude/skills/live-test/scripts/checkmate-grid-race.mjs [baseUrl] [screenshotDir]
```

It solves each puzzle from the board on screen. A private Challenge (desktop
host + iPhone): the host picks the piece, Survival refuses 2 players; a tap
during the countdown does nothing; a reload mid-round keeps the pieces; Auto ✕
locks; one solves and one gives up, so the round ends early; the results show
anyone's board and the faint answer; Undo; 3 puzzles, the standings, back to
the lobby, Leave room. Then a 4-player Survival down to a winner, and
matchmaking by mode.

**Checkmate Grid** (solo, `/regions`) has an edge-case check (about two minutes per
profile; run it on `iphone-se` and `desktop` at least):

```bash
node .claude/skills/live-test/scripts/checkmate-grid.mjs [baseUrl] [profile]
```

It goes past the basic path:
- the Auto ✕ lock belongs to its puzzle: New puzzle, Next puzzle (after a solve)
  and Change → Start all unlock it, with no faint ✕ carried over;
- a reload or a Daily ↔ Endless round trip keeps the same puzzle and its lock;
- Change while a puzzle is being built: nothing lands, and a reload shows the setup card;
- two quick New puzzle presses: the board saved is the one shown;
- the Daily lock is separate from Endless's, and survives a reload.

It exits 1 on any failure. Add a case here for every new interaction.

**Border Run's races** (`/borderrun`) have their own check (about four minutes):

```bash
node .claude/skills/live-test/scripts/border-run-race.mjs [baseUrl] [screenshotDir]
```

A private Challenge (desktop host + iPhone): Start asks for a mode; the host
changes the map and the mode (Survival refuses 2 players); the countdown holds
the guess box; one solves and one gives up, so the round ends early; a reload
mid-round keeps the guesses; 3 routes, the standings, back to the lobby, Leave
room. Then a private Survival with 4 players down to a winner, and matchmaking:
Challenge and Survival are separate queues (4 and 8 seats), and two Challenge
searchers meet and start by themselves.

**Border Run solo** (`/borderrun/solo`) has an edge-case check (about a minute per profile; run it on
`iphone-se` and `desktop` at least):

```bash
node .claude/skills/live-test/scripts/border-run.mjs [baseUrl] [profile]
```

It reads each route's answer from the saved game and the map data, then covers:
- refused guesses (unknown, off this map, the start, a repeat) cost nothing and say why;
- French names without accents, arrow keys + Enter on the suggestions, a double Enter;
- a reload or a Daily ↔ Endless round trip keeps the route, the guesses and the clock;
- finishing (with a penalty), New route, Show a route, Change, the best per map;
- the EN/FR switch, kept across a reload;
- the daily: a reload resumes it on the server's clock, the penalty is on the result,
  and a reload after finishing shows the finished page with its map.

It exits 1 on any failure or console error. Add a case here for every new interaction.

**Matchmaking** ("Matchmaking" button, `docs/matchmaking.md`) has its own check too (about
four minutes):

```bash
node .claude/skills/live-test/scripts/matchmaking.mjs [baseUrl] [screenshotDir]
```

A desktop player searches from the hub and waits alone, an iPhone player is matched
into the same room, and an Android player searching in French gets another room. The
English room counts down and starts by itself, then leaves the queue. A second French
player joins and presses Back: their seat goes at once and the countdown stops. The
French player leaves with "Leave room". In Word Scramble, two players each waiting
alone are merged into one room, which starts 1v1 with even teams. In Night Highway
(no language switch, one `any` queue), the second driver joins the first, the first
race starts by itself, and Back on the results gives up the seat.

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
