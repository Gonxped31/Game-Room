import { describe, expect, it } from "vitest";
import { LANGS } from "@/lib/i18n/lang";
import { ITEMS_PER_ROUND, MAX_ITEM_LENGTH, MAX_PROMPT_LENGTH } from "./constants";
import enPrompts from "./prompts.json";
import frPrompts from "./prompts.fr.json";
import frTopicNames from "./topics.fr.json";
import { BANKS, customRound, PROMPTS, randomRound, topicName, TOPICS } from "./prompts";

describe.each(LANGS)("the %s bank", (lang) => {
  const bank = BANKS[lang];

  it("has at least 25 built-in prompts", () => {
    expect(bank.length).toBeGreaterThanOrEqual(25);
  });

  it("gives every prompt exactly ITEMS_PER_ROUND unique items", () => {
    for (const { prompt, items } of bank) {
      expect(items, `"${prompt}" item count`).toHaveLength(ITEMS_PER_ROUND);
      expect(new Set(items).size, `"${prompt}" items should be unique`).toBe(ITEMS_PER_ROUND);
    }
  });

  it("has no duplicate prompt text", () => {
    const prompts = bank.map((p) => p.prompt);
    expect(new Set(prompts).size).toBe(prompts.length);
  });

  it("tags every prompt with a non-empty group", () => {
    for (const { prompt, group } of bank) {
      expect(group, `"${prompt}" group`).toBeTruthy();
    }
  });

  it("never places more than 2 prompts of the same group next to each other", () => {
    let run = 1;
    for (let i = 1; i < bank.length; i++) {
      run = bank[i].group === bank[i - 1].group ? run + 1 : 1;
      expect(run, `run of "${bank[i].group}" ending at index ${i}`).toBeLessThanOrEqual(2);
    }
  });

  it("keeps every prompt and item within the length caps the database enforces", () => {
    for (const entry of bank) {
      expect(entry.prompt.length, entry.prompt).toBeLessThanOrEqual(MAX_PROMPT_LENGTH);
      for (const item of entry.items) expect(item.length, item).toBeLessThanOrEqual(MAX_ITEM_LENGTH);
    }
  });

  it("only ever draws its own prompts", () => {
    const own = new Set(bank.map((p) => p.prompt));
    for (let i = 0; i < 100; i++) expect(own.has(randomRound([], [], lang).prompt)).toBe(true);
  });

  it("cycles through the entire bank once before any prompt repeats", () => {
    const seen: string[] = [];
    for (let i = 0; i < bank.length; i++) {
      const { prompt } = randomRound(seen, [], lang);
      expect(seen, `prompt #${i + 1} should not repeat within one cycle`).not.toContain(prompt);
      seen.push(prompt);
    }
    expect(new Set(seen).size).toBe(bank.length);
  });
});

describe("the French bank", () => {
  it("has the English bank's categories, in the same order, so a room's topics work in both", () => {
    expect(Object.keys(frPrompts)).toEqual(Object.keys(enPrompts));
  });

  it("is a different bank from the English one", () => {
    const english = new Set(PROMPTS.map((p) => p.prompt));
    expect(BANKS.fr.filter((p) => english.has(p.prompt)).length).toBeLessThan(BANKS.fr.length / 10);
  });

  it("isn't held back by English prompts already seen: the session's history is per text", () => {
    const allEnglish = PROMPTS.map((p) => p.prompt);
    const french = new Set(BANKS.fr.map((p) => p.prompt));
    for (let i = 0; i < 20; i++) expect(french.has(randomRound(allEnglish, [], "fr").prompt)).toBe(true);
    // Every French prompt but one seen: that one comes next.
    const last = BANKS.fr.map((p) => p.prompt).find((prompt) => !allEnglish.includes(prompt))!;
    const rest = BANKS.fr.map((p) => p.prompt).filter((prompt) => prompt !== last);
    expect(randomRound([...allEnglish, ...rest], [], "fr").prompt).toBe(last);
  });
});

describe("topicName", () => {
  it("has a French name for every topic, and none for a topic the bank doesn't have", () => {
    const names = frTopicNames as Record<string, string>;
    expect(Object.keys(names).sort()).toEqual([...TOPICS].sort());
    for (const topic of TOPICS) {
      expect(names[topic]?.trim(), topic).toBeTruthy();
      expect(names[topic].length, topic).toBeLessThanOrEqual(60);
    }
  });

  it("shows the English key in English and its French name in French", () => {
    expect(topicName(TOPICS[0], "en")).toBe(TOPICS[0]);
    expect(topicName(TOPICS[0], "fr")).toBe((frTopicNames as Record<string, string>)[TOPICS[0]]);
    expect(topicName("Not a topic", "fr")).toBe("Not a topic");
  });
});

describe("randomRound", () => {
  it("always builds a RANKING round with ITEMS_PER_ROUND items", () => {
    const round = randomRound();
    expect(round.status).toBe("RANKING");
    expect(round.items).toHaveLength(ITEMS_PER_ROUND);
  });

  it("draws in English by default", () => {
    const english = new Set(PROMPTS.map((p) => p.prompt));
    expect(english.has(randomRound().prompt)).toBe(true);
  });

  it("never returns a prompt already in usedPrompts", () => {
    const used = PROMPTS.slice(0, 50).map((p) => p.prompt);
    for (let i = 0; i < 50; i++) {
      expect(used).not.toContain(randomRound(used).prompt);
    }
  });

  it("once the bank is exhausted, still avoids an immediate repeat of the last prompt", () => {
    for (const lang of LANGS) {
      const allPrompts = BANKS[lang].map((p) => p.prompt);
      for (let i = 0; i < 20; i++) {
        const last = allPrompts[allPrompts.length - 1];
        const next = randomRound(allPrompts, [], lang).prompt;
        expect(next).not.toBe(last);
        allPrompts.push(next);
      }
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

describe("topics", () => {
  it("lists every group in each bank exactly once", () => {
    expect(new Set(TOPICS).size).toBe(TOPICS.length);
    for (const lang of LANGS) expect(new Set(BANKS[lang].map((p) => p.group))).toEqual(new Set(TOPICS));
  });

  describe.each(LANGS)("in %s", (lang) => {
    const groupOf = (prompt: string) => BANKS[lang].find((p) => p.prompt === prompt)!.group;

    it("only draws prompts from the chosen topics", () => {
      const topics = [TOPICS[0], TOPICS[3]];
      for (let i = 0; i < 100; i++) expect(topics).toContain(groupOf(randomRound([], topics, lang).prompt));
    });

    it("goes through every prompt of the chosen topics before repeating, then cycles within them", () => {
      const topics = [TOPICS[1]];
      const size = BANKS[lang].filter((p) => p.group === topics[0]).length;
      const used: string[] = [];
      for (let i = 0; i < size; i++) used.push(randomRound(used, topics, lang).prompt);
      expect(new Set(used).size).toBe(size);
      const after = randomRound(used, topics, lang).prompt;
      expect(groupOf(after)).toBe(topics[0]);
      expect(after).not.toBe(used[used.length - 1]);
    });

    it("draws from the whole bank when no topic is chosen", () => {
      const seen = new Set<string>();
      for (let i = 0; i < 300; i++) seen.add(groupOf(randomRound([], [], lang).prompt));
      expect(seen.size).toBeGreaterThan(10);
    });
  });
});
