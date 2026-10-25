---
name: first-to-worst
description: Reference for working on Same Page (formerly First to Worst, slug ftw), the 2-player ranking game - its rules, state machine, prompt bank, UI structure and gotchas. Use whenever changing or debugging anything under lib/games/ftw/, components/ftw/ or app/same-page/, editing prompts.json, or answering questions about how Same Page plays.
---

# Same Page (formerly First to Worst)

A private 2-player ranking game. Each round has a prompt and exactly 5 items.
The **ranker** (`master` in the code) privately puts rank notes 1 (best) to 5
(worst) on them, the **guesser** tries to match that order, and both are revealed
and scored. Roles swap every round.

- **Source of truth for UI, copy and motion**: `references/ftw/first-to-worst-game-design.md`
  (the "Same Page: Visual Spec": a notebook on a lilac desk, sticky-note ranks).
- `references/ftw/first-to-worst.html` is the original First to Worst prototype,
  superseded wherever the spec differs.
- **Names**: the UI says Same Page everywhere (`GAME_TITLE`), but the data slug
  stays `ftw` (`meta.gameSlug`, `games/{room}/ftw`, the rules, saved rooms). The
  route is `/same-page` (registry `path`); `next.config.ts` redirects `/ftw`, and
  browsers keep the `#code` across the redirect.

## Files

- `lib/games/ftw/game.ts` - the pure state machine: `newGame`, `lockIn`
  (RANKING → GUESSING), `submitGuess` (GUESSING → REVEALED, scores and appends to
  `history`), `nextRound`, `setPrompt`. Each throws on an invalid transition and
  never mutates. `masterOf(round)`/`guesserOf(round)` rotate p1/p2.
- `lib/games/ftw/scoring.ts` - per-card exact match, not similarity. **A score of 4
  is mathematically impossible** (if four cards match, so does the fifth), and the
  tests check all 120 permutations. Expected, not a bug.
- `lib/games/ftw/prompts.ts` + `prompts.json` - the prompt bank, plus
  `TOPICS`, `randomRound(usedPrompts, topics)` and `customRound(prompt, items)`.
- `lib/games/ftw/constants.ts`:
  - `GAME_TITLE` - the only place the title lives.
  - `ITEMS_PER_ROUND` - **the only place "5" is encoded; never hardcode it**.
  - `MAX_PROMPT_LENGTH` (120) / `MAX_ITEM_LENGTH` (60).
- `lib/games/ftw/placement.ts` - the local note placement while ranking or
  guessing: `tapItem`, `tapHandNote`, `placeNote` (hand note replaces, sheet note
  moves or swaps), `rankOrder`, and `resultHeadline` (the reveal's copy). Tested.
- `components/ftw/`:
  - `ui.tsx` - `THEME` (the spec's tokens as CSS variables on the page root),
    `NOTE_COLORS`, player colors, fonts, `StickyNote`, `PrimaryButton`, icons.
  - `RoundBoard` - `Placing` (sheet rows, hand, lock button), `Waiting`, `Reveal`,
    laid out by `Frame`; `Sheet` (lined paper); `Scoreboard` (`GameHeader`
    with score chips, the desktop `ScoreCard`, the `Wordmark`).
  - `CustomPromptForm`, `TopicPicker`, `SessionRecap`.
- `app/same-page/page.tsx` - wires `useGameSession({ gameSlug: "ftw" })` to all
  of the above.

## State and Firebase

- `GameState` contains `round`, `totals{p1,p2}`, `current{prompt, items[5],
  status, masterOrder?, guessOrder?, score?, placed?}`, `usedPrompts[]`,
  `history[]` and `topics?[]`.
- **Topics** (`topics`, written by `setTopics`): the prompt-bank categories the
  players want prompts from. **Only the round's master changes it** (`setTopics`
  throws for anyone else, so the role swap hands it over each round), in
  `TopicPicker` under the board; the guesser sees the choice read-only. It applies
  from the next prompt (Shuffle,
  Next round, Reset game). Absent means every topic: `setTopics` stores no field
  for none or all, and `nextRound`/`newGame` carry it over. Validated by the rules
  (strings ≤ 60, at most 99 entries).
- **Live placement progress** (`current.placed`, written by `setPlaced`): the IDs
  of the slots the player whose turn it is has filled so far - **never the
  numbers**, because the other player can read the room. The waiting guesser
  sees face-down (striped, numberless) notes pop in on those rows; both see "N of
  5 placed". `RoundBoard` reports
  changes; `setPlaced(game, phase, ids)` refuses a placement from a phase that
  already ended, and `lockIn`/`submitGuess` drop the field.
  It also carries `names: {}`, which `WithIdentity` requires but the session layer
  doesn't use (names live in the room's `players` node).
- **Its shape is validated by `database.rules.json`** (the `ftw` node).
  - If you add or rename a field, update the rules **and** the cases in
    `tests/rules/gameState.test.ts`, then run `npm run test:rules`. Otherwise the
    database refuses the new state.
  - Free-text caps must match the rules' caps.
- **RTDB drops empty arrays**, so `usedPrompts`/`history` can read back as
  `undefined`. Always read them as `value ?? []` (see `addUsedPrompt`).
- **Never write an explicit `undefined`.** Clear an optional field by building a
  fresh object without it.

## Prompt bank (`prompts.json`)

- The shape is `{ "Category": [{ "prompt": "...", "items": ["5 items"] }, ...] }`.
  Adding a prompt means adding an entry to its category's array; file order
  doesn't matter.
- `prompts.ts` flattens the JSON and interleaves categories with
  `interleaveByGroup()`, so no more than 2 consecutive prompts share a category.
  This is enforced by code, not by file order. **The categories are the topics
  players pick** (`TOPICS`, in file order), so a category's name is user-facing
  and must stay ≤ 60 characters; renaming one drops it from rooms that chose it
  (`setTopics` refuses unknown names, `randomRound` falls back to every topic).
- `npm test` (`prompts.test.ts`) checks:
  - exactly `ITEMS_PER_ROUND` unique items per prompt;
  - no duplicate prompt text;
  - the interleave rule;
  - every prompt and item within the length caps.
- **Content conventions:**
  - Aim for 30+ entries per category.
  - Trivia-style categories (Geography, Space, History) stay factual.
  - Anime & Manga and Pokémon are "pick your favorite from this list" prompts,
    about real series and games only.
- **No repeats in a session**: `usedPrompts` records every prompt seen (shuffled,
  custom or played). `randomRound` excludes all of them until every prompt of the
  chosen topics (or the whole bank) has come up, then cycles within them while
  still avoiding the most recent prompt.

## Seats and players (current behavior)

- The first player types a name and takes the first free seat; the second takes
  the other. Names live in the room's `players` node, keyed by seat, so they
  survive closing the browser.
- When both seats are held by other guest IDs (a device that lost its guest ID,
  or a third person), `RolePicker` shows "X is playing". It shows "Take this seat"
  only once that player has been offline for 2 minutes.
- **"Reset game"** (`setGame(newGame(...))`) restarts the game only; both players
  stay seated.
- **Player colors**: the room's creator is yellow, the other player pink
  (`hostSeat` from `useGameSession`; p1 is yellow if the creator holds no seat).
  Phones show a score chip per player in the header (viewer first, ringed); from
  900px the aside shows a `ScoreCard` instead.
- Presence shows in the waiting line: "{partner} can play later." while the
  other player is offline.

## Page flow (`app/same-page/page.tsx`)

The page renders the first state that applies:
1. `connectionError` or `roomMissing` → message.
2. `!game` → "Connecting…".
3. `!me` → `RolePicker`.
4. `!bothJoined` → `InviteLinkBanner` (name field only when `canRenameRoom`).
5. Otherwise → `RoundBoard` (with `TopicPicker` and `SessionRecap` as its `extras`).

`RoundBoard` picks `Reveal` once REVEALED, `Placing` on this player's move,
`Waiting` otherwise (the ranker after locking, read-only notes; the guesser while
the ranker ranks).

The board is withheld until both players have joined.

**Leaving:** the Footer's "Leave room" is on every screen, and the REVEALED
dock has one under "Next round". It asks first once both are seated
(`LeaveDialog`, the app's own modal), gives up the seat and goes to `/`. Only the error and
unknown-room notices get the plain "All games" link instead.

## UI gotchas

- **Layout**: one column under 900px (banner, sheet, the hand + button dock,
  extras). From 900px `Frame` is a grid: an aside (300-380px: score card, banner,
  dock, extras) beside the sheet (up to 720px), via `grid-template-areas`, so the
  DOM order stays the phone order.
- **The dock is `sticky`, not `fixed`**, on phones while placing: the hand and
  the lock button stay reachable on short screens without the old fixed bar's
  clearance padding.
- **Tap targets**: only the placing player's rows are buttons; the waiting and
  reveal sheets are plain lists. A past bug let a tap on the *other* player's
  empty slot consume your selected card.
- **Tap, keyboard, drag**: tap a hand note then an item; tapping a placed note
  returns it to the hand, or once the hand is empty picks it up for a swap.
  Number keys 1-5 place that note on the focused item; Escape drops a pick.
  Drag is built on Pointer Events (the HTML5 drag API doesn't fire on touch),
  additive to tapping: a gesture under 8px falls through as a click, drops
  hit-test the rows' `data-drop-id`, and a drop on nothing changes nothing.
- **Sizing**: hand notes are `min(60px, (100cqw - 56px) / 5)` in a size
  container, so five fit at 375px and in the narrow desktop aside. Long single
  words wrap (`overflow-wrap: anywhere`) instead of running under the notes.
- **Motion**: a tapped note flies to its slot (Web Animations, skipped under
  reduced motion). The reveal's `sp-*` classes in `app/globals.css` (flip,
  highlighter, mark pop, headline fade) are disabled under
  `prefers-reduced-motion`; the count-up then shows at once.
- **Copy**: the hand caption says "item" (the bank has no per-prompt noun), and
  "{partner} locked in their order" (no guessed pronouns).

## Verifying a change

- `npm test` for logic and the prompt bank, and `npm run test:rules` if the state
  shape changed.
- For anything visible, use the `ui-review` skill (phone and desktop screenshots;
  the `iphone-se` profile is the 375px width the 5-note hand must fit).
- For multi-device flows, use the `live-test` skill: an iPhone against a desktop
  player, in Playwright, against the emulators.
