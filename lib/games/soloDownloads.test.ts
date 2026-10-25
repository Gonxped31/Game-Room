import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { SOLO_GAMES } from "./soloDownloads";

const EXPORTS = join(process.cwd(), "exports");

describe("solo downloads", () => {
  it("has an export (exports/<slug>/index.html + main.tsx) for every solo game, so /admin never offers a file the build doesn't make", () => {
    expect(SOLO_GAMES.length).toBeGreaterThan(0);
    for (const game of SOLO_GAMES) {
      expect(existsSync(join(EXPORTS, game.slug, "index.html")), game.slug).toBe(true);
      expect(existsSync(join(EXPORTS, game.slug, "main.tsx")), game.slug).toBe(true);
    }
  });

  it("exports nothing that isn't a solo game", () => {
    const dirs = readdirSync(EXPORTS, { withFileTypes: true }).filter((entry) => entry.isDirectory());
    expect(dirs.map((dir) => dir.name).sort()).toEqual(SOLO_GAMES.map((game) => game.slug).sort());
  });
});
