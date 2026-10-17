import { describe, expect, it } from "vitest";
import { ITEMS_PER_ROUND, MAX_ITEM_LENGTH, MAX_PROMPT_LENGTH } from "./constants";
import { customRound, PROMPTS, randomRound, TOPICS } from "./prompts";

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

  it("never returns a prompt already in usedPrompts", () => {
    const used = PROMPTS.slice(0, 50).map((p) => p.prompt);
    for (let i = 0; i < 50; i++) {
      expect(used).not.toContain(randomRound(used).prompt);
    }
  });

  it("cycles through the entire bank once before any prompt repeats", () => {
    const seen: string[] = [];
    for (let i = 0; i < PROMPTS.length; i++) {
      const { prompt } = randomRound(seen);
      expect(seen, `prompt #${i + 1} should not repeat within one cycle`).not.toContain(prompt);
      seen.push(prompt);
    }
    expect(new Set(seen).size).toBe(PROMPTS.length);
  });

  it("once the bank is exhausted, still avoids an immediate repeat of the last prompt", () => {
    const allPrompts = PROMPTS.map((p) => p.prompt);
    for (let i = 0; i < 20; i++) {
      const last = allPrompts[allPrompts.length - 1];
      const next = randomRound(allPrompts).prompt;
      expect(next).not.toBe(last);
      allPrompts.push(next);
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

  it("rejects a prompt or item over the length caps the database enforces", () => {
    expect(() => customRound("x".repeat(MAX_PROMPT_LENGTH + 1), ["1", "2", "3", "4", "5"])).toThrow();
    expect(() => customRound("Fine", ["1", "2", "3", "4", "x".repeat(MAX_ITEM_LENGTH + 1)])).toThrow();
    expect(() => customRound("x".repeat(MAX_PROMPT_LENGTH), ["1", "2", "3", "4", "x".repeat(MAX_ITEM_LENGTH)])).not.toThrow();
  });
});

describe("built-in bank vs. the length caps", () => {
  it("every built-in prompt and item fits", () => {
    for (const entry of PROMPTS) {
      expect(entry.prompt.length).toBeLessThanOrEqual(MAX_PROMPT_LENGTH);
      for (const item of entry.items) expect(item.length).toBeLessThanOrEqual(MAX_ITEM_LENGTH);
    }
  });
});

describe("topics", () => {
  const groupOf = (prompt: string) => PROMPTS.find((p) => p.prompt === prompt)!.group;

  it("lists every group in the bank exactly once", () => {
    expect(new Set(TOPICS).size).toBe(TOPICS.length);
    expect(new Set(PROMPTS.map((p) => p.group))).toEqual(new Set(TOPICS));
  });

  it("only draws prompts from the chosen topics", () => {
    const topics = [TOPICS[0], TOPICS[3]];
    for (let i = 0; i < 100; i++) expect(topics).toContain(groupOf(randomRound([], topics).prompt));
  });

  it("goes through every prompt of the chosen topics before repeating, then cycles within them", () => {
    const topics = [TOPICS[1]];
    const size = PROMPTS.filter((p) => p.group === topics[0]).length;
    const used: string[] = [];
    for (let i = 0; i < size; i++) used.push(randomRound(used, topics).prompt);
    expect(new Set(used).size).toBe(size);
    const after = randomRound(used, topics).prompt;
    expect(groupOf(after)).toBe(topics[0]);
    expect(after).not.toBe(used[used.length - 1]);
  });

  it("draws from the whole bank when no topic is chosen", () => {
    const seen = new Set<string>();
    for (let i = 0; i < 300; i++) seen.add(groupOf(randomRound().prompt));
    expect(seen.size).toBeGreaterThan(10);
  });
});
