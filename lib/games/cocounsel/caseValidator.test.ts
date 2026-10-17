import { describe, expect, it } from "vitest";
import { CASES, getCase } from "./cases";
import type { CaseDefinition } from "./caseTypes";
import { validateCase } from "./caseValidator";

function freshCase(): CaseDefinition {
  // deep clone so mutation in one test never leaks into another
  return JSON.parse(JSON.stringify(getCase("ruined-birthday")));
}

describe("validateCase", () => {
  it("passes every shipped case with zero errors", () => {
    for (const [id, caseDef] of Object.entries(CASES)) {
      expect(validateCase(caseDef), `case "${id}"`).toEqual([]);
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
