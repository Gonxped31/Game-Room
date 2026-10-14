import { ITEMS_PER_ROUND } from "./constants";
import { type CurrentRound, makeRound } from "./game";
import promptsByGroup from "./prompts.json";

export interface PromptEntry {
  prompt: string;
  items: string[];
  /** Dev-only categorization tag for auditing topic coverage - never shown in the UI. */
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
 * prompts.test.ts. The category grouping in the JSON is dev-only (never
 * shown in the UI); PROMPTS itself is a flat, reordered array so
 * randomRound doesn't need to know groups exist at all.
 */
export const PROMPTS: PromptEntry[] = interleaveByGroup(
  Object.entries(promptsByGroup as Record<string, { prompt: string; items: string[] }[]>).flatMap(([group, entries]) =>
    entries.map((entry) => ({ ...entry, group })),
  ),
  2,
);

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * Picks a random built-in prompt, excluding every prompt in `usedPrompts`
 * (the session's history, so nothing repeats until the whole bank has come
 * up). Once that exhausts the pool, it cycles: picks from the full bank
 * again, still avoiding an immediate repeat of the very last prompt.
 */
export function randomRound(usedPrompts: string[] = []): CurrentRound {
  const avoid = new Set(usedPrompts);
  let pool = PROMPTS.filter((p) => !avoid.has(p.prompt));
  if (pool.length === 0) {
    const last = usedPrompts[usedPrompts.length - 1];
    pool = PROMPTS.filter((p) => p.prompt !== last);
    if (pool.length === 0) pool = PROMPTS; // only reachable if the whole bank is a single prompt
  }
  const choice = pool[Math.floor(Math.random() * pool.length)];
  return makeRound(choice.prompt, shuffle(choice.items));
}

/** Builds a round from a player-submitted prompt + exactly ITEMS_PER_ROUND items, shuffled. */
export function customRound(prompt: string, items: string[]): CurrentRound {
  if (items.length !== ITEMS_PER_ROUND) {
    throw new Error(`A custom prompt needs exactly ${ITEMS_PER_ROUND} items, got ${items.length}.`);
  }
  return makeRound(prompt, shuffle(items));
}
