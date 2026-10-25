# Matchmaking

Buzzer Quiz and Word Scramble can be played with strangers. On the hub, their cards
have a third button, **Matchmaking**: the player enters a display name, picks the
content language (EN/FR), and taps **Find players**. They land in a public room's
lobby, which starts by itself once enough players are online. First to Worst,
Co-Counsel and Night Highway stay private, link-shared games.

## Decisions (2026-10-24)

| Question | Decision |
| :--- | :--- |
| Who starts a game of strangers? | Nobody: **auto-start**. Fixed default settings, no host. |
| Language | **Separate EN and FR queues.** The panel defaults to the browser language. |
| Entry point | A third card button, "Matchmaking" (renamed from "Play online" the same day), opening a panel like Join. |

## Data model

```
games/{room}/meta/publicLang: "en" | "fr"      // set at creation = a public room; write-once like the rest of meta
games/{room}/autoStart: number                 // server ms; public rooms only, members only, at most 60 s ahead
queue/{slug}/{lang}/{room}: { players, updatedAt }   // the waiting public rooms
```

- `publicLang` is only accepted for `buzzerquiz` and `wordscramble`.
- `queue/{slug}/{lang}` can be **listed** by any signed-in guest (the whole point).
  `/queue` and `/queue/{slug}` cannot.
- A queue entry can be written by a member of the room, or by its creator in the
  creating update (when nobody is seated yet). It must match the room's
  `gameSlug` and `publicLang`.
- An entry can be deleted by a member, by anyone once the room is gone, or by anyone
  once it's **stale** (`updatedAt` over 60 s old). Searchers clear the stale entries
  they see, so the queue cleans itself without a server.

## How a search works (`lib/session/shared/findMatch.ts`)

There is no matchmaking server. The seat write itself is the lock.

1. Read `queue/{slug}/{lang}` once, with the server's clock.
2. `rankRooms`: fresh entries with fewer than `maxPlayers` online, fullest first.
3. For up to 5 of them, `tryJoinRoom`: read the room, check it's a public room of
   this game and language still in its `"lobby"` phase, then claim the first empty
   seat (or take over one whose holder has been offline for 2+ minutes) with the
   usual `claimSeatUpdate`. If the rules refuse it (someone got there first), try
   the next room.
4. If none worked, `createRoom({ publicLang })` (listed at once with `players: 0`),
   then take whichever seat is free. A searcher may have sat down first.
5. Hard-navigate to `/{slug}#{room}`. The player is already seated, so the game page
   opens on its lobby.

## How a public room runs (`lib/session/usePublicRoom.ts`)

Every seated device runs the hook. The **keeper** is the lowest *online* seat, so a
player who closes the tab hands the job on.

- **Queue entry**: while the game is in the lobby and fewer than `maxPlayers` are
  online, the keeper writes `{ players: online count, updatedAt }`. It writes on
  every change and at least every 20 s. Otherwise it removes the entry.
- **Auto-start** (`nextAutoStart`): when the game becomes ready, the keeper
  transacts `autoStart = now + 20 s`. When every seat is online it brings that
  forward to `now + 5 s` (never pushes it back). If the room stops being ready, the
  deadline is cleared. "Ready" is per game:
  - Buzzer Quiz: 2+ players online.
  - Word Scramble: an **even** number (2+) online.
- **Starting**: every device runs `useDeadline(autoStart)` and transacts the game's
  own `start`, which throws outside the lobby, so only the first commit counts.
  The game starts with the **online** seats (`startingSeats`). Word Scramble first
  evens out the teams with `balanceTeams`, which keeps everyone's pick where it fits.
- **Lone-player merge** (`betterRoom`): two people who search at the same instant
  can each create a room. Every 8 s, a player waiting alone checks the queue. They
  move to a waiting room with company, or to another lone room with a *lower* code
  (so exactly one of the two moves). They join the new room first, then leave the
  old one and unlist it.
- **Leave room** (lobby button): gives up the seat, unlists the room if it was the
  last player, and goes back to the hub.

Public lobbies hide the host's settings, Start, room naming and invite card. Buzzer
Quiz public rooms use every topic and 10 questions (`publicGame`). Word Scramble uses
its defaults (5 turns per team). After a game, players can Rematch as usual with
whoever is online. The room isn't listed again unless it goes back to the lobby
with seats to fill.

## Known limits

- A player who drops off just before the countdown ends (presence not yet offline)
  can be counted in the game. Their turns simply time out.
- Display names are free text, now seen by strangers. There's no moderation.
- Matching is first-come by room fullness: no skill, no regions.

## Tests

- `lib/session/shared/matchmaking.test.ts`: ranking, staleness, merge choice,
  auto-start timing.
- `tests/rules/matchmaking.test.ts`: `publicLang`, the queue, `autoStart`.
- `.claude/skills/live-test/scripts/matchmaking.mjs`: the full flow on real device
  profiles (search, join, languages, auto-start, Leave, merge).
