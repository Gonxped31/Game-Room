import type { Role, WithIdentity } from "@/lib/session/types";
import { DEFENDANT, INVESTIGATOR, MAX_CASE_ATTEMPTS } from "./constants";
import type { CaseCard, CaseDefinition, CasePart, CaseScreen } from "./caseTypes";

export type Phase = "SELECTING" | "REVEALED" | "CASE_DONE";

export type AttemptOutcome = "solved" | "trap" | "wrong" | "judgeRevealed" | "adjourned";

export interface AttemptLogEntry {
  partIndex: number;
  investigatorCard: string;
  defendantCard: string;
  outcome: AttemptOutcome;
  /** 0-2: one flag can come from each of the two played cards. */
  trustFlags: number;
  focusFlags: number;
}

export interface RevealInfo {
  outcome: "solved" | "retry" | "judgeRevealed" | "adjourned";
  /**
   * The pair to DISPLAY - the correct pair when judgeRevealed (the attempt
   * budget ran out on the case's LAST Part, so the judge gives the answer on
   * the way out), otherwise whatever was actually just played. "adjourned"
   * (the budget ran out on an EARLIER Part) deliberately never reveals the
   * correct pair - the case is dismissed without a resolution.
   */
  investigatorCardId: string;
  defendantCardId: string;
  solvedOnFirstTry?: boolean;
}

export interface GameState extends WithIdentity {
  caseId: string;
  partIndex: number;
  /** Misses so far across the WHOLE case - carries over between Parts, never resets until a new game. */
  attempts: number;
  phase: Phase;
  locks: Partial<Record<Role, string>>;
  log: AttemptLogEntry[];
  lastReveal?: RevealInfo;
}

export function screenOfRole(role: Role): CaseScreen {
  return role === INVESTIGATOR ? "investigator" : "defendant";
}

function otherRoleOf(role: Role): Role {
  return role === INVESTIGATOR ? DEFENDANT : INVESTIGATOR;
}

// Realtime Database drops empty arrays AND empty objects entirely on write
// (confirmed while building E-Card - see CLAUDE.md's Conventions, 'Realtime Database data shapes'), so
// `locks`/`log` can round-trip as undefined once the room has gone through a
// moment where they were empty. Every read goes through this so the rest of
// this file never has to special-case "undefined vs empty".
function normalizeGame(game: GameState): GameState {
  return { ...game, locks: game.locks ?? {}, log: game.log ?? [] };
}

function currentPart(caseDef: CaseDefinition, game: GameState): CasePart {
  const part = caseDef.parts[game.partIndex];
  if (!part) {
    throw new Error(`No Part at index ${game.partIndex} for case ${caseDef.id}.`);
  }
  return part;
}

export function newGame(caseId: string): GameState {
  return { caseId, partIndex: 0, attempts: 0, phase: "SELECTING", locks: {}, log: [], names: {} };
}

/** Which fact IDs a played card contradicts, and what flag (if any) that raises for `holder`. */
function flagsFor(caseDef: CaseDefinition, partIndex: number, holder: CaseScreen, card: CaseCard): { trust: number; focus: number } {
  let trust = 0;
  let focus = 0;
  for (const factId of card.contradicts) {
    let foundAt: { partIndex: number; screen: CaseScreen } | null = null;
    for (const [i, part] of caseDef.parts.entries()) {
      for (const screen of ["investigator", "defendant"] as CaseScreen[]) {
        if (part.screens[screen].facts.some((f) => f.id === factId)) {
          foundAt = { partIndex: i, screen };
        }
      }
    }
    if (!foundAt) continue; // caseValidator catches unknown fact IDs before this ever ships
    if (foundAt.partIndex < partIndex) {
      focus += 1;
    } else if (foundAt.partIndex === partIndex && foundAt.screen !== holder) {
      trust += 1;
    }
    // same-part, own-screen contradiction: no flag, just a wrong answer.
  }
  return { trust, focus };
}

/**
 * Locks in `role`'s card for the current Part's current attempt. Once both
 * roles have locked in, resolves the pair immediately (no separate "reveal"
 * action) and records the attempt. Misses draw from a case-wide budget
 * (MAX_CASE_ATTEMPTS), not a per-Part one - the judge moment can happen on
 * the very first miss of a Part if an earlier Part already used up the rest
 * of the budget.
 */
export function lockIn(rawGame: GameState, caseDef: CaseDefinition, role: Role, cardId: string): GameState {
  const game = normalizeGame(rawGame);
  if (game.phase !== "SELECTING") {
    throw new Error(`Cannot lock in a card while phase is ${game.phase}.`);
  }
  if (game.locks[role]) {
    throw new Error(`${role} has already locked in a card this attempt.`);
  }
  const part = currentPart(caseDef, game);
  const screen = screenOfRole(role);
  const hand = part.hands[screen];
  if (!hand.some((c) => c.id === cardId)) {
    throw new Error(`Card ${cardId} is not in ${role}'s hand for Part ${part.n}.`);
  }

  const locks = { ...game.locks, [role]: cardId };
  const partner = otherRoleOf(role);
  if (!locks[partner]) {
    return { ...game, locks };
  }

  // Both locked in - resolve the pair.
  const investigatorCardId = locks[INVESTIGATOR]!;
  const defendantCardId = locks[DEFENDANT]!;
  const investigatorCard = part.hands.investigator.find((c) => c.id === investigatorCardId)!;
  const defendantCard = part.hands.defendant.find((c) => c.id === defendantCardId)!;
  const iFlags = flagsFor(caseDef, game.partIndex, "investigator", investigatorCard);
  const dFlags = flagsFor(caseDef, game.partIndex, "defendant", defendantCard);
  const trustFlags = iFlags.trust + dFlags.trust;
  const focusFlags = iFlags.focus + dFlags.focus;

  const isCorrect = part.correct[0] === investigatorCardId && part.correct[1] === defendantCardId;

  if (isCorrect) {
    const entry: AttemptLogEntry = { partIndex: game.partIndex, investigatorCard: investigatorCardId, defendantCard: defendantCardId, outcome: "solved", trustFlags, focusFlags };
    return {
      ...game,
      locks,
      phase: "REVEALED",
      log: [...game.log, entry],
      lastReveal: { outcome: "solved", investigatorCardId, defendantCardId, solvedOnFirstTry: game.attempts === 0 },
    };
  }

  const nextAttempts = game.attempts + 1;
  const isLastPart = game.partIndex >= caseDef.parts.length - 1;
  // Running out of the case-wide attempt budget ends the whole case right
  // here, not just this Part (see continueAfterReveal below) - but the
  // correct pair is only ever revealed if this happens to be the case's
  // last Part ("judgeRevealed"); anywhere earlier ("adjourned") the case is
  // dismissed without ever giving the answer.
  const isCapReached = nextAttempts >= MAX_CASE_ATTEMPTS;
  const isTrap = part.traps.some((t) => t.pair[0] === investigatorCardId && t.pair[1] === defendantCardId);
  const outcome: AttemptOutcome = !isCapReached ? (isTrap ? "trap" : "wrong") : isLastPart ? "judgeRevealed" : "adjourned";
  const entry: AttemptLogEntry = { partIndex: game.partIndex, investigatorCard: investigatorCardId, defendantCard: defendantCardId, outcome, trustFlags, focusFlags };

  let lastReveal: RevealInfo;
  if (!isCapReached) {
    lastReveal = { outcome: "retry", investigatorCardId, defendantCardId };
  } else if (isLastPart) {
    lastReveal = { outcome: "judgeRevealed", investigatorCardId: part.correct[0], defendantCardId: part.correct[1] };
  } else {
    lastReveal = { outcome: "adjourned", investigatorCardId, defendantCardId };
  }

  return {
    ...game,
    locks,
    attempts: nextAttempts,
    phase: "REVEALED",
    log: [...game.log, entry],
    lastReveal,
  };
}

/**
 * Advances past a reveal: a retry clears the locks and goes back to
 * SELECTING for another attempt at the same Part; a solved Part advances to
 * the next Part, or to CASE_DONE if that was the last one. Running out of
 * the case-wide attempt budget ("judgeRevealed" or "adjourned") always goes
 * straight to CASE_DONE instead, regardless of which Part it happened on -
 * see lockIn's isCapReached handling for how those two differ.
 * `attempts` is never reset here - the miss budget is case-wide, not
 * per-Part, so it has to carry across this transition unchanged.
 */
export function continueAfterReveal(rawGame: GameState, caseDef: CaseDefinition): GameState {
  const game = normalizeGame(rawGame);
  const { lastReveal } = game;
  if (game.phase !== "REVEALED" || !lastReveal) {
    throw new Error(`Cannot continue after a reveal while phase is ${game.phase}.`);
  }
  // Firebase rejects a write containing an explicit `undefined` property, so
  // lastReveal has to be omitted entirely (not set to undefined) to clear it
  // - same lesson as E-Card's continueRound. Rebuilding the object explicitly
  // (rather than spreading `...game` and nulling the field) is what omits it.
  const base: Omit<GameState, "lastReveal"> = {
    caseId: game.caseId,
    partIndex: game.partIndex,
    attempts: game.attempts,
    phase: game.phase,
    locks: game.locks,
    log: game.log,
    names: game.names,
  };

  if (lastReveal.outcome === "retry") {
    return { ...base, phase: "SELECTING", locks: {} };
  }

  // "judgeRevealed"/"adjourned" both mean the case-wide attempt budget ran
  // out - the case ends right here regardless of Part index, unlike a
  // genuine "solved", which is the only outcome that can still advance to
  // the next Part.
  if (lastReveal.outcome !== "solved") {
    return { ...base, phase: "CASE_DONE", locks: {} };
  }

  const isLastPart = game.partIndex >= caseDef.parts.length - 1;
  if (isLastPart) {
    return { ...base, phase: "CASE_DONE", locks: {} };
  }
  return { ...base, phase: "SELECTING", partIndex: game.partIndex + 1, locks: {} };
}

/** 100 x (1 - trustFlags / totalLockIns), clamped to [0,100]. No lock-ins yet = a perfect score (nothing to distrust). */
export function trustPercent(log: AttemptLogEntry[] | undefined): number {
  const entries = log ?? [];
  if (entries.length === 0) return 100;
  const trustFlags = entries.reduce((sum, e) => sum + e.trustFlags, 0);
  return Math.max(0, Math.min(100, 100 * (1 - trustFlags / entries.length)));
}

/** 100 x (1 - focusFlags / lock-ins in Part 2+), clamped to [0,100]. Part 1 has no earlier facts, so it's excluded - no Part-2+ lock-ins yet = a perfect score. */
export function focusPercent(log: AttemptLogEntry[] | undefined): number {
  const entries = (log ?? []).filter((e) => e.partIndex > 0);
  if (entries.length === 0) return 100;
  const focusFlags = entries.reduce((sum, e) => sum + e.focusFlags, 0);
  return Math.max(0, Math.min(100, 100 * (1 - focusFlags / entries.length)));
}

export function totalAttempts(log: AttemptLogEntry[] | undefined): number {
  return (log ?? []).length;
}

export type DuoClassification = "Mind-Reading Team" | "Loyal, Slightly Forgetful" | "Sharp, Slightly Suspicious" | "Solid Partners" | "Still Learning Each Other";

/** Evaluated top to bottom, first match wins - see the design doc's Duo classification table. */
export function classifyDuo(trust: number, focus: number): DuoClassification {
  if (trust >= 90 && focus >= 90) return "Mind-Reading Team";
  if (trust >= 90) return "Loyal, Slightly Forgetful";
  if (focus >= 90) return "Sharp, Slightly Suspicious";
  if (trust >= 70 && focus >= 70) return "Solid Partners";
  return "Still Learning Each Other";
}
