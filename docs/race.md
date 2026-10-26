# Races: solo games played against others

Border Run and Checkmate Grid are solo games that can also be raced (the user's
design, 2026-10-26): everyone plays the same round at the same moment, round
after round. The race is one shared layer; each game plugs in what a round is
and how a player's moves score.

| Path | What |
| :--- | :--- |
| `lib/games/race/race.ts` | Modes, timing, `RaceCore` (the state every race has), `RunCore`, `RaceSpec` (what a game provides), `createRace(spec)` (the transitions: `start`, `endRound`, `next`, `standings`, ...) |
| `components/race/useRace.ts` | The room page's hook: session, everyone's runs, the round's end and the next round on the server clock, Start, matchmaking's auto-start |
| `components/race/Screens.tsx` | Join, lobby, a round's frame, results, final standings; the game fills the slots (settings, its board or map) |
| `components/race/race.css` | Their styles, from `--race-*` variables each game sets on its page (`.br-race`, `.cg-race`) |
| `lib/games/matchGames.ts` | `raceMatch`: each race's two queues |

## The rules of a race

- **Challenge**, 2-4 players: 3 or 5 rounds (matchmade: 3); the lowest total
  wins. A round's score is the finish time plus the game's penalty
  (`penaltyMs` per `extra`: Border Run's guesses past the par; Checkmate Grid
  has none). Not finishing counts as the slowest finish (at least the time
  limit) plus 30 s, so it never beats a finish (`roundPoints`).
- **Survival**, 4-8 players: after each round the slowest go out, **two while
  more than 4 are left, then one** (`knockouts`), until one is left.
  Unfinished ranks below every finish, by how far they got (`found`), then
  fewer penalties. A tie at the cut knocks out nobody in the tie. A game
  stops after `MAX_ROUNDS` (10) whatever happens, which the rules also cap.
- **Rounds**: a 4 s countdown (the round shows, nothing can be played yet),
  then the game's time limit (3 minutes in both). 12 s of results between
  rounds. Each game makes its rounds harder as they go.
- **Choosing the mode**: the hub's Start asks first (registry `modes`; the page
  reads `?mode=` on creating the room, then drops it from the link). A private
  room's host can change the mode and the settings in the lobby, and after a
  game ("Change mode or settings"). A private room has 8 seats; in Challenge
  only 4 can sit (`PLAYERS`), and Start says why it can't start. A matchmade
  room stays in its mode (the rules check it), with 4 seats for Challenge and
  8 for Survival.

## How it runs (no server)

- **State**: `games/{room}/{slug}` (`RaceCore` plus the game's settings and its
  round's content). **Runs**: `{slug}Runs/{seat}`, each seat writing only its
  own (`at` = the round's `startsAt`, moves timed in ms after it on the server
  clock, `gaveUp`). Keying by `startsAt`, not the round number, keeps a
  rematch from counting last game's moves.
- **Ending a round**: at `endsAt` (`useDeadline`), or as soon as everyone still
  in **and online** is done (`roundOver` with `present`), so a player who left
  doesn't hold it up. Any seated device transacts `endRound`, which replays
  everyone's run itself (`spec.score`) rather than trusting a written score.
  `next` after `nextAt`, its round drawn from a fresh seed inside the
  transaction.
- **During a round** everyone's progress shows as counts only ("2 of 4 found",
  "3 of 7 pieces"), never where; the results show any player's round (tap a
  row). A player out (or watching) sees "Leave room".
- **Public rooms**: `usePublicRoom` with the game's `raceMatch` queue; ready
  at 2 (Challenge) or 4 (Survival) online. See `docs/matchmaking.md`.

## Adding a race to a solo game

1. `lib/games/<slug>/race.ts`: the state (`RaceCore` + settings + the round's
   content), the run (`RunCore` + moves), `newRace(mode)`, `normalize`,
   `normalizeRun`, and `createRace({ roundMs, penaltyMs, lobby, normalize,
   roundContent, score })`. Tests next to it.
2. The rules: a `{slug}` node and `{slug}Runs/$seat`, the slug in
   `meta/gameSlug`, `maxPlayers` and `publicLang` like `borderrun` and
   `regions`. Tests in `tests/rules/gameState.test.ts` and
   `matchmaking.test.ts` (its `describe.each`).
3. `matchGames.ts`: `raceMatch(slug, newRace)`, and the slug in `MATCH_MODES`.
4. The registry: `section: "anywhere"`, `maxPlayers: 8`, `modes`, and `solo`
   for the solo page.
5. The page: `useRace`, the shared screens, and the game's own settings,
   round view and results view; the `--race-*` variables in its CSS.
6. A live test with 2 and 4 players, and matchmaking by mode.
