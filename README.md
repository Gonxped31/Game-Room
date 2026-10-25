# Game Room

A small platform for private, link-based 2-player games. No login, no accounts, no
lobby.
- Pick a game from `/` and you get a fresh private room, with a "Copy invite link"
  button to send the other player. Opening someone else's link drops you straight
  into their room.
- The first time each of you opens a room you pick your seat (and, in First to
  Worst, type your name). After that, the game remembers who's who and exactly
  where you left off, even after closing the browser.
- Any number of pairs can play at once, across any of the games below, each room
  fully independent.

Behind the scenes, each browser gets an invisible **guest ID** (Firebase Anonymous
Auth; there is no sign-in screen). It holds your seat in each room and backs the
"Your rooms" list on the home page.

## The games

- **Same Page** (`/same-page`, formerly First to Worst at `/ftw`, which still
  redirects) - a ranking game. Each round has a prompt and exactly 5 items (e.g.
  "Pizza toppings": Pepperoni, Mushrooms, Pineapple, Anchovies, Jalapenos).
  - The **ranker** privately puts rank notes 1 (best) to 5 (worst) on the items.
  - The **guesser** tries to guess that order.
  - Both are revealed and scored, and roles swap every round.
- **Co-Counsel** (`/cocounsel`) - a cooperative mystery.
  - One player is the Investigator (external evidence), the other the Defendant
    (internal facts).
  - In each "Part" of a case, both secretly lock in one card, trying to find the
    matching pair while talking it out loud.
  - There are no live scores. How well you listened (Trust) and remembered (Focus)
    only shows up at the end of the case.
- **Night Highway** (`/nighthighway`) - a 60-second race down a 3D freeway after
  midnight.
  - Both players drive the same road at the same time, through identical traffic,
    and see each other as a ghost car.
  - Score is distance plus near-miss bonuses; the higher score wins the race.
  - The road curves, and bends push you outward. Before a race you can switch on
    **pickups** (nitro, a few seconds of driving through traffic, a one-crash
    shield) and **rain** (the car slides).
  - `/nighthighway/solo` is the original single-player game, no room needed.
- **Buzzer Quiz** (`/buzzerquiz`) - 2 to 4 players race to buzz in on
  multiple-choice questions, in English or French.
  - The host picks the topics and the length; everyone plays.
  - A wrong answer is struck out for everyone and its player is locked out, so the
    question gets easier but is worth less (3, 2, then 1 point).
- **Word Scramble** (`/wordscramble`) - two teams (1v1 to 4v4) take turns
  unscrambling a word against a 30-second clock, in English or French.
  - Anyone on the playing team can guess; the other team watches.
  - A word is worth its letters; each hint places a letter but costs a point.

See `CLAUDE.md` for the architecture and conventions. Each game's details, adding a
game, the database-rules workflow and live two-player testing are Claude Code skills
in `.claude/skills/`. The [system design diagram](https://claude.ai/artifact/7irnsMVYWNt9G1Qm4FzUF1)
gives a visual, layer-by-layer walkthrough of the architecture.

## How rooms work

- **Starting a room.** Tap **Start** on a game's card (or open a game with no
  `#code` in the URL) and a room is created for you; its code then appears in the
  address bar (`/same-page#k3m9pq`). Share the link, or the code.
- **Joining.** Open the link, or tap **Join** on a game's card and type the room's
  code or name. If it turns out to be a room of another game, it opens anyway.
- **Naming a room.** Whoever created it can give it a name from the invite screen.
  Names are unique: if one is taken, you'll see "That name is taken. Try another."
- **Your rooms.** The home page's **Your rooms** button (a floating pill on phones)
  lists the rooms your browser created or joined in the last 30 days, most recently
  active first, and **Continue** reopens the latest one.
- **Seats.** Each guest ID holds at most one seat per room, and seats survive "Reset
  game"/"Rematch". Anyone else with the link can watch the room, but can't change
  it.
- **Getting a seat back.** If you lose your guest ID (cleared site data, a different
  browser), the room shows your old seat as taken. You can take it back once it has
  been offline for 2 minutes.
- **Presence.** The green/gray dots show who's connected. A closed tab shows as
  offline within a few seconds.

## Quick start (local test mode)

No setup required. Without Firebase config, the app runs entirely in your browser's
`localStorage`, synced across tabs via the `storage` event. That's handy for
development, but not for playing with someone on another device. A small "Local
mode: not synced between devices" banner shows while it's active.

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) and pick a game; you'll land in a
new room. Copy the URL into a second tab (or use "Copy invite link") to play both
sides. In local mode each tab gets its own fake guest ID, so two tabs are two
players.

## Playing across devices (Firebase)

For two people on two devices, wire up a free Firebase project. The app switches to
it automatically once the env vars below are set, with no code changes, and every
game on the platform shares it.

1. Create a project at [the Firebase console](https://console.firebase.google.com/).
2. In the project, add a **Web app** (the `</>` icon on the project overview page) and
   copy the config it gives you.
3. Go to **Build > Realtime Database** and create a database (any region is fine).
4. Go to **Build > Authentication > Sign-in method** and enable **Anonymous**.
5. Deploy the database rules from `database.rules.json` (see
   [Database rules](#database-rules)).
6. Copy `.env.example` to `.env.local` and fill in the five values from step 2:

   ```bash
   cp .env.example .env.local
   ```

   | Variable | Where to find it |
   | --- | --- |
   | `NEXT_PUBLIC_FIREBASE_API_KEY` | Web app config: `apiKey` |
   | `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` | Web app config: `authDomain` |
   | `NEXT_PUBLIC_FIREBASE_DATABASE_URL` | Web app config: `databaseURL` (also on the Realtime Database page) |
   | `NEXT_PUBLIC_FIREBASE_PROJECT_ID` | Web app config: `projectId` |
   | `NEXT_PUBLIC_FIREBASE_APP_ID` | Web app config: `appId` |

7. Restart `npm run dev` (env vars are read when the server starts) and open the app.

All five are `NEXT_PUBLIC_*` because the Firebase web config isn't a secret: it's
meant to ship in client bundles, like every Firebase web app. `.env.local` is
git-ignored, so never commit it. Leave any of the five unset and the app falls back
to local test mode, except on Vercel, where the build fails instead (see
[Deploying to Vercel](#deploying-to-vercel)).

To test two players on one machine with Firebase, use a **normal window plus a
private window** (or two browsers). Every tab of one browser shares one guest ID,
and one guest ID holds one seat per room.

### Database rules

The rules live in `database.rules.json`. Deploy them with the Firebase CLI (it's a
dev dependency):

```bash
npx firebase deploy --only database --project <your-project-id>
```

Or paste the file's contents into **Realtime Database > Rules** in the console.

Everything is keyed on the guest ID (`auth.uid`):

```
games/{roomCode}/
  meta:       { gameSlug, maxPlayers, createdAt, createdBy, name?, nameKey? }  // write-once, except name/nameKey (creator only)
  seats:      { p1: uid, p2: uid, ... }      // who sits where
  members:    { [uid]: "p1" }                // reverse index: "is this uid in the room?" in one lookup
  players:    { p1: { name }, ... }          // display names
  presence:   { [uid]: { online, lastSeen } }
  lastActive: number
  activeMinutes: { n, at }                   // play time: minutes a game was in progress
  ftw | cocounsel | nighthighway: { ...game state... }  // one per room, validated field by field
  nighthighwayCars: { p1: {...}, p2: {...} }  // each racer's live car, 10x a second (own seat only)
roomsByName/{nameKey}: roomCode              // unique, first come first served
users/{uid}/rooms/{roomCode}: { gameSlug, addedAt, createdByMe?, name? }
users/{uid}/visits/{yyyymmdd}/{roomCode}: { gameSlug, at }  // in that room that UTC day; kept after "Leave room" (dashboard)
```

What the rules enforce:
- **Access**: any signed-in guest with a room's code can *read* it, but only the
  room's seated members can change it.
- **Seats**: a guest holds at most one seat per room, and `seats` and `members`
  always change together. A seat can be taken over only after its holder has been
  offline for 2 minutes. Seat numbers above `meta.maxPlayers` are refused.
- **Names and state**: room names are unique, and game state must match each
  game's shape.
- **Listing**: nobody can list `/games`, `/roomsByName` or another guest's
  `/users` entry.

The rules are covered by emulator tests in `tests/rules/` (`npm run test:rules`).
The header of `tests/rules/rooms.test.ts` has the checklist for adding a new game.

**Deploy the app before the rules.** When a rules change alters what clients may
write, the previous client's writes (room creation included) are refused until the
new app is live.

## Known limitations

These apply to every game on the platform:

- **No anti-cheat between the two players.** A seated player can read the whole
  room, including information that's only meant to be revealed later (like First to
  Worst's master ranking before the reveal), and can write any valid game state.
  These games assume you trust the person you're playing with. Outsiders with the
  link can watch a room but can't change it.
- **One seat per browser.** Every tab of one browser shares one guest ID. To play
  both sides on one machine, use a normal window plus a private window (or two
  browsers).
- **Clearing site data loses your guest ID**, and with it your seats and "Your
  rooms" list. You can take your old seat back once it has been offline for 2
  minutes.
  - Safari on iOS wipes a site's storage on its own after about 7 days without a
    visit. Apps added to the Home Screen are exempt, so the home page suggests
    adding Game Room there.
  - In-app browsers (Messenger, Instagram, WhatsApp, ...) keep their own separate
    storage, so room pages opened in one suggest switching to Safari or Chrome.
- **Previews share production's database** unless you give Vercel's Preview
  environment a different Firebase project.

Same Page has one additional quirk: a round's score is the count of items
where the ranker and guesser put the exact same note (1-5) - see
`lib/games/ftw/scoring.ts`. Because of how permutations work, a score of exactly 4 out
of 5 is mathematically impossible: if four cards land in their correct spot, the fifth
has nowhere else to go but its correct spot too. So you'll only ever see 0, 1, 2, 3, or
5. This is expected, not a bug - `lib/games/ftw/scoring.test.ts` checks it across all
120 permutations of 5 items.

## Deploying to Vercel

1. Push this repo to GitHub (or GitLab/Bitbucket).
2. Import it at [vercel.com/new](https://vercel.com/new).
3. In the Vercel project's **Settings > Environment Variables**, add the five
   `NEXT_PUBLIC_FIREBASE_*` variables from your `.env.local`, for both
   **Production** and **Preview**. A Vercel build with any of them missing or empty
   fails with a message naming them, rather than shipping an app that can't sync.
4. Deploy, then deploy the database rules (see [Database rules](#database-rules)),
   in that order.
5. Share `https://<your-app>.vercel.app/<game>#<room-code>` with the other player.

### The admin dashboard (`/admin`)

`/admin` is the owner's dashboard. It isn't linked from the hub, and it stays off
until you add two variables in Vercel, for **Production only**. Previews share the
production database, so leave both unset there.

- `ADMIN_PASSWORD`: a long random password. It's the only thing guarding `/admin`.
  Changing it signs every admin session out.
- `FIREBASE_SERVICE_ACCOUNT`: the whole JSON key, pasted as one value. Create it in
  Firebase console > Project settings > Service accounts > Generate new private key.
  It bypasses the database rules, so it must never be committed or given a
  `NEXT_PUBLIC_` name.

After redeploying, sign in at `/admin`. "Database connected." confirms that the key
works.

The "Rooms" list shows live rooms first. You can search it by name or code (a pasted
room link works too), and filter by status, game or how many people hold a seat.

Rooms are removed in two steps:
1. **Close** a live room. Everyone in it sees "This room was closed", and the room
   refuses any more play. To close several at once, tick them, or filter (say, one game
   with fewer than 2 players) and tick "Select all", which takes exactly the open rooms
   matching the filters. Then press "Close N rooms".
2. **Delete** it (set the Rooms status filter to "Closed"). The room and its name are removed, and a small
   summary is kept in `analytics/archive/{code}` so its numbers stay on the dashboard.
   Anyone who opens the old link gets a new, empty room. Closed rooms can be selected
   and deleted together too ("Delete N rooms").

**Clear all stats** (at the bottom of `/admin`, asks for the admin password again)
starts every number from zero. It records the time in `analytics/statsSince`, from which
the history is counted, and erases what only the stats use: deleted rooms' summaries
and guests' visit days. Rooms, live counts, the Rooms list and players' "Your rooms"
are untouched.

**Download a solo game** gives each solo game (Night Highway) as one HTML file that
plays offline: the game alone, no rooms or hub. `npm run build` makes the files first
(`scripts/export-solo.mjs`, into the git-ignored `public/downloads/`); locally, run
`npm run export:solo` once to get them.

**Preview URLs need no Firebase setup.** Firebase's *Authorized domains* list only
applies to OAuth redirect/popup and email-link sign-ins, not anonymous sign-in, so
each new preview URL works as-is. The one exception: if you restricted the Firebase
API key to specific websites in Google Cloud Console (APIs & Services >
Credentials), allow `https://*.vercel.app/*` there.

## Renaming

The platform's own name and each game's title are deliberately generic and hold no
logos, box art, or other assets from the commercial games some of them are inspired
by. To rename the platform itself, or any individual game:

```ts
// lib/games/registry.ts
export const APP_TITLE = "Game Room"; // the picker's title, the Home Screen app name

// lib/games/ftw/constants.ts
export const GAME_TITLE = "Same Page"; // the data slug stays "ftw"
```

A game's `GAME_TITLE` drives its own page title, header pill, and browser-tab "your
turn" indicator - nothing else needs to change.

## Development

```bash
npm run dev        # dev server at localhost:3000
npm run build      # production build (also type-checks)
npm run lint       # eslint
npm run test       # vitest: game logic, prompt bank, session update builders, presence
npm run test:rules # database.rules.json against the Firebase Database emulator (needs Java)
```

CI (`.github/workflows/ci.yml`) runs lint, a type-check, `npm test` and
`npm run test:rules` on pushes to `main` and on pull requests.

### Testing against the emulators

To try the full guest-ID and rules flow without touching a real Firebase project,
start the emulators, then point a dev server at them (shell env vars override
`.env.local`; stop any other `npm run dev` first, since Next allows one dev server
per project):

```bash
npx firebase emulators:start --only auth,database --project demo-game-room

# in another terminal:
NEXT_PUBLIC_FIREBASE_API_KEY=demo-key \
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=demo-game-room.firebaseapp.com \
NEXT_PUBLIC_FIREBASE_DATABASE_URL="http://127.0.0.1:9000/?ns=demo-game-room-default-rtdb" \
NEXT_PUBLIC_FIREBASE_PROJECT_ID=demo-game-room \
NEXT_PUBLIC_FIREBASE_APP_ID=demo-app \
NEXT_PUBLIC_FIREBASE_AUTH_EMULATOR_URL=http://127.0.0.1:9099 \
npm run dev
```

Open the app in a normal window and a private window to play both sides. If
`npm run test:rules` later reports "port taken", an emulator from this is still
running.

See `CLAUDE.md` for the project's architecture and conventions, and `.claude/skills/`
for task guides (each game, adding a game, database rules, UI review, live testing).
