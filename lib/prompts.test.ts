import { describe, expect, it } from "vitest";
import { ITEMS_PER_ROUND } from "./constants";
import { customRound, PROMPTS, randomRound } from "./prompts";

describe("PROMPTS", () => {
  it("has at least 25 built-in prompts", () => {
    expect(PROMPTS.length).toBeGreaterThanOrEqual(25);
  });

  it("gives every prompt exactly ITEMS_PER_ROUND unique items", () => {
    for (const { prompt, items } of PROMPTS) {
      expect(items, `"${prompt}" item count`).toHaveLength(ITEMS_PER_ROUND);
      expect(new Set(items).size, `"${prompt}" items should be unique`).toBe(ITEMS_PER_ROUND);
    }
  });

  it("has no duplicate prompt text", () => {
    const prompts = PROMPTS.map((p) => p.prompt);
    expect(new Set(prompts).size).toBe(prompts.length);
  });

  it("tags every prompt with a non-empty dev-only group", () => {
    for (const { prompt, group } of PROMPTS) {
      expect(group, `"${prompt}" group`).toBeTruthy();
    }
  });

  it("never places more than 2 prompts of the same group next to each other", () => {
    let run = 1;
    for (let i = 1; i < PROMPTS.length; i++) {
      run = PROMPTS[i].group === PROMPTS[i - 1].group ? run + 1 : 1;
      expect(run, `run of "${PROMPTS[i].group}" ending at index ${i}`).toBeLessThanOrEqual(2);
    }
  });
});

describe("randomRound", () => {
  it("always builds a RANKING round with ITEMS_PER_ROUND items", () => {
    const round = randomRound();
    expect(round.status).toBe("RANKING");
    expect(round.items).toHaveLength(ITEMS_PER_ROUND);
  });

  it("never repeats the avoided prompt", () => {
    const avoid = PROMPTS[0].prompt;
    for (let i = 0; i < 50; i++) {
      expect(randomRound(avoid).prompt).not.toBe(avoid);
    }
  });
});

describe("customRound", () => {
  it("builds a round from a custom prompt and items", () => {
    const round = customRound("Favorite numbers", ["1", "2", "3", "4", "5"]);
    expect(round.prompt).toBe("Favorite numbers");
    expect(round.items.map((i) => i.label).sort()).toEqual(["1", "2", "3", "4", "5"]);
  });

  it("rejects anything other than exactly ITEMS_PER_ROUND items", () => {
    expect(() => customRound("Too few", ["A", "B"])).toThrow();
  });
});
