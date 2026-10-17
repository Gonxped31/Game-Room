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

/** The case a brand-new room starts on, before its owner picks one. */
export const DEFAULT_CASE_ID = "ruined-birthday";

/**
 * The case a room's state points at, or the default one if that ID isn't
 * in this build (e.g. a case renamed or removed since the room was made) -
 * so a stale room still renders instead of crashing the page.
 */
export function caseForState(caseId: string | undefined): CaseDefinition {
  return (caseId && CASES[caseId]) || getCase(DEFAULT_CASE_ID);
}

export const CASE_TIERS: CaseDefinition["tier"][] = ["easy", "medium", "hard"];

/** Every case grouped by tier, in cases.json order within each tier. */
export function casesByTier(): { tier: CaseDefinition["tier"]; cases: CaseDefinition[] }[] {
  const all = Object.values(CASES);
  return CASE_TIERS.map((tier) => ({ tier, cases: all.filter((c) => c.tier === tier) }));
}
