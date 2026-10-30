import { existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { ALL_GAMES } from "./registry";

/**
 * Every game has a How to play (docs/how-to-play.md): its rules in
 * `components/<slug>/Rules.tsx`, opened from the game's header and lobby.
 * Games that had none when the rule came in (2026-10-30) wait here, one todo
 * each (tag `howtoplay`); take a game off this list in the change that gives
 * it one. A new game never goes on it.
 */
const PENDING = new Set(["ftw", "cocounsel", "nighthighway", "buzzerquiz", "wordscramble", "regions", "borderrun"]);

const rulesFile = (slug: string) => join(process.cwd(), "components", slug, "Rules.tsx");

describe("How to play", () => {
  it("exists for every game (components/<slug>/Rules.tsx)", () => {
    const missing = ALL_GAMES.filter((game) => !PENDING.has(game.slug) && !existsSync(rulesFile(game.slug))).map((game) => game.slug);
    expect(missing, "games without a How to play: see docs/how-to-play.md").toEqual([]);
  });

  it("only waits for games that still have none, and are still games", () => {
    for (const slug of PENDING) {
      expect(ALL_GAMES.some((game) => game.slug === slug), `${slug} is no longer a game: take it off PENDING`).toBe(true);
      expect(existsSync(rulesFile(slug)), `${slug} has its How to play now: take it off PENDING`).toBe(false);
    }
  });
});
