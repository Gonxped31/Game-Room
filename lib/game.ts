import { ITEMS_PER_ROUND, Role } from "./constants";
import { matchCount } from "./scoring";

export type RoundStatus = "RANKING" | "GUESSING" | "REVEALED";

export interface RoundItem {
  id: string;
  label: string;
}

export interface CurrentRound {
  prompt: string;
  items: RoundItem[];
  status: RoundStatus;
  masterOrder?: string[];
  guessOrder?: string[];
  score?: number;
}

export interface GameState {
  round: number;
  totals: Record<Role, number>;
  current: CurrentRound;
  /**
   * Every distinct prompt text seen this session (shuffled past, custom-
   * written, or played), so the prompt bank doesn't repeat one within a
   * session until every built-in prompt has come up. Capped at the bank's
   * size since an already-seen prompt is never re-added - see addUsedPrompt.
   */
  usedPrompts: string[];
}

/** Records a prompt as seen this session, without duplicating an existing entry. */
export function addUsedPrompt(usedPrompts: string[] | undefined, prompt: string): string[] {
  const used = usedPrompts ?? [];
  return used.includes(prompt) ? used : [...used, prompt];
}

export const masterOf = (round: number): Role => (round % 2 === 1 ? "p1" : "p2");
export const guesserOf = (round: number): Role => (masterOf(round) === "p1" ? "p2" : "p1");

/** Builds a round's items with stable, human-readable IDs from a prompt + labels. */
export function makeRound(prompt: string, labels: string[]): CurrentRound {
  if (labels.length !== ITEMS_PER_ROUND) {
    throw new Error(`A round needs exactly ${ITEMS_PER_ROUND} items, got ${labels.length}.`);
  }
  return {
    prompt,
    status: "RANKING",
    items: labels.map((label, i) => ({
      id: `i${i}_${label.toLowerCase().replace(/\W+/g, "")}`,
      label,
    })),
  };
}

function isValidOrder(order: string[] | undefined, items: RoundItem[]): order is string[] {
  if (!order || order.length !== ITEMS_PER_ROUND) return false;
  if (new Set(order).size !== order.length) return false; // no duplicates
  const ids = new Set(items.map((i) => i.id));
  return order.every((id) => ids.has(id));
}

export function newGame(firstRound: CurrentRound): GameState {
  return { round: 1, totals: { p1: 0, p2: 0 }, current: firstRound, usedPrompts: [firstRound.prompt] };
}

/** RANKING -> GUESSING: the master locks in their ranking. */
export function lockIn(game: GameState, order: string[]): GameState {
  if (game.current.status !== "RANKING") {
    throw new Error(`Cannot lock in a ranking while status is ${game.current.status}.`);
  }
  if (!isValidOrder(order, game.current.items)) {
    throw new Error("Order must contain each round item's ID exactly once.");
  }
  return { ...game, current: { ...game.current, status: "GUESSING", masterOrder: order } };
}

/** GUESSING -> REVEALED: the guesser submits their guess and the round is scored. */
export function submitGuess(game: GameState, order: string[]): GameState {
  const { current } = game;
  if (current.status !== "GUESSING") {
    throw new Error(`Cannot submit a guess while status is ${current.status}.`);
  }
  if (!current.masterOrder) {
    throw new Error("Master ranking is missing.");
  }
  if (!isValidOrder(order, current.items)) {
    throw new Error("Order must contain each round item's ID exactly once.");
  }
  const score = matchCount(current.masterOrder, order);
  const guesser = guesserOf(game.round);
  return {
    ...game,
    totals: { ...game.totals, [guesser]: game.totals[guesser] + score },
    current: { ...current, status: "REVEALED", guessOrder: order, score },
  };
}

/**
 * Swaps in a different prompt/items while still RANKING (the master
 * shuffling or writing a custom prompt before locking in). Not a status
 * change - just replaces the round's content with a fresh, unstarted one.
 */
export function setPrompt(game: GameState, round: CurrentRound): GameState {
  if (game.current.status !== "RANKING") {
    throw new Error(`Cannot change the prompt while status is ${game.current.status}.`);
  }
  return { ...game, current: round, usedPrompts: addUsedPrompt(game.usedPrompts, round.prompt) };
}

/** REVEALED -> next round's RANKING. Roles swap because masterOf(round) alternates. */
export function nextRound(game: GameState, round: CurrentRound): GameState {
  if (game.current.status !== "REVEALED") {
    throw new Error(`Cannot advance to the next round while status is ${game.current.status}.`);
  }
  return { round: game.round + 1, totals: game.totals, current: round, usedPrompts: addUsedPrompt(game.usedPrompts, round.prompt) };
}
