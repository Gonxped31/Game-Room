---
name: add-game
description: Checklist for adding a game to Partyfox - registry, state machine, bilingual UI, database rules and tests, verification. Use when creating, removing or hiding a game, or wiring useGameSession/useSession.
---

# Adding a game to Partyfox

Every game shares the session layer (guest IDs, rooms, seats, presence; see the
root `CLAUDE.md`). A new game only adds its own pieces. Skipping step 4 is the
classic failure: the game works in local mode, then every write is refused on
Firebase.

`reference.md` (next to this file): every registry field and the art, the session hook call, How to play, the French pages, the five rules steps, and removing a game.

## 1. Register it

- A `GameEntry` in `ALL_GAMES` (`lib/games/registry.ts`): `slug` (the route and
  the database key; `path` only if the route differs), `section`, `title`,
  descriptions, `tags`, `maxPlayers` (only if not 1v1), card colors and fonts.
- Its art in `components/gameRoom/HubArt.tsx` and its "Your rooms" tile in
  `components/gameRoom/GameTile.tsx`.
- A solo game also needs `exports/<slug>/` (a test fails without it). A
  **solo-only** game (no rooms, like Rank & File) skips step 2's state machine
  rules, step 3's session hook and step 4 entirely. A daily puzzle: `docs/daily.md`.

## 2. Write the game logic: `lib/games/<slug>/`

- A pure state machine in `game.ts`. Every transition takes the state and returns
  a new one; it **throws on an invalid move** (the store turns a throw into a safe
  no-op) and never mutates.
- The state holds only the game: seats and display names live in the room
  (`seats`, `players`) and come from the session layer (`me`, `names`).
- **Realtime Database shapes**: empty arrays/objects are dropped on write, so
  normalize them on read (`value ?? []`, a `normalizeGame()` in each transition).
  Never write `undefined`: clear a field by building a fresh object without it.
- Hand-editable content (prompts, cases) goes in a JSON file per language with a
  validator test (`lib/games/ftw/prompts.json` + `prompts.fr.json`).
- Vitest coverage for every transition and edge case (`*.test.ts` next to the code).

## 3. Write the UI: `components/<slug>/` and `app/<slug>/page.tsx`

- The page is a client component that calls `useGameSession` (1v1) or
  `useSession` (more than 2 players) once, with a stable `createInitialState`.
- **Handle the session states in this order** before any game screen:
  `session.connectionError` (show `CONNECTION_ERROR_TEXT[lang]`),
  `session.roomMissing` (`ROOM_TEXT[lang].missing`), `!game` ("Connecting…"),
  `!me` (a seat picker), `!bothJoined` (`InviteLinkBanner`, passing
  `onRenameRoom={canRenameRoom ? setRoomName : undefined}` and
  `nameError={roomNameError}`).
- Apply game moves with `transact((s) => transition(s, ...))`. Reset with
  `setGame(newGame(...))`, which keeps everyone seated.
- Add `<InAppBrowserBanner />` at the top of the page, as the other games do.
- **Write its How to play** (`components/<slug>/Rules.tsx`, `docs/how-to-play.md`);
  `lib/games/howToPlay.test.ts` fails without it.
- **No back link to the hub in a room**: its way out is "Leave room" (`leaveToHub`,
  or `usePublicRoom`'s `leave`); see `components/CLAUDE.md`.
- **Report the finish**: `useReportFinished(game)` once the game reaches its
  real end (result, solved, won or lost; never on abandon): `docs/tracking.md`.

## 3b. Bilingual from day one (`docs/i18n.md`)

- Every word in `components/<slug>/text.ts` with `texts({ en, fr })`, read with
  `useText`. None in JSX, labels or canvases; How to play in both languages.
- A French twin for each page and layout (`app/fr/<slug>/...`, one-line
  re-exports; `lib/i18n/lang.test.ts` fails without them).
- A room game: an `/invite` route and its twin. Every page: its preview copy
  in `lib/seo/` (`docs/link-previews.md`).
- The registry entry's `fr` words (read through `gameText`).
- Content in both languages (step 2). A room game keeps its content language as
  `lang` in its state (and its rules), defaulting to the creator's language.

## 4. Add the database rules: `database.rules.json`

Deny-by-default, so without them the game can't write on Firebase (`database-rules`
skill for edit, test, deploy): the slug in `meta/gameSlug`'s `.validate`, a
`games/$room/<slug>` node with `ftw`'s `.write`, `.validate` rules from the state
type, valid and invalid state tests, and a per-seat sibling node for data that
changes many times a second. The five steps: `reference.md`.

## 5. Verify

- `node scripts/check.mjs --rules`, `./scripts/build`; `ui-review` at `/` and `/fr`.
- **Live**: the `live-test` skill, two players against the emulators.
- **Deploy order**: a new game's rules only add, so they go first, then the
  app (`database-rules` skill).

## 6. Document it

- Tag the todos it triggers with its slug (`--tag frontend,<slug>`).
- Create a `.claude/skills/<slug>/SKILL.md` reference for the game (≤100 lines,
  longer reference in files next to it; `agent-setup` skill). Follow the
  `first-to-worst` or `co-counsel` skill: rules, files, state, page flow and
  gotchas. Point it at the game's `Rules.tsx`, which changes with the rules.
- Add the game to the list of games in the root `CLAUDE.md`, `ARCHITECTURE.md`
  ("Games") and `README.md` ("The games").

## Removing or hiding a game

Reverse the steps, or only hide it from the hub with `hidden: true`: `reference.md`.
