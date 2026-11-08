# Database rules: the model in one screen

What every node in `database.rules.json` allows (the `database-rules` skill's `SKILL.md`, next to this file, has the workflow).

```
games/{roomCode}/
  meta        write-once, except name/nameKey (creator only); gameSlug + maxPlayers required
  seats       { pN: uid }      -- always written together with members, in ONE update
  members     { uid: "pN" }    -- reverse index: "is this uid in the room?" in one lookup
  players     { pN: { name } } -- only the seat's holder writes it
  presence    { uid: { online, lastSeen } } -- own entry only, members only
  lastActive  members only
  activeMinutes { n, at }      -- play time: members only, n +1 with at == now, refused within 50 s of the last count
  ftw | cocounsel | nighthighway -- members of a room of that gameSlug (or the creating write); fully .validate'd
  nighthighwayCars/{pN}        -- Night Highway's live cars: only the uid seated in pN writes it
  buzzerquiz                   -- Buzzer Quiz (maxPlayers must be 4): the whole game, buzzes included
  wordscramble, wordscrambleTyping/{pN} -- Word Scramble (maxPlayers must be 8); each seat's own typing signal
  borderrun, borderrunRuns/{pN} -- Detour's races (maxPlayers 8, or 4 for a public Challenge); each seat's own guesses
  lasthop                      -- Last Hop (maxPlayers must be 2): the whole match, board as a cells string; a public room's mode == its queue while in the lobby; votes and pawns per seat
  regions, regionsRuns/{pN}     -- Rank & File's races (same seats); each seat's own moves, appended one by one
  meta/publicLang, autoStart   -- public (matchmade) rooms: a language (buzzerquiz/wordscramble), `any` (nighthighway) or a mode (borderrun/regions: challenge/survival; lasthop: track/grid); autoStart members only (docs/matchmaking.md)
queue/{slug}/{lang}/{room}     -- matchmaking queue: listable per slug+lang; members write; anyone deletes a stale (60 s) entry
  closedAt    no client writes it (/admin sets it via firebase-admin); once set, every node's .validate
              refuses changes except presence, so guests can still go offline
roomsByName/{nameKey}: code    -- unique; only the room's creator can claim or delete it
users/{uid}/rooms/{code}       -- only that uid reads or writes; fixed fields
users/{uid}/visits/{day}/{code} -- own only, while seated in that room: { gameSlug (the room's), at (server time, last 48 h) }
analytics/archive/{code}       -- deleted rooms' summaries, written by /admin (firebase-admin); no rule, so clients are refused
analytics/statsSince           -- when /admin last cleared the stats; same: admin only
```
