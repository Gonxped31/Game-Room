import type { Lang } from "@/lib/i18n/lang";
import { texts } from "@/lib/i18n/text";
import { ITEMS_PER_ROUND } from "./constants";

/**
 * A player's notes on the sheet while ranking or guessing: item ID -> rank
 * note (1 = best). Local to the device until locked in; only the filled item
 * IDs are shared (`current.placed`).
 */
export type Placement = Readonly<Record<string, number>>;

/** A picked note: from the hand (`from: null`) or lifted off an item for a swap. */
export type Pick = { n: number; from: string | null } | null;

/** The notes not on the sheet yet, in order. */
export function handNotes(placement: Placement): number[] {
  const used = new Set(Object.values(placement));
  return Array.from({ length: ITEMS_PER_ROUND }, (_, i) => i + 1).filter((n) => !used.has(n));
}

/** The item a note sits on, if any. */
export function itemWithNote(placement: Placement, n: number): string | null {
  return Object.keys(placement).find((id) => placement[id] === n) ?? null;
}

/**
 * Puts note `n` on `itemId`, wherever it was:
 * - from the hand: whatever note the item had goes back to the hand;
 * - from another item: the two swap (or the note just moves, if the item was empty);
 * - onto its own item: nothing changes.
 */
export function placeNote(placement: Placement, n: number, itemId: string): Placement {
  const from = itemWithNote(placement, n);
  if (from === itemId) return placement;
  const next: Record<string, number> = { ...placement, [itemId]: n };
  if (from != null) {
    const displaced = placement[itemId];
    if (displaced != null) next[from] = displaced;
    else delete next[from];
  }
  return next;
}

/** Sends an item's note back to the hand. */
export function removeNote(placement: Placement, itemId: string): Placement {
  if (placement[itemId] == null) return placement;
  const next = { ...placement };
  delete next[itemId];
  return next;
}

/** Tapping a hand note picks it, or puts it down again if it was already picked. */
export function tapHandNote(pick: Pick, n: number): Pick {
  return pick?.n === n && pick.from == null ? null : { n, from: null };
}

/**
 * Tapping an item (references/ftw/first-to-worst-game-design.md, "Item row"):
 * - with a note picked: places it there (tapping the item it came from cancels the pick);
 * - on a placed note: returns it to the hand, or, once the hand is empty,
 *   picks it up for a swap;
 * - on an empty item with nothing picked: nothing.
 */
export function tapItem(placement: Placement, pick: Pick, itemId: string): { placement: Placement; pick: Pick } {
  if (pick) {
    if (pick.from === itemId) return { placement, pick: null };
    return { placement: placeNote(placement, pick.n, itemId), pick: null };
  }
  const n = placement[itemId];
  if (n == null) return { placement, pick };
  if (handNotes(placement).length === 0) return { placement, pick: { n, from: itemId } };
  return { placement: removeNote(placement, itemId), pick: null };
}

/** The item IDs in rank order (1 first), for `lockIn`/`submitGuess`. */
export function rankOrder(placement: Placement, itemIds: string[]): string[] {
  return [...itemIds].sort((a, b) => (placement[a] ?? 0) - (placement[b] ?? 0));
}

const HEADLINES = texts({
  en: {
    all: { headline: "Same page!", line: `All ${ITEMS_PER_ROUND} in the same order.` },
    none: { headline: "Different books.", line: "No matches this time." },
    some: (matches: number) => `Same page on ${matches} of ${ITEMS_PER_ROUND}.`,
    close: "Close!",
    chapter: "Same chapter.",
    chapters: "Different chapters.",
  },
  fr: {
    all: { headline: "Même page !", line: `Les ${ITEMS_PER_ROUND} dans le même ordre.` },
    none: { headline: "Pas le même livre.", line: "Aucun point commun cette fois." },
    some: (matches) => `Même page pour ${matches} sur ${ITEMS_PER_ROUND}.`,
    close: "Presque !",
    chapter: "Même chapitre.",
    chapters: "Pas le même chapitre.",
  },
});

/** The result screen's headline and the line under it (references/ftw/first-to-worst-game-design.md, "Result headlines"), in the interface language. */
export function resultHeadline(matches: number, lang: Lang = "en"): { headline: string; line: string } {
  const t = HEADLINES[lang];
  if (matches >= ITEMS_PER_ROUND) return t.all;
  if (matches === 0) return t.none;
  const line = t.some(matches);
  if (matches >= 3) return { headline: t.close, line };
  if (matches === 2) return { headline: t.chapter, line };
  return { headline: t.chapters, line };
}
