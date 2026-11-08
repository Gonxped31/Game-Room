# Same Page: the prompt bank

The `first-to-worst` skill's `SKILL.md` (next to this file) has the rest of the game.

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
