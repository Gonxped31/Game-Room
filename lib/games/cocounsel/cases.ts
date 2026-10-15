import casesJson from "./cases.json";
import type { CaseBank, CaseDefinition } from "./caseTypes";

// JSON imports infer widened types (string instead of a literal union,
// string[] instead of a tuple) rather than matching CaseBank's stricter
// shape - cast through unknown once, here, so every other file that needs
// case data gets it already correctly typed instead of repeating this cast.
export const CASES: CaseBank = casesJson as unknown as CaseBank;

export function getCase(caseId: string): CaseDefinition {
  const caseDef = CASES[caseId];
  if (!caseDef) {
    throw new Error(`Unknown case "${caseId}".`);
  }
  return caseDef;
}
