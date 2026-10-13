I want to build a private 2-player web game from the reference prototype in `reference/first-to-worst-v2.html`. Read that file fully first. It is a working single-file prototype and it is the source of truth for the UI, flow, card layout and animations. Where this brief and the prototype disagree, this brief wins. Port it into a proper Next.js project and make it production-ready. Before writing code, give me a short plan (stack, file structure, build stages) and wait for my OK.

## What the game is
"First to Worst": a ranking game for exactly two remote players, with no login, no accounts and no lobby. Every round has a prompt and exactly 5 topic cards (e.g. "Pizza toppings": Pepperoni, Mushrooms, Pineapple, Anchovies, Jalapenos), plus exactly 5 number cards (1 to 5).
- The MASTER privately ranks the topics by placing number cards on them (1 = first/best, 5 = worst).
- The GUESSER then places their own number cards to guess the master's ranking.
- Both rankings are revealed with a card-flip animation and scored.
- Roles swap every round. Players can play asynchronously.
- Never support other sizes. Define `ITEMS_PER_ROUND = 5` as a constant and use it everywhere instead of hardcoding 5 in components or logic.

## Stack
- Next.js (App Router) + React + TypeScript + Tailwind
- Firebase Realtime Database via the modular v10 SDK
- Vitest for unit tests
- Config only from env variables: NEXT_PUBLIC_FIREBASE_API_KEY, NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN, NEXT_PUBLIC_FIREBASE_DATABASE_URL, NEXT_PUBLIC_FIREBASE_PROJECT_ID, NEXT_PUBLIC_FIREBASE_APP_ID. Provide `.env.example`. Never hardcode credentials, and make sure `.env.local` is git-ignored.
- Keep a local fallback mode (localStorage plus the `storage` event) when Firebase env vars are missing, like the prototype does, so I can test with two browser tabs. Hide the storage layer behind a small interface (`subscribe`, `set`, `transaction`) so the UI doesn't know which backend is in use.

## Rooms and identity
- Room ID comes from the URL hash (`/#roomname`), defaulting to "our-private-room-id". Data lives at `games/{roomId}`.
- The first client to open a missing room creates it.
- On first visit the player picks "I'm the master" (stored as p1) or "I'm the guesser" (stored as p2), saved in localStorage per room. Provide "Change role" in the footer.
- The master of round N is p1 if N is odd, otherwise p2.
- Do NOT implement anti-cheat or auth. We trust each other. Mention this in the README as a known limitation.

## Data model
```json
{
  "round": 1,
  "totals": { "p1": 0, "p2": 0 },
  "current": {
    "prompt": "Pizza toppings",
    "items": [{ "id": "i0_pepperoni", "label": "Pepperoni" }],
    "status": "RANKING",
    "masterOrder": ["id", "..."],
    "guessOrder": ["id", "..."],
    "score": 0
  }
}
```
- `items` always has exactly 5 entries. Items have stable IDs, and orders are arrays of IDs.
- `score` is an integer from 0 to 5 (number of matching cards). `totals[p]` is the cumulative score earned as guesser.
- masterOrder, guessOrder and score are absent until set.
- Realtime Database drops nulls and empty arrays, so write code that tolerates missing fields.

## State machine (`current.status`)
1. RANKING: the master places number cards on the topics and presses "Lock in my ranking" (enabled only when all 5 slots are filled). The guesser sees a waiting message. The master can:
   - "Shuffle prompt": random prompt from a built-in bank of at least 25 prompts, each with exactly 5 items, never repeating the previous one.
   - "Write my own prompt": line 1 = the prompt, then exactly 5 items, one per line. Reject anything else with a clear inline error such as "Add exactly 5 items, one per line."
2. GUESSING: the master's cards are locked and shown face-down. The guesser places their cards and presses "Submit final guess".
3. REVEALED: all cards flip face-up in sequence. Show ✓/✕ badges on each guess card (✓ if that card matches), then the score. A "Next round (roles swap)" button increments round, picks a new prompt, resets to RANKING and keeps totals.

Only write to the database on lock-in, submit and next round, never while placing cards. Use database transactions for every status change so double clicks, double tabs or reconnects cannot skip or repeat a state, and make "Next round" idempotent (if two people press it, only one new round is created). A refresh mid-round must restore the correct screen. Placement state is local only, and losing it on refresh is acceptable.

## Scoring (overrides the prototype's old scoring idea)
Per-card exact match. For each item card, compare the number the master gave it with the number the guesser gave it. If they are the same it is a match, otherwise it is not.
- Round score = the number of matching cards, an integer from 0 to 5.
- Do NOT use Jaccard or any other similarity measure.
- Put this in a pure function in `lib/scoring.ts` that takes `masterOrder` and `guessOrder` (arrays of item IDs) and returns the match count. The number for an item is its index in the array plus 1.
- Unit tests: identical orders (score 5), fully reversed (the middle card matches, score 1), one swapped pair (score 3), a rotation by one position (score 0), and a test confirming that a score of 4 can never occur (check all 120 permutations).
- The score quirk (0, 1, 2, 3 or 5 only) is expected. Mention it in the README.

## UI: physical card table (match the prototype closely)
- Background: teal felt (#128A94).
- Topic cards: pure white, black bold uppercase rounded font (Fredoka), 9px radius, soft shadow.
- Number cards: white face with a large gradient number (1 teal→blue, 2 light→dark green, 3 yellow→amber, 4 light orange→orange, 5 light pink→magenta). There are exactly five, so no color cycling.
- Two decks with identical faces but different backs reading "RANK CARD". The master's back is a vertical rainbow gradient (teal, green, yellow, orange, pink) with white text. The guesser's back is white with gradient text (RANK in teal, CARD in orange).
- Mobile-first layout: one row per topic, with the master's slot on the left, the topic card in the middle, and the guesser's slot on the right, so the players face each other. Column headers read "You · master" and "Guesser" (or the reverse).
- Placing cards: the player's remaining numbers form a hand of up to 5 face-up cards. Tap a number, then tap a slot to place it. Tap a placed card to return it. No drag-and-drop.
- Flip animation: 3D rotateY 180° (~0.7s, backface-visibility hidden). Locking in flips the master's cards face-down. On reveal, cards flip one row at a time (~0.25s stagger), then the ✓/✕ badges appear and the score pops in. Respect prefers-reduced-motion.
- Reveal score: show "X / 5" in large type after the flips. All 5 matched → "Perfect. You two are in sync.", 3 or more → "Pretty close!", otherwise → "Not even close. Time to talk."
- Header: "Round N · You X – Partner Y", where X and Y are total matches earned as guesser. Set `document.title` to "▶ Your turn! · First to Worst" when it's the player's turn. Footer: room name, role, "Change role", "Reset game" (with confirm).
- Pink (#FF3D8F) primary buttons with a darker bottom edge, white text, 12px radius. Visible keyboard focus. Accessible: aria-labels on slots and cards, and keep sufficient contrast.
- Must work well at 375px width and scale up to desktop (centered column, max about 520px).
- Don't use any logos, box art or trademarked assets from the commercial game. Keep the visual look, but use a neutral working title in code (a `GAME_TITLE` constant) so it's easy to rename before any public release.

## Code quality
- Structure: `lib/scoring.ts`, `lib/game.ts` (pure state transitions), `lib/prompts.ts` (the prompt bank), `lib/store/` (firebase and local implementations), `components/` (Card, CardTable, Hand, CustomPromptForm, ...), and `app/page.tsx`. Keep game logic out of components.
- Unit tests for scoring, for the state transition functions (valid and invalid transitions), and for a check that every built-in prompt has exactly 5 unique items.
- Add a `CLAUDE.md` with the project overview, commands, and the conventions above.
- Commit after each working stage with clear messages.

## Build stages (stop and show me after each)
1. Scaffold, Tailwind, and the card table UI in local mode only (static data), including the flip animation.
2. Game logic and state machine with local storage, plus tests for per-card match scoring and for the state transitions.
3. Firebase backend with transactions, working across two devices.
4. Polish: prompt bank, custom prompts, round swap, scoreboard, accessibility, reduced motion.
5. README: Firebase setup steps, recommended Realtime Database rules for a private game (note the limitations without auth), env variables, the score quirk, deployment to Vercel, and how to rename the game.

Run the dev server and test in a browser (or at least type-check, lint and run tests) before telling me a stage is done.