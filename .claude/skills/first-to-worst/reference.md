# Same Page: files, state detail, seats, page flow, input and motion

The detail behind the `first-to-worst` skill's `SKILL.md` (next to this file).

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
  - `Rules` - How to play (`docs/how-to-play.md`): the ? in `GameHeader` (every
    screen) and a link on the waiting screen. A rules change updates it too.
- `app/same-page/page.tsx` - wires `useGameSession({ gameSlug: "ftw" })` to all
  of the above.

## State detail: topics and live placement

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
(`AskDialog`, the app's own modal, like Reset game and New room), gives up the seat and goes to `/`. Only the error and
unknown-room notices get the plain "All games" link instead.

## Input, sizing and motion

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
