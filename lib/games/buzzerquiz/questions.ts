import raw from "./questions.json";
import type { Question } from "./game";

/**
 * The question bank: `questions.json`, one question per line, hand-editable.
 * Each has exactly 4 choices with the right answer first (the game shuffles
 * them for display). `questions.test.ts` validates the whole file.
 */
export const QUESTIONS: readonly Question[] = raw as Question[];

const BY_ID = new Map(QUESTIONS.map((q) => [q.id, q]));

export function getQuestion(id: string): Question | undefined {
  return BY_ID.get(id);
}
