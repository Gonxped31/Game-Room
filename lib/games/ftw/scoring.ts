/**
 * Per-card exact match: an item's "number" is its index in an order array
 * (0-indexed here; +1 is purely a UI label). It matches when the master and
 * the guesser gave it the same index. Score = match count, 0 to 5. Because
 * of how permutations work, a score of exactly ITEMS_PER_ROUND - 1 (4 for a
 * 5-item round) is impossible: if four cards sit in their matching
 * position, the fifth has nowhere else to go but its own matching slot too.
 */
export function matchCount(masterOrder: string[], guessOrder: string[]): number {
  return masterOrder.filter((id, i) => guessOrder[i] === id).length;
}
