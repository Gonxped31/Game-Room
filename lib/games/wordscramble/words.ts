import raw from "./words.json";
import type { Word } from "./game";

/**
 * The word lists: `words.json`, one word per line, hand-editable, with the
 * real spelling (accents included). `words.test.ts` validates the whole file.
 */
export const WORDS: readonly Word[] = raw as Word[];

const BY_ID = new Map(WORDS.map((w) => [w.id, w]));

export function getWord(id: string | undefined): Word | undefined {
  return id ? BY_ID.get(id) : undefined;
}
