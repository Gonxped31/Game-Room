# Adding a game: field-by-field detail

The detail behind the `add-game` checklist's steps 1, 3, 3b and 4, and removing a game (`SKILL.md`, next to this file).

## Step 1: the registry entry and the art

Add a `GameEntry` to `ALL_GAMES` in `lib/games/registry.ts`:
- `slug` - becomes the route and the database key. `path` only if the route
  must differ (Same Page: `/same-page`, slug `ftw`); links go through
  `roomHref`/`gamePath`.
- `section` - the hub folder: `"anywhere"` (the game shows everyone what's
  happening) or `"talk"` (needs a call or the same room). `solo` too if it
  has a solo page (adds a Play solo card to the Solo folder). A solo game also
  needs `exports/<slug>/` (`index.html` + `main.tsx`, like Night Highway's): the
  offline HTML file /admin offers for download. A test fails without it.
  A **solo-only** game (no rooms, like Rank & File) uses `section: "solo"`
  plus `solo`, and skips steps 2's state machine rules, 3's session hook and
  4 entirely. A daily puzzle: `docs/daily.md`.
- `title`, `description` (3 lines at 300px), `shortDescription` (2 lines on
  the mobile card), `tags` (the first, the player count, is the mobile chip).
- `maxPlayers` - only for a game that isn't 1v1.
- The card colors and fonts: `ink`, `textSecondary`, `accentColor`
  (`continueColor` if the Continue square differs), `titleClassName`,
  `bodyClassName`. Check the Start fill against the ink at 4.5:1.

Then draw the game's art in code in `components/gameRoom/HubArt.tsx`: a
280x168 panel and a 92px mini, added to its `ART` lookup. Also add a 40px list
tile for "Your rooms" in `components/gameRoom/GameTile.tsx` (without one, a
game gets a generic tile in its accent color).
The hub layout follows `references/game-room/game-room-ui-spec.md` ("Adding a
game"); the folder counts and card rows follow the registry on their own.

## Step 3: the page's session hook and How to play

- The page is a client component that calls the session hook once:
  ```ts
  const createInitialState = useCallback(() => newGame(...), []); // must be stable
  const session = useGameSession({ gameSlug: "<slug>", createInitialState });
  ```
  For a game with more than 2 players, use `useSession({ gameSlug, maxPlayers,
  minPlayers, createInitialState })` instead (`lib/session/useSession.ts`). It has
  `seats`, `joinedSeats`, `enoughJoined`, `isHost` and `moveToSeat`. `RolePicker`
  takes a `seats` list for N players; `Header` is 2-player only.
- **Write its How to play**: `components/<slug>/Rules.tsx`, the full rules on
  the shared `components/HowToPlay.tsx` dialog, opened from a **?** in the
  game's header on every screen and a "How to play" button in its lobby or
  setup screen. What it must say, in what order, and how it looks:
  `docs/how-to-play.md`. A test (`lib/games/howToPlay.test.ts`) fails without
  it.
- Reuse `Header`, `Footer`, `RoleStickers` and `Button` where the look fits.
  Otherwise give the game its own components; visuals are per game.

## Step 3b: the French side (`docs/i18n.md`)

- **Words**: `components/<slug>/text.ts` exports `texts({ en, fr })` (French must
  match English key for key); components read `useText(TEXT)`, pure helpers and
  server code `TEXT[lang]`. Numbers and names are functions; plurals through
  `plural(lang, ...)`. Links through `useLocalHref`/`gamePath(slug, lang)`, so a
  French page never links to an English one.
- **Pages**: `app/fr/<slug>/page.tsx` re-exports `app/<slug>/page.tsx`;
  `app/fr/<slug>/layout.tsx` re-exports the layout with French metadata
  (`pageMetadata(route, "fr")`). Same for a solo page and for a room game's
  `invite/` route. Each page also has an `opengraph-image.tsx` and its copy in
  `lib/seo/previews.ts`: `docs/link-previews.md`.
- **Registry**: the entry's `fr` (description, short description, tags, modes,
  solo card); `lib/games/registry.test.ts` checks it. Titles are brands and stay.
- **Content**: both banks share their keys and ids, with a parity test. A room
  game stores the content language as `lang` (`'en' | 'fr'`, optional where
  older rooms lack it: absent means English), validated in the rules, set by the
  host; interface words follow each viewer's page language instead.
- **Finished games**: `useReportFinished({ slug, mode, players, lang, room?, id })`
  on every seated device at the real end (`lib/tracking/useReportFinished.ts`,
  `docs/tracking.md`). `id` is the same on every device and changes with each
  match (letters, digits and `-`).

## Step 4: the database rules

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

## Removing a game

Reverse the steps: delete `lib/games/<slug>/`, `components/<slug>/` (its How to
play with it) and `app/<slug>/`; remove the registry entry and the art; the rules
node, the slug from `meta/gameSlug`, and its rules tests; and its skill. To only
*hide* it from the hub, set `hidden: true` on its registry entry: it stays playable
by link and keeps its name and tile in "Your rooms".
