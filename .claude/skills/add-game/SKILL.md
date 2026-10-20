---
name: add-game
description: Step-by-step checklist for adding a new game to the Game Room platform - registry entry, state machine, components, page, database rules and their tests, and verification. Use when creating a new game, adding a new game slug, or wiring a game onto useGameSession or useSession. Also use (in reverse) when removing a game.
---

# Adding a game to Game Room

Every game shares the session layer (guest IDs, rooms, seats, presence; see the
root `CLAUDE.md`). A new game only adds its own pieces. Skipping step 4 is the
classic failure: the game works in local mode, then every write is refused on
Firebase.

## 1. Register it

Add a `GameEntry` to `GAMES` in `lib/games/registry.ts`:
- `slug` - becomes the route and the database key.
- `title`, `description`, `tags`.
- `maxPlayers` - only for a game that isn't 1v1.
- The card colors and fonts: `ink`, `textSecondary`, `accentColor`,
  `titleClassName`, `buttonTextClassName`.

Then draw the game's art panel in code under `components/gameRoom/` (like
`FtwArt.tsx`) and add it to `ART_BY_SLUG` in `components/hub/GameCard.tsx`. Also
add a 40px list tile for "Your rooms" and the Continue chip in
`components/gameRoom/GameTile.tsx` (without one, a game gets a generic tile in
its accent color).
The hub layout follows
`references/game-room/game-room-ui-spec.md`, and its flex-wrap row already handles
a 3rd+ card.

## 2. Write the game logic: `lib/games/<slug>/`

- A pure state machine in `game.ts`. Every transition takes the state and returns
  a new one; it **throws on an invalid move** (the store turns a throw into a safe
  no-op) and never mutates.
- The state type `extends WithIdentity` (`lib/session/types.ts`) for 1v1 games, or
  `WithMultiplayerIdentity` for 3+. The initial state includes `names: {}`. Seats
  and display names are handled by the session layer, not the game.
- **Plan for Realtime Database data shapes from day one:**
  - Empty arrays/objects are dropped on write, so normalize every array/object
    field on read (`value ?? []`), e.g. a `normalizeGame()` at the top of each
    transition.
  - Never write an explicit `undefined`. Clear an optional field by building a
    fresh object without it.
- Content that someone might hand-edit (prompts, cases) goes in one JSON file with
  a validator test (see `lib/games/ftw/prompts.json`,
  `lib/games/cocounsel/cases.json`).
- Vitest coverage for every transition and edge case (`*.test.ts` next to the
  code).

## 3. Write the UI: `components/<slug>/` and `app/<slug>/page.tsx`

- The page is a client component that calls the session hook once:
  ```ts
  const createInitialState = useCallback(() => newGame(...), []); // must be stable
  const session = useGameSession({ gameSlug: "<slug>", createInitialState });
  ```
  For a game with more than 2 players, use `useSession({ gameSlug, maxPlayers,
  minPlayers, createInitialState })` instead (`lib/session/useSession.ts`). It has
  `seats`, `joinedSeats`, `enoughJoined`, `isHost` and `moveToSeat`. `RolePicker`
  takes a `seats` list for N players; `Header` is 2-player only.
- **Handle the session states in this order** before any game screen:
  `session.connectionError` (show `CONNECTION_ERROR_MESSAGE`),
  `session.roomMissing` (`ROOM_MISSING_MESSAGE`), `!game` ("Connecting…"),
  `!me` (a seat picker), `!bothJoined` (`InviteLinkBanner`, passing
  `onRenameRoom={canRenameRoom ? setRoomName : undefined}` and
  `nameError={roomNameError}`).
- Apply game moves with `transact((s) => transition(s, ...))`. Reset with
  `setGame(newGame(...))`, which keeps everyone seated.
- Add `<InAppBrowserBanner />` at the top of the page, as both existing games do.
- Reuse `Header`, `Footer`, `RoleStickers` and `Button` where the look fits.
  Otherwise give the game its own components; visuals are per game.
- **Navigating into a room** from elsewhere must be a hard navigation (a plain
  `<a>` or `window.location`), not `router.push`/`next/link`.
- **Don't read `window`, `localStorage` or the clock during render.** Use effects,
  timer callbacks, or `useSyncExternalStore` with a server snapshot.

## 4. Add the database rules: `database.rules.json`

The rules are deny-by-default, so without these steps the game can't write
anything on Firebase. Use the `database-rules` skill for the edit, test and deploy
workflow.
1. Add the slug to `games/$room/meta/gameSlug`'s `.validate`.
   - If it's a 1v1 game, also add it to the `maxPlayers` check that forces 2.
   - Otherwise `maxPlayers` may be 2–8.
2. Add a `games/$room/<slug>` node with the same `.write` as `ftw`, swapping the
   slug: a member of the room, or the creating write.
3. Write its `.validate` rules from the TypeScript state type:
   - allowed keys only, with `"$other": { ".validate": false }` at every level;
   - a type for every field;
   - enums checked with `==`;
   - length caps on free text, matching the UI's limits;
   - array key ranges (arrays are stored as objects keyed `0..n`).
4. Add valid and invalid state tests to `tests/rules/gameState.test.ts`. Build the
   valid states by playing the real state machine, as the existing tests do.
5. **Data that changes many times a second** (positions in a real-time game) does
   not belong in the game state, where every write is a transaction both players
   contend over. Give it a sibling node that each seat writes only for itself, like
   Night Highway's `nighthighwayCars/{seat}` (see the `night-highway` skill).

## 5. Verify

- `npm run lint`, `npx tsc --noEmit`, `npm test`, `npm run test:rules`,
  `npm run build`.
- **Live**: use the `live-test` skill to play the game with two players against
  the emulators.
- **Deploy order**: ship the app first, then the rules.

## 6. Document it

- Check the todos (`todo` skill, `list --all`) for items this new game triggers.
  Do them, or tell the user they're now due.
- Tag new todos for the game with its slug (e.g. `--tag frontend,<slug>`).
- Create a `.claude/skills/<slug>/SKILL.md` reference for the game. Follow the
  `first-to-worst` or `co-counsel` skill: rules, files, state, page flow and
  gotchas.
- Add the game to the list of games in the root `CLAUDE.md` and in `README.md`
  ("The games").

## Removing a game

Reverse the steps:
- Delete `lib/games/<slug>/`, `components/<slug>/` and `app/<slug>/`.
- Remove the registry entry and the art.
- Remove the rules node, the slug from `meta/gameSlug`, and its rules tests.
- Remove its skill.

To only *hide* a game from the hub, set `hidden: true` on its registry entry. It
stays playable by link and keeps its name and tile in "Your rooms".
