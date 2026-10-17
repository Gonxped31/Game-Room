import { ITEMS_PER_ROUND, MAX_ITEM_LENGTH, MAX_PROMPT_LENGTH } from "./constants";
import { type CurrentRound, makeRound } from "./game";
import promptsByGroup from "./prompts.json";

export interface PromptEntry {
  prompt: string;
  items: string[];
  /** The prompt's category in prompts.json - a topic players can choose (TOPICS). */
  group: string;
}

/**
 * Interleaves entries so no more than `maxRun` consecutive prompts share a
 * group - always picking from whichever remaining group has the most
 * entries left, which is the simplest way to guarantee this never needs to
 * fall back to a forced violation (as long as no single group has more than
 * half the total, which holds here by a wide margin). Deterministic given
 * the same input, so editing prompts.json and reloading always produces the
 * same order - no separate "run a script to reorder" step, unlike the flat
 * array this replaced.
 */
function interleaveByGroup<T extends { group: string }>(entries: T[], maxRun: number): T[] {
  const buckets = new Map<string, T[]>();
  for (const entry of entries) {
    if (!buckets.has(entry.group)) buckets.set(entry.group, []);
    buckets.get(entry.group)!.push(entry);
  }

  const result: T[] = [];
  let lastGroup: string | null = null;
  let runLength = 0;

  while (result.length < entries.length) {
    const candidates = [...buckets.entries()]
      .filter(([, remaining]) => remaining.length > 0)
      .sort((a, b) => b[1].length - a[1].length);

    const pick = candidates.find(([group]) => group !== lastGroup || runLength < maxRun) ?? candidates[0];
    const [group, remaining] = pick;
    result.push(remaining.shift()!);
    runLength = group === lastGroup ? runLength + 1 : 1;
    lastGroup = group;
  }

  return result;
}

/**
 * Built-in prompt bank, authored in prompts.json grouped by category (so
 * adding a prompt is "find your category's array, add an entry" - no need
 * to touch this file, pick an insertion point, or worry about ordering).
 * Every entry must have exactly ITEMS_PER_ROUND unique items - see
 * prompts.test.ts. The categories are the topics players can choose from
 * (TOPICS, shown by TopicPicker); PROMPTS itself is a flat, reordered array.
 */
export const PROMPTS: PromptEntry[] = interleaveByGroup(
  Object.entries(promptsByGroup as Record<string, { prompt: string; items: string[] }[]>).flatMap(([group, entries]) =>
    entries.map((entry) => ({ ...entry, group })),
  ),
  2,
);

/** The bank's groups (the topics players can choose from), in prompts.json order. */
export const TOPICS: readonly string[] = Object.keys(promptsByGroup);

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * Picks a random built-in prompt from the chosen `topics` (every topic when
 * none are chosen), excluding every prompt in `usedPrompts` (the session's
 * history, so nothing repeats until those topics have all come up). Once that
 * exhausts the pool, it cycles: picks from those topics again, still avoiding
 * an immediate repeat of the very last prompt.
 */
export function randomRound(usedPrompts: string[] = [], topics: string[] = []): CurrentRound {
  const chosen = PROMPTS.filter((p) => topics.includes(p.group));
  const bank = chosen.length ? chosen : PROMPTS;
  const avoid = new Set(usedPrompts);
  let pool = bank.filter((p) => !avoid.has(p.prompt));
  if (pool.length === 0) {
    const last = usedPrompts[usedPrompts.length - 1];
    pool = bank.filter((p) => p.prompt !== last);
    if (pool.length === 0) pool = bank; // only reachable if the topics hold a single prompt
  }
  const choice = pool[Math.floor(Math.random() * pool.length)];
  return makeRound(choice.prompt, shuffle(choice.items));
}

/** Builds a round from a player-submitted prompt + exactly ITEMS_PER_ROUND items, shuffled. */
export function customRound(prompt: string, items: string[]): CurrentRound {
  if (items.length !== ITEMS_PER_ROUND) {
    throw new Error(`A custom prompt needs exactly ${ITEMS_PER_ROUND} items, got ${items.length}.`);
  }
  if (prompt.length > MAX_PROMPT_LENGTH) {
    throw new Error(`A prompt can be at most ${MAX_PROMPT_LENGTH} characters.`);
  }
  if (items.some((item) => item.length > MAX_ITEM_LENGTH)) {
    throw new Error(`Each item can be at most ${MAX_ITEM_LENGTH} characters.`);
  }
  return makeRound(prompt, shuffle(items));
}
