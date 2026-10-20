import { describe, expect, it } from "vitest";
import { MAX_WORD, MIN_WORD, TARGET_TURN_CAP, TURNS_PER_TEAM } from "./constants";
import { plain } from "./game";
import { WORDS } from "./words";

describe("words.json", () => {
  it("has unique ids that fit the rules (1-40 characters)", () => {
    const ids = WORDS.map((w) => w.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(id.length).toBeLessThanOrEqual(40);
  });

  it.each(WORDS.map((w) => [`${w.id} ${w.word}`, w] as const))("%s is well formed", (_, w) => {
    expect(["en", "fr"]).toContain(w.lang);
    // Lowercase letters only (accents fine, no œ/æ, spaces, hyphens or apostrophes).
    expect(w.word).toMatch(/^[a-zàâäçéèêëîïôöùûüÿ]+$/);
    // Every letter survives as a tile.
    expect(plain(w.word)).toHaveLength(w.word.length);
    expect(w.word.length).toBeGreaterThanOrEqual(MIN_WORD);
    expect(w.word.length).toBeLessThanOrEqual(MAX_WORD);
    // Something to unscramble: not one repeated letter.
    expect(new Set(plain(w.word)).size).toBeGreaterThan(1);
  });

  it.each(["en", "fr"])("has no two %s words with the same letters (a right answer would be refused)", (lang) => {
    const seen = new Map<string, string>();
    for (const w of WORDS.filter((x) => x.lang === lang)) {
      const key = [...plain(w.word)].sort().join("");
      expect(seen.get(key), `${w.word} and ${seen.get(key)}`).toBeUndefined();
      seen.set(key, w.word);
    }
  });

  it.each(["en", "fr"])("has enough %s words for the longest game, with every length", (lang) => {
    const words = WORDS.filter((w) => w.lang === lang);
    expect(words.length).toBeGreaterThanOrEqual(Math.max(TURNS_PER_TEAM.max, TARGET_TURN_CAP) * 2 * 4);
    for (let n = MIN_WORD; n <= MAX_WORD; n++) expect(words.some((w) => w.word.length === n), `${lang} ${n} letters`).toBe(true);
  });
});
