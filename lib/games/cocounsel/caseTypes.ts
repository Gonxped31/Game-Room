/** Which screen/hand a fact or card belongs to. */
export type CaseScreen = "investigator" | "defendant";

export interface CaseFact {
  id: string;
  text: string;
}

export type CardType = "correct" | "trap" | "decoy" | "memoryLure";

export interface CaseCard {
  id: string;
  text: string;
  type: CardType;
  /** Fact IDs this card contradicts - drives Trust/Focus flags, see lib/games/cocounsel/game.ts. */
  contradicts: string[];
}

export interface CasePartScreen {
  info: string;
  facts: CaseFact[];
}

export interface CasePart {
  n: number;
  title: string;
  screens: {
    investigator: CasePartScreen;
    defendant: CasePartScreen;
  };
  hands: {
    investigator: CaseCard[];
    defendant: CaseCard[];
  };
  /** [investigatorCardId, defendantCardId] - the one correct pair for this Part. */
  correct: [string, string];
  /** Wrong-but-plausible pairs, for content-authoring reference - the validator checks these are never the correct pair. */
  traps: { pair: [string, string] }[];
  /**
   * Shown once this Part resolves (solved or judge-revealed) - absent on the
   * case's last Part, since "only the final Part produces a verdict" (solving
   * it goes straight to the verdict screen instead of a working-theory stamp).
   */
  theory?: string;
}

export interface CaseVerdict {
  title: string;
  text: string;
}

export interface CaseDefinition {
  id: string;
  tier: "easy" | "medium" | "hard";
  title: string;
  /** Spoiler-free teaser shown on the "pick a case" screen - must never reveal either player's private info. */
  teaser: string;
  /** The in-story character names for each role, e.g. { investigator: "Maya", defendant: "Leo" } - players never type their own name for this game. */
  characters: Record<CaseScreen, string>;
  parts: CasePart[];
  verdict: CaseVerdict;
}

/** The shape of cases.json: every case, keyed by its id. */
export type CaseBank = Record<string, CaseDefinition>;
