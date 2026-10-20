import { describe, expect, it } from "vitest";
import { CHOICES, LENGTHS, TOPICS } from "./constants";
import { pickQuestions } from "./game";
import { QUESTIONS } from "./questions";

/** Choices must fit a 390 px wide tile; questions must fit the question card. */
const MAX_CHOICE = 30;
const MAX_QUESTION = 120;
const LONGEST_GAME = Math.max(...LENGTHS);

describe("questions.json", () => {
  it("has unique ids that fit the rules (1-40 characters)", () => {
    const ids = QUESTIONS.map((q) => q.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) {
      expect(id.length).toBeGreaterThanOrEqual(1);
      expect(id.length).toBeLessThanOrEqual(40);
    }
  });

  it.each(QUESTIONS.map((q) => [q.id, q] as const))("%s is well formed", (_, q) => {
    expect(["en", "fr"]).toContain(q.lang);
    expect(TOPICS).toContain(q.topic);
    expect(q.question.trim()).toBe(q.question);
    expect(q.question.length).toBeLessThanOrEqual(MAX_QUESTION);
    expect(q.question.endsWith("?")).toBe(true);
    expect(q.choices).toHaveLength(CHOICES);
    for (const choice of q.choices) {
      expect(choice.trim()).toBe(choice);
      expect(choice.length).toBeGreaterThan(0);
      expect(choice.length).toBeLessThanOrEqual(MAX_CHOICE);
    }
    expect(new Set(q.choices.map((c) => c.toLowerCase())).size).toBe(CHOICES);
  });

  it("has enough questions for the longest single-topic game in every language", () => {
    for (const lang of ["en", "fr"] as const) {
      for (const topic of TOPICS) {
        expect(QUESTIONS.filter((q) => q.lang === lang && q.topic === topic).length, `${lang} ${topic}`).toBeGreaterThanOrEqual(LONGEST_GAME);
        expect(() => pickQuestions(QUESTIONS, { lang, topics: [topic], length: LONGEST_GAME }, Math.random)).not.toThrow();
      }
    }
  });

  it("writes French questions with French spacing before the question mark", () => {
    for (const q of QUESTIONS.filter((q) => q.lang === "fr")) expect(q.question.endsWith(" ?"), q.id).toBe(true);
  });
});
