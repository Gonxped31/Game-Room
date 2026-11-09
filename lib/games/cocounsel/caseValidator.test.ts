import { describe, expect, it } from "vitest";
import { LANGS, type Lang } from "@/lib/i18n/lang";
import { CASES, CASES_BY_LANG, caseForState, casesByTier, getCase } from "./cases";
import type { CaseDefinition, CaseScreen } from "./caseTypes";
import { validateCase } from "./caseValidator";

function freshCase(lang: Lang = "en"): CaseDefinition {
  // deep clone so mutation in one test never leaks into another
  return JSON.parse(JSON.stringify(getCase("ruined-birthday", lang)));
}

describe("validateCase", () => {
  it("passes every shipped case, in every language, with zero errors", () => {
    for (const lang of LANGS) {
      for (const [id, caseDef] of Object.entries(CASES_BY_LANG[lang])) {
        expect(validateCase(caseDef, lang), `${lang} case "${id}"`).toEqual([]);
      }
    }
  });

  it("rejects a correct pair that shares a distinctive word (content rule 5)", () => {
    const c = freshCase();
    c.parts[0].hands.investigator[0].text = "He looked shocked about the dinner.";
    expect(validateCase(c).some((e) => e.includes('"dinner"'))).toBe(true);
  });

  it("ignores common words when checking a correct pair's wording", () => {
    const c = freshCase();
    c.parts[0].hands.investigator[0].text = "He would never look guilty about it.";
    c.parts[0].hands.defendant[0].text = "I would never have known tonight was the night.";
    expect(validateCase(c)).toEqual([]);
  });

  it("catches a shared French word with accents, or behind an elision (content rule 5)", () => {
    const accented = freshCase("fr");
    accented.parts[0].hands.investigator[0].text = "Il avait l'air déçu, pour le dîner.";
    accented.parts[0].hands.defendant[0].text = "Le dîner, c'était ce soir.";
    expect(validateCase(accented, "fr").some((e) => e.includes('"dîner"'))).toBe(true);

    const elided = freshCase("fr");
    elided.parts[0].hands.investigator[0].text = "Il ne pensait pas à l'anniversaire.";
    elided.parts[0].hands.defendant[0].text = "Je ne savais rien de son anniversaire.";
    expect(validateCase(elided, "fr").some((e) => e.includes('"anniversaire"'))).toBe(true);
  });

  it("ignores common French words when checking a correct pair's wording", () => {
    const c = freshCase("fr");
    c.parts[0].hands.investigator[0].text = "Il était encore sous le choc, jamais coupable.";
    c.parts[0].hands.defendant[0].text = "Je ne savais pas encore, jamais je n'aurais deviné.";
    expect(validateCase(c, "fr")).toEqual([]);
  });

  it("rejects a hand with the wrong number of cards", () => {
    const c = freshCase();
    c.parts[0].hands.investigator.push({ id: "I-extra", text: "An extra card for testing", type: "decoy", contradicts: [] });
    expect(validateCase(c)).toContain('Part 1: investigator hand has 4 cards, expected 3.');
  });

  it("rejects a Part with zero correct cards", () => {
    const c = freshCase();
    c.parts[0].hands.investigator[0].type = "decoy";
    const errors = validateCase(c);
    expect(errors.some((e) => e.includes('0 "correct" cards'))).toBe(true);
  });

  it("rejects a Part with more than one correct card", () => {
    const c = freshCase();
    c.parts[0].hands.investigator[1].type = "correct";
    const errors = validateCase(c);
    expect(errors.some((e) => e.includes('2 "correct" cards'))).toBe(true);
  });

  it("rejects a Part with no trap pairs", () => {
    const c = freshCase();
    c.parts[0].traps = [];
    expect(validateCase(c)).toContain("Part 1: has no trap pairs.");
  });

  it("rejects a trap pair that's identical to the correct pair", () => {
    const c = freshCase();
    c.parts[0].traps = [{ pair: c.parts[0].correct }];
    const errors = validateCase(c);
    expect(errors.some((e) => e.includes("identical to the correct pair"))).toBe(true);
  });

  it("rejects a card that contradicts an unknown fact ID", () => {
    const c = freshCase();
    c.parts[0].hands.investigator[1].contradicts = ["NOT-A-REAL-FACT"];
    const errors = validateCase(c);
    expect(errors.some((e) => e.includes('contradicts unknown fact "NOT-A-REAL-FACT"'))).toBe(true);
  });

  it("rejects a card that contradicts a fact from a later Part", () => {
    const c = freshCase();
    c.parts[0].hands.investigator[1].contradicts = ["P2-D1"];
    const errors = validateCase(c);
    expect(errors.some((e) => e.includes("contradicts fact \"P2-D1\" from a later Part"))).toBe(true);
  });

  it("rejects a Part after the memory-lure mechanic was introduced if it has no memory lure", () => {
    const c = freshCase();
    // Part 3 (index 2) is the only Part with memory lures in the shipped case.
    // Add a 4th part identical in shape but with no memoryLure card.
    c.parts.push(JSON.parse(JSON.stringify(c.parts[0])));
    c.parts[3].n = 4;
    for (const card of [...c.parts[3].hands.investigator, ...c.parts[3].hands.defendant]) {
      if (card.type === "memoryLure") card.type = "decoy";
    }
    const errors = validateCase(c);
    expect(errors.some((e) => e.includes("Part 4") && e.includes("memory-lure"))).toBe(true);
  });

  it("does not require a memory lure in Part 2, since the shipped case never introduces the mechanic until Part 3", () => {
    // sanity check that the real Part 2 (no memory lure) is NOT flagged -
    // already covered by the "passes every shipped case" test above, but
    // asserted explicitly here since it's the one deliberate deviation from
    // the design doc's literal "from Part 2 onward" wording.
    const errors = validateCase(freshCase());
    expect(errors.some((e) => e.startsWith("Part 2") && e.includes("memory-lure"))).toBe(false);
  });

  it("rejects a Part that isn't the last one but has no theory", () => {
    const c = freshCase();
    delete c.parts[0].theory;
    expect(validateCase(c)).toContain('Part 1: is not the final Part but has no "theory".');
  });

  it("rejects the final Part if it has a theory", () => {
    const c = freshCase();
    c.parts[2].theory = "This shouldn't be here.";
    const errors = validateCase(c);
    expect(errors.some((e) => e.includes("is the final Part but has a") && e.includes("theory"))).toBe(true);
  });

  it("rejects a case missing a verdict", () => {
    const c = freshCase();
    c.verdict.text = "";
    expect(validateCase(c)).toContain("Case is missing a verdict title or text.");
  });

  it("rejects a case missing a teaser", () => {
    const c = freshCase();
    c.teaser = "   ";
    expect(validateCase(c)).toContain("Case is missing a teaser.");
  });

  it("rejects a case missing a character name", () => {
    const c = freshCase();
    c.characters.defendant = "";
    expect(validateCase(c)).toContain("Case is missing a character name for one of the two roles.");
  });
});

/**
 * Everything but the words: case and Part order, tiers, card and fact IDs, card
 * types, contradicts, correct pairs, traps. The shared state stores IDs only,
 * so this must be identical in every language for a case to play the same.
 */
function caseLogic(caseDef: CaseDefinition) {
  const screens: CaseScreen[] = ["investigator", "defendant"];
  return {
    id: caseDef.id,
    tier: caseDef.tier,
    parts: caseDef.parts.map((part) => ({
      n: part.n,
      facts: screens.map((s) => part.screens[s].facts.map((f) => f.id)),
      hands: screens.map((s) => part.hands[s].map(({ id, type, contradicts }) => ({ id, type, contradicts }))),
      correct: part.correct,
      traps: part.traps,
      hasTheory: part.theory !== undefined,
    })),
  };
}

describe("the French case bank", () => {
  const fr = CASES_BY_LANG.fr;

  it("has the same cases as the English one, in the same order", () => {
    expect(Object.keys(fr)).toEqual(Object.keys(CASES));
  });

  it("matches every English case's structure: Part numbers, card and fact IDs, and all the logic", () => {
    for (const [id, caseDef] of Object.entries(CASES)) {
      expect(fr[id] && caseLogic(fr[id]), `case "${id}"`).toEqual(caseLogic(caseDef));
    }
  });

  it("is actually translated: every title, teaser and verdict differs from the English", () => {
    for (const [id, caseDef] of Object.entries(CASES)) {
      expect(fr[id].title, `case "${id}" title`).not.toBe(caseDef.title);
      expect(fr[id].teaser, `case "${id}" teaser`).not.toBe(caseDef.teaser);
      expect(fr[id].verdict.text, `case "${id}" verdict`).not.toBe(caseDef.verdict.text);
    }
  });

  it("is what getCase, caseForState and casesByTier return for French", () => {
    expect(getCase("empty-frame", "fr")).toBe(fr["empty-frame"]);
    expect(caseForState("no-such-case", "fr")).toBe(fr["ruined-birthday"]);
    expect(casesByTier("fr").flatMap((t) => t.cases)).toEqual(expect.arrayContaining(Object.values(fr)));
    expect(getCase("empty-frame")).toBe(CASES["empty-frame"]);
  });
});
