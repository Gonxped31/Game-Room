# Game Room

A small platform for private, link-based 2-player games. No login, no accounts, no
lobby - open the app and pick a game from `/`, and you get a fresh private room with
a "Copy invite link" button to send the other player. Opening someone else's link drops
you straight into their room. The first time each of you opens a room you type your
name; after that, the game remembers who's who and exactly where you left off, even
after closing the browser or restarting your computer - because the whole session
lives in the shared room, not on your device. Any number of pairs can play at once,
across any of the games below, each room fully independent.

## The games

- **First to Worst** (`/ftw`) - a ranking game. One round: a prompt and exactly 5
  topic cards (e.g. "Pizza toppings": Pepperoni, Mushrooms, Pineapple, Anchovies,
  Jalapenos). The **master** privately ranks the topics 1 (best) to 5 (worst); the
  **guesser** tries to guess that ranking; both are revealed and scored. Roles swap
  every round.
- **Co-Counsel** (`/cocounsel`) - a cooperative mystery. One player is the
  Investigator (external evidence), the other the Defendant (internal facts); each
  "Part" of a case, both secretly lock in one card, trying to find the matching
  pair while talking it out loud. No live scores - how well you listened (Trust)
  and remembered (Focus) only shows up at the end of the case.

See `CLAUDE.md` for the full architecture, each game's rules in detail, and how to
add a new one.

## Quick start (local test mode)

No setup required. This runs entirely in `localStorage`, synced across tabs on one
machine via the `storage` event - handy for development, not for playing with someone
on a different device.

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000), pick a game - it'll drop you into
a random `#room` code on that game's route. Copy that URL into a second tab (or use
"Copy invite link" in-app) and name yourselves differently in each tab to play both
sides.

## Playing across devices (Firebase)

For two different people on two different devices, wire up a free Firebase Realtime
Database. The app automatically switches to it once the env vars below are set - no
code changes needed, and it's shared by every game on the platform.

1. Create a project at [the Firebase console](https://console.firebase.google.com/).
2. In the project, add a **Web app** (the `</>` icon on the project overview page) and
   copy the config it gives you.
3. Still in the console, go to **Build > Realtime Database** and create a database
   (any region is fine).
4. Open the **Rules** tab for that database and paste in the rules from
   [Database rules](#database-rules) below, then publish.
5. Copy `.env.example` to `.env.local` and fill in the five values from step 2:

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

6. `npm run dev` and open the app - share the URL (with your `#room` hash) with the
   other player.

All five are `NEXT_PUBLIC_*` because the Firebase web config isn't a secret - it's
meant to ship in client bundles, same as every Firebase web app. `.env.local` is
git-ignored; never commit it. Leave any of the five unset and the app falls back to
local test mode automatically.

### Database rules

These games have no accounts, so there's no user identity to check - the only thing
rules can reasonably scope access to is the room path itself:

```json
{
  "rules": {
    "games": {
      "$roomId": {
        ".read": true,
        ".write": true
      }
    }
  }
}
```

This denies everything outside `/games/<roomId>` by default (Realtime Database rules
don't cascade upward), and allows read/write to a specific room to anyone who has that
room's URL. Every game on the platform nests its own state *under* its room's path
(`games/<roomId>/<gameSlug>`), so this single rule already covers every game - adding
a new one needs no console changes. See the limitation below for what that single
rule means in practice.

## Known limitations

These apply to every game on the platform:

- **No auth, no anti-cheat.** Anyone with your room's URL (`/<game>#roomname`) can
  read or write that room's state - including seeing information that's only meant to
  be revealed later, like First to Worst's master ranking before the reveal - or
  overwriting the game. The room name is a shared secret, not a real access control.
  These games are built on the assumption that you trust the person you're playing
  with; none of them are designed to resist a motivated cheater.
- **"Which one am I" is remembered per-tab, not per-room.** Two tabs in the same
  browser share one `localStorage`, so that specific fact - not the player's name,
  which lives in the shared room state - is deliberately *not* synced across tabs
  (`lib/store/localStore.ts`'s `crossTab: false` option) - otherwise picking a name in
  one tab would silently reassign the other tab's identity too. If a device loses that
  memory (new device, cleared storage), it just asks "Welcome back! Which one are
  you?" with the two names already on the room - no retyping, no lost progress. In
  normal use (two different people, two different devices) this doesn't come up at
  all.

First to Worst has one additional quirk: a round's score is the count of topic cards
where the master and guesser assigned the exact same number (1-5) - see
`lib/games/ftw/scoring.ts`. Because of how permutations work, a score of exactly 4 out
of 5 is mathematically impossible: if four cards land in their correct spot, the fifth
has nowhere else to go but its correct spot too. So you'll only ever see 0, 1, 2, 3, or
5. This is expected, not a bug - `lib/games/ftw/scoring.test.ts` checks it across all
120 permutations of 5 items.

## Deploying to Vercel

1. Push this repo to GitHub (or GitLab/Bitbucket).
2. Import it at [vercel.com/new](https://vercel.com/new).
3. Add the five `NEXT_PUBLIC_FIREBASE_*` environment variables from your `.env.local`
   in the Vercel project's **Settings > Environment Variables** (skip this to ship in
   local-only mode, which won't work for two separate players).
4. Deploy. Share `https://<your-app>.vercel.app/<game>#your-room-name` with the other
   player.

## Renaming

The platform's own name and each game's title are deliberately generic and hold no
logos, box art, or other assets from the commercial games some of them are inspired
by. To rename the platform itself, or any individual game:

```ts
// lib/games/registry.ts
export const APP_TITLE = "Game Room"; // the picker's title

// lib/games/ftw/constants.ts
export const GAME_TITLE = "First to Worst"; // change this
```

A game's `GAME_TITLE` drives its own page title, header pill, and browser-tab "your
turn" indicator - nothing else needs to change.

## Development

```bash
npm run dev      # dev server at localhost:3000
npm run build    # production build (also type-checks)
npm run lint     # eslint
npm run test     # vitest (lib/**/*.test.ts - scoring, state transitions, prompt bank)
```

See `CLAUDE.md` for the project's architecture, conventions, and stage-by-stage build
history.
