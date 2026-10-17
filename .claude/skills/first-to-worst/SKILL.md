---
name: first-to-worst
description: Reference for working on First to Worst (FTW), the 2-player ranking game - its rules, state machine, prompt bank, UI structure and gotchas. Use whenever changing or debugging anything under lib/games/ftw/, components/ftw/ or app/ftw/, editing prompts.json, or answering questions about how FTW plays.
---

# First to Worst

A private 2-player ranking game. Each round has a prompt and exactly 5 topic cards.
The **master** privately ranks them 1 (best) to 5 (worst), the **guesser** tries to
match that ranking, and both are revealed and scored. Roles swap every round.

- **Source of truth for UI, flow and animations**: `references/ftw/first-to-worst.html`
  (the original single-file prototype).
- **Rules and scoring**: `references/ftw/first-to-worst-game-design.md` overrides the
  prototype wherever they differ.

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
  - `CONTAINER_MAX_WIDTH_CLASS` and `NUMBER_GRADIENTS`.
- `components/ftw/` - `RoundBoard`, `CardTable`, `CardSlot`, `CardFace`, `Hand`,
  `CustomPromptForm`, `TopicPicker`, `SessionRecap`.
- `app/ftw/page.tsx` - wires `useGameSession({ gameSlug: "ftw" })` to all of the
  above.

## State and Firebase

- `GameState` contains `round`, `totals{p1,p2}`, `current{prompt, items[5],
  status, masterOrder?, guessOrder?, score?, placed?}`, `usedPrompts[]`,
  `history[]` and `topics?[]`.
- **Topics** (`topics`, written by `setTopics`): the prompt-bank categories the
  players want prompts from. Shared - either player can change it at any time in
  `TopicPicker` (under the board) - and it applies from the next prompt (Shuffle,
  Next round, Reset game). Absent means every topic: `setTopics` stores no field
  for none or all, and `nextRound`/`newGame` carry it over. Validated by the rules
  (strings ≤ 60, at most 99 entries).
- **Live placement progress** (`current.placed`, written by `setPlaced`): the IDs
  of the slots the player whose turn it is has filled so far - **never the
  numbers**, because the other player can read the room. The other player sees
  face-down cards pop in on those slots and "N of 5 placed". `RoundBoard` reports
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
- `RoleStickers` shows "👑 Sam · Master" / "🔎 Alex · Guesser" with presence dots.
  Names replace "Master"/"Guesser" throughout, falling back to the generic words
  when unset.

## Page flow (`app/ftw/page.tsx`)

The page renders the first state that applies:
1. `connectionError` or `roomMissing` → message.
2. `!game` → "Connecting…".
3. `!me` → `RolePicker`.
4. `!bothJoined` → `InviteLinkBanner` (name field only when `canRenameRoom`).
5. Otherwise → `RoleStickers` + `RoundBoard` + `SessionRecap`.

The board is withheld until both players have joined.

## UI gotchas

- **The fixed bottom bar**: `RoundBoard`'s hand + submit (while placing) and "Next
  round" (once revealed) sit in a `position: fixed` bar.
  - Its bottom clearance lives on the page's `<main>` (`pb-52` when `hasFixedBar`),
    **not** in `RoundBoard`, because a fixed bar covers whatever is at the bottom
    of the viewport, including the Footer.
  - The bar is its own stacking context, so it needs `CONTAINER_MAX_WIDTH_CLASS`
    applied directly to stay aligned with the page.
- **Tap targets**: only wire a column's tap handler when that column is
  interactive for the current viewer right now. A past bug let a tap on the
  *other* player's empty slot consume your selected card.
- **Drag and drop**: built on Pointer Events, not the HTML5 drag API (which
  doesn't fire on touch screens).
  - It's additive to tap-to-place; a gesture under 8px falls through as a click.
  - `CardSlot` exposes `data-drop-id` only when interactive, and drops hit-test
    with `elementFromPoint(...).closest("[data-drop-id]")`.
  - Hand card onto a filled slot: replaces it, and the displaced card goes back to
    the hand.
  - Board card onto an empty slot: moves it. Onto a filled slot: swaps the two.
  - Onto itself or nothing: no-op, so an aborted drag can't lose a card.
- **Sizing**: card/slot size is `min(15vw,68px)`, so 5 hand cards fit on one row
  at 375px.
- **Reduced motion**: the card flip uses the global `flip-inner` class, which
  `app/globals.css` disables under `prefers-reduced-motion`.

## Verifying a change

- `npm test` for logic and the prompt bank, and `npm run test:rules` if the state
  shape changed.
- For anything visible, use the `ui-review` skill (phone and desktop screenshots;
  the `iphone-se` profile is the 375px width the 5-card hand must fit).
- For multi-device flows, use the `live-test` skill: an iPhone against a desktop
  player, in Playwright, against the emulators.
