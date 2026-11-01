import { existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { ALL_GAMES } from "./registry";

/**
 * Every game has a How to play (docs/how-to-play.md): its rules in
 * `components/<slug>/Rules.tsx`, opened from the game's header and lobby.
 * A new game brings its own (the add-game skill, step 3).
 */
const rulesFile = (slug: string) => join(process.cwd(), "components", slug, "Rules.tsx");

describe("How to play", () => {
  it("exists for every game (components/<slug>/Rules.tsx)", () => {
    const missing = ALL_GAMES.filter((game) => !existsSync(rulesFile(game.slug))).map((game) => game.slug);
    expect(missing, "games without a How to play: see docs/how-to-play.md").toEqual([]);
  });
});
