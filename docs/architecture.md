# Game Room reference: data model and environment notes

Moved out of CLAUDE.md to keep it short. The code map lives in nested CLAUDE.md files (lib/session, lib/store, lib/games, components).

## Room data model (`database.rules.json` is the source of truth)

```
games/{roomCode}/
  meta:       { gameSlug, maxPlayers, createdAt, createdBy, name?, nameKey?, publicLang? }  // write-once except name/nameKey (creator only); publicLang = a public (matchmade) room
  seats:      { p1: uid, ... }        members: { [uid]: "p1" }               // always written together
  players:    { p1: { name }, ... }   presence: { [uid]: { online, lastSeen } }
  lastActive: number                  ftw | cocounsel | nighthighway: { ...game state... }  // validated per game
  nighthighwayCars: { p1: {...}, p2: {...} }                                 // live cars, each seat writes its own
  buzzerquiz: { ...game state, buzzes included... }                         // Buzzer Quiz, maxPlayers 4
  wordscramble: { ...game state... }  wordscrambleTyping: { pN: { at } }     // Word Scramble, maxPlayers 8; each seat its own typing signal
  autoStart: number                                                         // public rooms only: when the game starts by itself (docs/matchmaking.md)
  activeMinutes: { n, at }                                                  // play time: +1 a minute while a game is in progress, at most one count per 50 s
  closedAt?: number                                                         // set only by /admin (firebase-admin); then only presence may change
queue/{slug}/{lang}/{roomCode}: { players, updatedAt }                     // matchmaking: waiting public rooms; listable per slug+lang
roomsByName/{nameKey}: roomCode                                             // unique, first come first served
users/{uid}/rooms/{roomCode}: { gameSlug, addedAt, createdByMe?, name? }
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
