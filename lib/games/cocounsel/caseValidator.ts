import type { Lang } from "@/lib/i18n/lang";
import type { CaseDefinition, CaseScreen } from "./caseTypes";

const HAND_SIZE = 3;

/** Every fact ID in the case, with where it lives - used to validate `contradicts` references. */
function allFactIds(caseDef: CaseDefinition): Set<string> {
  const ids = new Set<string>();
  for (const part of caseDef.parts) {
    for (const screen of ["investigator", "defendant"] as CaseScreen[]) {
      for (const fact of part.screens[screen].facts) ids.add(fact.id);
    }
  }
  return ids;
}

function pairKey(pair: [string, string]): string {
  return pair.join("+");
}

/** Common words too generic to give a correct pair away, even when both cards use them. */
const COMMON_WORDS: Record<Lang, Set<string>> = {
  en: new Set([
    "about", "after", "again", "before", "being", "could", "every", "never", "other", "still",
    "their", "there", "these", "those", "under", "until", "where", "which", "while", "would",
  ]),
  fr: new Set([
    "après", "avant", "encore", "jamais", "toujours", "autre", "autres", "chaque", "pendant", "depuis",
    "quand", "comme", "parce", "aussi", "alors", "ainsi", "entre", "notre", "votre", "leurs",
    "cette", "celle", "celui", "toute", "toutes", "était", "avait", "étais", "avais", "étaient",
    "avaient", "aurait", "serait", "pourrait", "étant", "quelle", "quelles", "tandis",
    // What an elision leaves once the apostrophe splits it: jusqu'à, lorsqu'il, aujourd'hui...
    "jusqu", "lorsqu", "puisqu", "quelqu", "aujourd",
  ]),
};

/**
 * Words: runs of letters (accented ones included) and digits, joined by
 * hyphens. English keeps an apostrophe inside a word ("didn't"); French splits
 * on it, so an elided article ("l'alarme") never hides the word ("alarme").
 */
const WORD_PATTERN: Record<Lang, RegExp> = {
  en: /[\p{L}\p{N}]+(?:[-'][\p{L}\p{N}]+)*/gu,
  fr: /[\p{L}\p{N}]+(?:-[\p{L}\p{N}]+)*/gu,
};

/** A card's distinctive words: 5+ letters, lowercased, minus common words. */
function distinctiveWords(text: string, lang: Lang): Set<string> {
  const words = text.toLowerCase().match(WORD_PATTERN[lang]) ?? [];
  return new Set(words.filter((w) => w.length >= 5 && !COMMON_WORDS[lang].has(w)));
}

/**
 * Validates a case against the rules in references/co-counsel/co-counsel-game-design.md's
 * "Content Rules" section. Returns a list of human-readable problems, empty if
 * the case is clean. Pure/no side effects - run against real shipped case data
 * in a Vitest test (mirroring how lib/games/ftw/prompts.test.ts validates
 * prompts.json), not as a runtime gate. `lang` is the case's language
 * (cases.json is English, cases.fr.json French): it picks how rule 5 splits
 * words and which common words it ignores.
 */
export function validateCase(caseDef: CaseDefinition, lang: Lang = "en"): string[] {
  const errors: string[] = [];
  const factIds = allFactIds(caseDef);

  caseDef.parts.forEach((part, partIndex) => {
    const label = `Part ${part.n}`;

    // 1. Exactly one correct pair, 3 cards per hand.
    for (const screen of ["investigator", "defendant"] as CaseScreen[]) {
      const hand = part.hands[screen];
      if (hand.length !== HAND_SIZE) {
        errors.push(`${label}: ${screen} hand has ${hand.length} cards, expected ${HAND_SIZE}.`);
      }
      const correctCount = hand.filter((c) => c.type === "correct").length;
      if (correctCount !== 1) {
        errors.push(`${label}: ${screen} hand has ${correctCount} "correct" cards, expected exactly 1.`);
      }
    }

    // 2. At least one trap pair, and traps are never the correct pair.
    if (part.traps.length === 0) {
      errors.push(`${label}: has no trap pairs.`);
    }
    const correctKey = pairKey(part.correct);
    for (const trap of part.traps) {
      if (pairKey(trap.pair) === correctKey) {
        errors.push(`${label}: a trap pair (${trap.pair.join(", ")}) is identical to the correct pair.`);
      }
    }

    // 3. Every `contradicts` entry refers to a real fact ID.
    for (const screen of ["investigator", "defendant"] as CaseScreen[]) {
      for (const card of part.hands[screen]) {
        for (const factId of card.contradicts) {
          if (!factIds.has(factId)) {
            errors.push(`${label}: card ${card.id} contradicts unknown fact "${factId}".`);
          }
        }
      }
    }

    // 4. From the Part AFTER the first one that actually uses memory lures
    //    onward, every later Part should keep using them - not a strict
    //    "every Part 2+" rule. The shipped case's own Part 2 has zero
    //    memoryLure cards (only Part 3 does), despite the design doc's prose
    //    saying "From Part 2 onward" - that's a looseness in the prose, not a
    //    real authoring gap, since Part 2 has no earlier Part's facts to lure
    //    with yet (Part 1 is the first Part with "earlier" facts to forget
    //    starting in Part 3). So this check only applies once memory lures
    //    have appeared at least once somewhere earlier in the case.
    const introducedMemoryLures = caseDef.parts
      .slice(0, partIndex)
      .some((p) => [...p.hands.investigator, ...p.hands.defendant].some((c) => c.type === "memoryLure"));
    if (partIndex > 0 && introducedMemoryLures) {
      const hasMemoryLure = [...part.hands.investigator, ...part.hands.defendant].some((c) => c.type === "memoryLure");
      if (!hasMemoryLure) {
        errors.push(`${label}: has no memory-lure card, but an earlier Part already introduced the mechanic.`);
      }
    }

    // 5. No keyword matching: the correct pair must not share a distinctive
    //    word, so players can't solve a Part by matching wording alone.
    const correctCards = part.correct.map((id) => [...part.hands.investigator, ...part.hands.defendant].find((c) => c.id === id));
    if (correctCards[0] && correctCards[1]) {
      const theirs = distinctiveWords(correctCards[1].text, lang);
      const shared = [...distinctiveWords(correctCards[0].text, lang)].filter((w) => theirs.has(w));
      if (shared.length) {
        errors.push(`${label}: the correct pair shares the word(s) ${shared.map((w) => `"${w}"`).join(", ")}, which gives it away.`);
      }
    }

    // 6. Decoys must be plausible - best-effort: just flag empty/very short text.
    for (const screen of ["investigator", "defendant"] as CaseScreen[]) {
      for (const card of part.hands[screen]) {
        if (card.text.trim().length < 5) {
          errors.push(`${label}: card ${card.id} text is too short to be a plausible claim ("${card.text}").`);
        }
      }
    }

    // 7 (partial, structural): a fact from an earlier Part should never be
    // listed as "contradicted" by that same earlier Part's own cards against
    // itself retroactively is nonsensical to check here; the meaningful
    // structural check is that every `contradicts` ID used by a card in this
    // Part either belongs to this Part or an earlier one, never a LATER Part
    // (a card can't contradict something that hasn't been revealed yet).
    const laterPartFactIds = new Set<string>();
    for (const laterPart of caseDef.parts.slice(partIndex + 1)) {
      for (const screen of ["investigator", "defendant"] as CaseScreen[]) {
        for (const fact of laterPart.screens[screen].facts) laterPartFactIds.add(fact.id);
      }
    }
    for (const screen of ["investigator", "defendant"] as CaseScreen[]) {
      for (const card of part.hands[screen]) {
        for (const factId of card.contradicts) {
          if (laterPartFactIds.has(factId)) {
            errors.push(`${label}: card ${card.id} contradicts fact "${factId}" from a later Part.`);
          }
        }
      }
    }
  });

  // 1 (continued) / final-part rule: every Part except the last has a theory;
  // the last Part has none (it resolves straight to the verdict instead).
  caseDef.parts.forEach((part, i) => {
    const isLast = i === caseDef.parts.length - 1;
    if (isLast && part.theory) {
      errors.push(`Part ${part.n}: is the final Part but has a "theory" - only earlier Parts should.`);
    }
    if (!isLast && !part.theory) {
      errors.push(`Part ${part.n}: is not the final Part but has no "theory".`);
    }
  });

  if (!caseDef.verdict.title.trim() || !caseDef.verdict.text.trim()) {
    errors.push("Case is missing a verdict title or text.");
  }
  if (!caseDef.teaser.trim()) {
    errors.push("Case is missing a teaser.");
  }
  if (!caseDef.characters.investigator.trim() || !caseDef.characters.defendant.trim()) {
    errors.push("Case is missing a character name for one of the two roles.");
  }

  return errors;
}
