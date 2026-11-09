# Live test: what each check covers, and when the launcher fails

The detail behind the `live-test` skill's `SKILL.md` (next to this file). Every script is in `scripts/`.

## When the launcher or dev server fails

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

## The standard two-player check (`two-players.mjs`)

It covers:
- FTW: an iPhone creates a room and names it, and a desktop player joins by name
  from the hub. They play a full round.
- Presence: the other side shows as offline within a few seconds of closing.
- A third guest is read-only.
- "Your rooms" lists the room, also after a reload.
- Co-Counsel: auto-assign, and the "Switch role instead" seat swap.

It exits non-zero on failure and prints browser console errors. Zero console
errors is part of passing.

## Each game's own check

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
in the lobby only the host can switch the mode (to Grid and back); each player
picks a pawn (the other's is
taken); How to play opens from the header and the
lobby and closes; nothing can be picked during "Get ready" or by
the waiting player; a reload mid-round keeps the board; Leave room asks first;
a round lost on time (the clock is cut through the emulator); the pair's
second round on the same board with sides swapped; the match's end, also after
a reload. The guest only plays: only the host starts, switches the next match
to Grid, plays again (a clean score, a Grid round) and resets (Reset keeps
Grid). Then matchmaking: two strangers search Track, land in one room, the
match starts by itself; after it they vote (a split vote waits; agreeing on
"Change to Grid" starts a Grid match); one leaves mid-match and the other is
offered "Find another player".

**Rank & File's races** (`/regions/race`) have their own check (about four minutes):

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

**Rank & File** (solo, `/regions`) has an edge-case check (about two minutes per
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

**Detour's races** (`/borderrun`) have their own check (about four minutes):

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

**Detour solo** (`/borderrun/solo`) has an edge-case check (about a minute per profile; run it on
`iphone-se` and `desktop` at least):

```bash
node .claude/skills/live-test/scripts/border-run.mjs [baseUrl] [profile]
```

It reads each route's answer from the saved game and the map data, then covers:
- refused guesses (unknown, off this map, the start, a repeat) cost nothing and say why;
- French names without accents, arrow keys + Enter on the suggestions, a double Enter;
- a reload or a Daily ↔ Endless round trip keeps the route, the guesses and the clock;
- finishing (with a penalty), New route, Show a route, Change, the best per map;
- names in French on `/fr/borderrun/solo` (the same route), in English again on `/borderrun/solo`;
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
