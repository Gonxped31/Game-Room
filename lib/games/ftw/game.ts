import type { Role } from "@/lib/session/types";
import type { Lang } from "@/lib/games/shared/language";
import { DEFAULT_LANG } from "@/lib/i18n/lang";
import { ITEMS_PER_ROUND } from "./constants";
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
  /**
   * Which topic slots the player whose turn it is has filled so far (the
   * master while RANKING, the guesser while GUESSING), so the other player
   * can watch face-down cards appear live. Item IDs only, never numbers: the
   * other player can read this, so it must not reveal the ranking. Absent
   * when nothing is placed, and dropped whenever the phase changes.
   */
  placed?: string[];
}

export interface GameState {
  round: number;
  totals: Record<Role, number>;
  current: CurrentRound;
  /**
   * Every distinct prompt text seen this session (shuffled past, custom-
   * written, or played), so the prompt bank doesn't repeat one within a
   * session until every built-in prompt has come up. Capped at the two
   * banks' combined size (plus custom prompts) since an already-seen prompt
   * is never re-added - see addUsedPrompt.
   */
  usedPrompts: string[];
  /** One entry per completed (REVEALED) round this session, oldest first - the session recap. */
  history: RoundRecord[];
  /**
   * The prompt-bank groups prompts are drawn from - the master's choice, seen
   * by both. Absent means every topic - Firebase drops the empty array anyway.
   */
  topics?: string[];
  /**
   * The language built-in prompts are drawn in (prompts.json or
   * prompts.fr.json) - the master's choice, seen by both, applied from the
   * next prompt like `topics`. A new game starts in its creator's interface
   * language; rooms made before it have no field, which means English (read
   * it with `contentLang`).
   */
  lang?: Lang;
}

/** The room's content language: `lang`, or English for a room made before it existed. */
export const contentLang = (game: Pick<GameState, "lang">): Lang => game.lang ?? DEFAULT_LANG;

export interface RoundRecord {
  round: number;
  prompt: string;
  score: number;
  master: Role;
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

/** A fresh game: `firstRound` should come from the bank of `lang`, the content language (the creator's interface language for a new room). */
export function newGame(firstRound: CurrentRound, topics: string[] = [], lang: Lang = DEFAULT_LANG): GameState {
  const game: GameState = { round: 1, totals: { p1: 0, p2: 0 }, current: firstRound, usedPrompts: [firstRound.prompt], history: [], lang };
  return topics.length ? { ...game, topics } : game;
}

/**
 * The master (`by` must be this round's master, as for `setTopics`) chooses
 * the language built-in prompts are drawn in, at any point in the round; it
 * applies from the next prompt (Shuffle, Next round, Reset game).
 */
export function setLang(game: GameState, by: Role, lang: Lang): GameState {
  if (by !== masterOf(game.round)) {
    throw new Error("Only the master chooses the prompt language.");
  }
  if (lang !== "en" && lang !== "fr") {
    throw new Error("Unknown language.");
  }
  return { ...game, lang };
}

/** FNV-1a, in base 36: a short fingerprint of a string, the same on every device. */
function fingerprint(text: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(36);
}

/**
 * The id of the round on show once it's REVEALED (its result), else null: the
 * same on every device, for the "game finished" report (lib/tracking). Same
 * Page has no final result - rounds go on as long as the players like - so
 * each revealed round counts. The round number alone would repeat after
 * Reset game, so a fingerprint of what was played (the prompt and both
 * orders) goes with it. Letters, digits and "-" only.
 */
export function revealedRoundId(game: GameState): string | null {
  const { current } = game;
  if (current.status !== "REVEALED") return null;
  const played = [current.prompt, ...(current.masterOrder ?? []), "|", ...(current.guessOrder ?? [])].join("\n");
  return `r${game.round}-${fingerprint(played)}`;
}

/**
 * The master (`by` must be this round's master) chooses which topics prompts
 * are drawn from, at any point in the round; it applies from the next prompt.
 * `known` is the bank's groups, in bank order; the choice is kept in that
 * order, and choosing none (or every one) means every topic, stored as no
 * field at all.
 */
export function setTopics(game: GameState, by: Role, topics: string[], known: readonly string[]): GameState {
  if (by !== masterOf(game.round)) {
    throw new Error("Only the master chooses the topics.");
  }
  if (!topics.every((t) => known.includes(t))) {
    throw new Error("Unknown topic.");
  }
  const chosen = known.filter((t) => topics.includes(t));
  const rest = { ...game };
  delete rest.topics;
  return chosen.length && chosen.length < known.length ? { ...rest, topics: chosen } : rest;
}

/** The round without its live `placed` progress - built fresh (not set to undefined), since Firebase refuses an explicit undefined. */
function withoutPlaced(current: CurrentRound): CurrentRound {
  const rest = { ...current };
  delete rest.placed;
  return rest;
}

/**
 * Records which slots the placing player has filled so far (see
 * CurrentRound.placed). `phase` is the phase the placement was made in: a
 * placement that arrives after the phase has moved on (e.g. the master's last
 * one landing after they locked in) is refused rather than overwriting the
 * next player's progress.
 */
export function setPlaced(game: GameState, phase: "RANKING" | "GUESSING", placed: string[]): GameState {
  if (game.current.status !== phase) {
    throw new Error(`Cannot record ${phase} progress while status is ${game.current.status}.`);
  }
  const ids = new Set(game.current.items.map((i) => i.id));
  if (new Set(placed).size !== placed.length || placed.length > ITEMS_PER_ROUND || !placed.every((id) => ids.has(id))) {
    throw new Error("Placed slots must be distinct IDs of this round's items.");
  }
  const current = withoutPlaced(game.current);
  return { ...game, current: placed.length ? { ...current, placed } : current };
}

/** RANKING -> GUESSING: the master locks in their ranking. */
export function lockIn(game: GameState, order: string[]): GameState {
  if (game.current.status !== "RANKING") {
    throw new Error(`Cannot lock in a ranking while status is ${game.current.status}.`);
  }
  if (!isValidOrder(order, game.current.items)) {
    throw new Error("Order must contain each round item's ID exactly once.");
  }
  return { ...game, current: { ...withoutPlaced(game.current), status: "GUESSING", masterOrder: order } };
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
  const record: RoundRecord = { round: game.round, prompt: current.prompt, score, master: masterOf(game.round) };
  return {
    ...game,
    totals: { ...game.totals, [guesser]: game.totals[guesser] + score },
    current: { ...withoutPlaced(current), status: "REVEALED", guessOrder: order, score },
    history: [...(game.history ?? []), record],
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

/** REVEALED -> next round's RANKING (`round` drawn in `contentLang(game)`). Roles swap because masterOf(round) alternates. */
export function nextRound(game: GameState, round: CurrentRound): GameState {
  if (game.current.status !== "REVEALED") {
    throw new Error(`Cannot advance to the next round while status is ${game.current.status}.`);
  }
  // Every field is named explicitly, so each must have a value: Firebase
  // drops empty arrays, so `history` can read back missing - and Firebase
  // refuses to write an explicit `undefined`.
  const next: GameState = {
    round: game.round + 1,
    totals: game.totals,
    current: round,
    usedPrompts: addUsedPrompt(game.usedPrompts, round.prompt),
    history: game.history ?? [],
    ...(game.lang ? { lang: game.lang } : {}),
  };
  return game.topics?.length ? { ...next, topics: game.topics } : next;
}
