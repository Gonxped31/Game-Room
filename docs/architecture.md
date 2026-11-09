# Partyfox reference: data model and environment notes

The data model, environment notes and the hub's components. The rules and code map live in the nested CLAUDE.md files (lib/session, lib/store, lib/games, components); the session's longer code map is `docs/session.md`.

## Room data model (`database.rules.json` is the source of truth)

```
games/{roomCode}/
  meta:       { gameSlug, maxPlayers, createdAt, createdBy, name?, nameKey?, publicLang? }  // write-once except name/nameKey (creator only); publicLang = a public (matchmade) room
  seats:      { p1: uid, ... }        members: { [uid]: "p1" }               // always written together
  players:    { p1: { name }, ... }   presence: { [uid]: { online, lastSeen } }
  lastActive: number                  ftw | cocounsel | nighthighway: { ...game state... }  // validated per game
  ftw/lang?: 'en' | 'fr'                                                 // Same Page's content language (absent = en); master sets it
  nighthighwayCars: { p1: {...}, p2: {...} }                                 // live cars, each seat writes its own
  buzzerquiz: { ...game state, buzzes included... }                         // Buzzer Quiz, maxPlayers 4
  wordscramble: { ...game state... }  wordscrambleTyping: { pN: { at } }     // Word Scramble, maxPlayers 8; each seat its own typing signal
  autoStart: number                                                         // public rooms only: when the game starts by itself (docs/matchmaking.md)
  activeMinutes: { n, at }                                                  // play time: +1 a minute while a game is in progress, at most one count per 50 s
  closedAt?: number                                                         // set only by /admin (firebase-admin); then only presence may change
queue/{slug}/{lang}/{roomCode}: { players, updatedAt }                     // matchmaking: waiting public rooms; listable per slug+lang
roomsByName/{nameKey}: roomCode                                             // unique, first come first served
users/{uid}/rooms/{roomCode}: { gameSlug, addedAt, createdByMe?, name? }
users/{uid}/visits/{yyyymmdd}/{roomCode}: { gameSlug, at }                 // seated in that room that UTC day; kept after "Leave room": the dashboard's player history
users/{uid}/firstTouch: { src, med?, cmp?, at }                            // where the guest first came from; written once by its owner (docs/tracking.md)
finished/games/{gameKey}: { slug, mode, players, lang, at, room?, matchmade? }  // one per finished game, created once; nobody reads finished/ but /admin
finished/players/{gameKey}_{uid}: { game, uid, src, cmp?, at }             // one per finishing guest, written by that guest
analytics/archive/{roomCode}: { gameSlug, createdAt, ..., guests }        // a deleted room's summary for /admin; no client reads or writes it
analytics/statsSince: <ms>                                                 // when /admin last cleared the stats: history before it isn't counted
```

## Environment notes

- **Local mode is per browser profile.** It never syncs across browsers or
  devices, and it shows a "Local mode" banner. **Restart `npm run dev` after
  changing `.env.local`**: a dev server started without the Firebase config
  silently runs in local mode, which looks exactly like a sync bug.
- **A Vercel build fails** (`next.config.ts`) if any Firebase var is missing, so a
  local-only app can never ship. Preview and production share one database unless
  Preview gets its own project's vars.
- **Anonymous sign-in needs no Firebase "Authorized domains" entry.** New Vercel
  preview URLs work as-is. Only an HTTP-referrer restriction on the API key would
  need `https://*.vercel.app/*`.
- **A dev server returning 500 with a Turbopack panic** means the dev cache is
  corrupted: stop dev servers and delete `.next/dev`.

## Hub components (`components/hub/`)

The rules for them (leaving, dialogs, room links) are in `components/CLAUDE.md`.

- Hub (`components/hub/`): `Hub` (header, Continue chip, Your rooms button
  or floating pill, mobile jump buttons, the Social folder with "Play from
  anywhere" and the yellow "Talk it out" panel, the Solo folder),
  `GameCard` (desktop card + compact mobile card, Start + Join, plus
  Matchmaking on matchmaking games; `SoloCard` with Play solo),
  `HubOverlay` (one shared popover on desktop / bottom sheet on mobile),
  `JoinPanel`, `MatchPanel` (Matchmaking: name, language, Find players),
  `YourRoomsList` (+ `HomeScreenTip`),
  `useSavedRooms`. Art (`HubArt`: 168px panel + 92px mini per game) and
  list tiles (`GameTile`) live in `components/gameRoom/`.
