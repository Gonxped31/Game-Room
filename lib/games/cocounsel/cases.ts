import type { Lang } from "@/lib/i18n/lang";
import casesJson from "./cases.json";
import casesFrJson from "./cases.fr.json";
import type { CaseBank, CaseDefinition } from "./caseTypes";

// JSON imports infer widened types (string instead of a literal union,
// string[] instead of a tuple) rather than matching CaseBank's stricter
// shape - cast through unknown once, here, so every other file that needs
// case data gets it already correctly typed instead of repeating this cast.
/** The English cases (the original bank; every case ID is defined here first). */
export const CASES: CaseBank = casesJson as unknown as CaseBank;

/**
 * Every case in each language. cases.fr.json mirrors cases.json key for key:
 * the same case IDs, Part numbers, card and fact IDs and logic (types,
 * contradicts, correct pairs, traps); only the words differ. The tests
 * (caseValidator.test.ts) check that parity, so a room can switch language
 * without the shared state's card IDs going stale.
 */
export const CASES_BY_LANG: Record<Lang, CaseBank> = {
  en: CASES,
  fr: casesFrJson as unknown as CaseBank,
};

export function getCase(caseId: string, lang: Lang = "en"): CaseDefinition {
  const caseDef = CASES_BY_LANG[lang][caseId];
  if (!caseDef) {
    throw new Error(`Unknown case "${caseId}" (${lang}).`);
  }
  return caseDef;
}

/** The case a brand-new room starts on, before its owner picks one. */
export const DEFAULT_CASE_ID = "ruined-birthday";

/**
 * The case a room's state points at, in `lang`, or the default one if that ID
 * isn't in this build (e.g. a case renamed or removed since the room was
 * made) - so a stale room still renders instead of crashing the page.
 */
export function caseForState(caseId: string | undefined, lang: Lang = "en"): CaseDefinition {
  return (caseId && CASES_BY_LANG[lang][caseId]) || getCase(DEFAULT_CASE_ID, lang);
}

export const CASE_TIERS: CaseDefinition["tier"][] = ["easy", "medium", "hard"];

/** Every case in `lang` grouped by tier, in the JSON file's order within each tier. */
export function casesByTier(lang: Lang = "en"): { tier: CaseDefinition["tier"]; cases: CaseDefinition[] }[] {
  const all = Object.values(CASES_BY_LANG[lang]);
  return CASE_TIERS.map((tier) => ({ tier, cases: all.filter((c) => c.tier === tier) }));
}
