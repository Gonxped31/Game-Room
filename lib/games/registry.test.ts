import { describe, expect, it } from "vitest";
import { ALL_GAMES, gamePath, gameText, roomHref } from "./registry";

describe("registry French (docs/i18n.md)", () => {
  it("gives every game its French card words, shaped like the English", () => {
    for (const game of ALL_GAMES) {
      const fr = game.fr;
      expect(fr, game.slug).toBeDefined();
      if (!fr) continue;
      expect(fr.description, game.slug).not.toBe("");
      expect(fr.shortDescription, game.slug).not.toBe("");
      expect(fr.tags.length, game.slug).toBe(game.tags.length);
      expect(fr.modes?.map((m) => m.key), game.slug).toEqual(game.modes?.map((m) => m.key));
      expect(fr.solo?.tags.length, game.slug).toBe(game.solo?.tags.length);
    }
  });

  it("uses French typography: a no-break space before : and a narrow one before ? ! ;", () => {
    for (const game of ALL_GAMES) {
      const t = gameText(game, "fr");
      const words = [t.description, t.shortDescription, ...t.tags, ...(t.modes ?? []).flatMap((m) => [m.label, m.detail]), t.solo?.description ?? "", ...(t.solo?.tags ?? [])];
      for (const text of words) {
        expect(text, game.slug).not.toMatch(/[^ ]:|[^ ][?!;]/);
      }
    }
  });

  it("gameText returns the English fields for English, with the solo path kept", () => {
    for (const game of ALL_GAMES) {
      const t = gameText(game, "en");
      expect(t.description).toBe(game.description);
      expect(t.tags).toEqual(game.tags);
      expect(t.modes).toEqual(game.modes);
      expect(t.solo).toEqual(game.solo);
      expect(gameText(game, "fr").solo?.path).toBe(game.solo?.path);
    }
  });

  it("links into French pages under /fr", () => {
    expect(gamePath("ftw", "fr")).toBe("/fr/same-page");
    expect(roomHref("buzzerquiz", "abc", "fr")).toBe("/fr/buzzerquiz#abc");
    expect(roomHref("buzzerquiz", "abc")).toBe("/buzzerquiz#abc");
  });
});
