import type { Role, WithIdentity } from "@/lib/session/types";
import { BASE_WAGER, BLOCK_SIZE, TOTAL_ROUNDS } from "./constants";

export type Archetype = "emperor" | "citizen" | "slave";
/** The in-game role for this round - distinct from `Role` (p1/p2, the seat), since which seat holds which role rotates every block. */
export type EcRole = "emperor" | "slave";
export type RoundStatus = "PLACING" | "REVEALED";
/** The outcome of the most recent exchange: a tie (citizen vs citizen, round continues), or which role's card won. */
export type ExchangeResult = "tie" | EcRole;

export interface ECard {
  id: string;
  archetype: Archetype;
}

export interface Placement {
  role: EcRole;
  cardId: string;
  /** Captured at placement time - once a round resolves, the card itself is removed from the hand arrays, so this is the only record of what was actually played. */
  archetype: Archetype;
}

export interface RoundState {
  round: number;
  status: RoundStatus;
  /** Who places first this round - and first in every exchange within it, including after a tie. */
  initiative: EcRole;
  emperorHand: ECard[];
  slaveHand: ECard[];
  /** Cards removed from play via tied exchanges this round - display-only, not used by the logic. */
  discard: ECard[];
  firstPlacement?: Placement;
  secondPlacement?: Placement;
  /** Set once both placements exist (status REVEALED); absent while still PLACING. */
  result?: ExchangeResult;
}

export interface RoundRecord {
  round: number;
  winner: EcRole;
  winnerSeat: Role;
  payout: number;
}

export interface GameState extends WithIdentity {
  round: number;
  totals: Record<Role, number>;
  current: RoundState;
  /** One entry per decisively-completed round (ties aren't round-ending, so they don't get a record). */
  history: RoundRecord[];
}

/** Which seat (p1/p2) is Emperor this round: block = ceil(round/BLOCK_SIZE), odd blocks → p1, even → p2. 4 blocks of 3 over 12 rounds = a 6/6 split. */
export function emperorSeatOf(round: number): Role {
  const block = Math.ceil(round / BLOCK_SIZE);
  return block % 2 === 1 ? "p1" : "p2";
}

export function slaveSeatOf(round: number): Role {
  return emperorSeatOf(round) === "p1" ? "p2" : "p1";
}

/** Which in-game role a seat holds this round. */
export function ecRoleOfSeat(round: number, seat: Role): EcRole {
  return emperorSeatOf(round) === seat ? "emperor" : "slave";
}

/** Which seat holds a given in-game role this round - the inverse of ecRoleOfSeat. */
export function seatOfEcRole(round: number, ecRole: EcRole): Role {
  return ecRole === "emperor" ? emperorSeatOf(round) : slaveSeatOf(round);
}

/** Who places first this round (and first in every exchange within it): alternates by absolute round number. */
export function initiativeOf(round: number): EcRole {
  return round % 2 === 1 ? "emperor" : "slave";
}

// Realtime Database drops empty arrays entirely on write, so a field that
// starts as [] (history, discard, and hands once fully spent) round-trips
// as undefined, not []. Every read of one of these fields goes through this
// so the logic below never has to special-case "undefined vs empty".
function arr<T>(value: T[] | undefined): T[] {
  return value ?? [];
}

// Every exported function below normalizes its input through these before
// building a return value, so a round-tripped-through-Firebase `undefined`
// never gets re-spread (via `...game`/`...round`) into something we write
// back out. Firebase's transaction/set rejects a write containing an
// explicit `undefined` property outright ("Data returned contains
// undefined in property...") - it does NOT just silently drop it the way
// it does on the way *in*, so every array field has to be real by the time
// it leaves one of these functions, not just by the time it's read.
function normalizeRound(round: RoundState): RoundState {
  return { ...round, emperorHand: arr(round.emperorHand), slaveHand: arr(round.slaveHand), discard: arr(round.discard) };
}
function normalizeGame(game: GameState): GameState {
  return { ...game, history: arr(game.history), current: normalizeRound(game.current) };
}

/** Which role should place next, or null once both have placed (status REVEALED). */
export function nextToPlace(round: RoundState): EcRole | null {
  if (round.status !== "PLACING") return null;
  if (!round.firstPlacement) return round.initiative;
  if (!round.secondPlacement) return round.initiative === "emperor" ? "slave" : "emperor";
  return null;
}

function buildHand(role: EcRole): ECard[] {
  const special: Archetype = role === "emperor" ? "emperor" : "slave";
  return [
    { id: `${role}-special`, archetype: special },
    { id: `${role}-c1`, archetype: "citizen" },
    { id: `${role}-c2`, archetype: "citizen" },
    { id: `${role}-c3`, archetype: "citizen" },
    { id: `${role}-c4`, archetype: "citizen" },
  ];
}

function startRound(round: number): RoundState {
  return {
    round,
    status: "PLACING",
    initiative: initiativeOf(round),
    emperorHand: buildHand("emperor"),
    slaveHand: buildHand("slave"),
    discard: [],
  };
}

export function newGame(): GameState {
  return { round: 1, totals: { p1: 0, p2: 0 }, current: startRound(1), names: {}, history: [] };
}

/** Archetype hierarchy: emperor > citizen > slave > emperor. Citizen vs citizen is the only possible tie - a side only ever holds one of its own special card, so emperor-vs-emperor/slave-vs-slave can't occur. */
function resolveExchange(a: { role: EcRole; archetype: Archetype }, b: { role: EcRole; archetype: Archetype }): ExchangeResult {
  if (a.archetype === b.archetype) return "tie";
  const BEATS: Record<Archetype, Archetype> = { emperor: "citizen", citizen: "slave", slave: "emperor" };
  if (BEATS[a.archetype] === b.archetype) return a.role;
  if (BEATS[b.archetype] === a.archetype) return b.role;
  throw new Error(`Unreachable archetype pairing: ${a.archetype} vs ${b.archetype}`);
}

const PAYOUT_MULTIPLIER: Record<EcRole, number> = { emperor: 1, slave: 5 };

/** Places a card face-down for `role` - the first placement of an exchange, or the second (which immediately reveals and resolves it). */
export function placeCard(rawGame: GameState, role: EcRole, cardId: string): GameState {
  const game = normalizeGame(rawGame);
  const round = game.current;
  if (round.status !== "PLACING") {
    throw new Error(`Cannot place a card while status is ${round.status}.`);
  }
  if (nextToPlace(round) !== role) {
    throw new Error(`It is not ${role}'s turn to place.`);
  }
  const hand = role === "emperor" ? round.emperorHand : round.slaveHand;
  const cardInHand = hand.find((c) => c.id === cardId);
  if (!cardInHand) {
    throw new Error(`Card ${cardId} is not in ${role}'s hand.`);
  }

  const placement: Placement = { role, cardId, archetype: cardInHand.archetype };
  if (!round.firstPlacement) {
    return { ...game, current: { ...round, firstPlacement: placement } };
  }

  // Second placement - reveal and resolve. The two placements are always
  // from different roles (nextToPlace guarantees it), so exactly one of
  // {emperorHand, slaveHand} loses the first card and the other loses the second.
  const first = round.firstPlacement;
  const emperorPlacement = first.role === "emperor" ? first : placement;
  const slavePlacement = first.role === "slave" ? first : placement;

  const outcome = resolveExchange(
    { role: "emperor", archetype: emperorPlacement.archetype },
    { role: "slave", archetype: slavePlacement.archetype },
  );
  const emperorHand = round.emperorHand.filter((c) => c.id !== emperorPlacement.cardId);
  const slaveHand = round.slaveHand.filter((c) => c.id !== slavePlacement.cardId);
  const tie = outcome === "tie";

  const revealedRound: RoundState = {
    ...round,
    status: "REVEALED",
    firstPlacement: first,
    secondPlacement: placement,
    emperorHand,
    slaveHand,
    discard: tie
      ? [...round.discard, { id: emperorPlacement.cardId, archetype: emperorPlacement.archetype }, { id: slavePlacement.cardId, archetype: slavePlacement.archetype }]
      : round.discard,
    result: outcome,
  };

  if (tie) {
    return { ...game, current: revealedRound };
  }

  const winnerSeat = seatOfEcRole(game.round, outcome);
  const payout = BASE_WAGER * PAYOUT_MULTIPLIER[outcome];
  const record: RoundRecord = { round: game.round, winner: outcome, winnerSeat, payout };
  return {
    ...game,
    current: revealedRound,
    totals: { ...game.totals, [winnerSeat]: game.totals[winnerSeat] + payout },
    history: [...game.history, record],
  };
}

/** Tie -> fresh exchange, same round, same initiative, shrunken hands already in place. */
export function continueRound(rawGame: GameState): GameState {
  const game = normalizeGame(rawGame);
  const round = game.current;
  if (round.status !== "REVEALED" || round.result !== "tie") {
    throw new Error("Can only continue the round after a tied exchange.");
  }
  // Firebase rejects a write containing an explicit `undefined` property
  // outright, so firstPlacement/secondPlacement/result have to be omitted
  // entirely (not set to undefined) to clear them - hence a fresh object
  // instead of spreading `...round` and nulling fields.
  return {
    ...game,
    current: {
      round: round.round,
      status: "PLACING",
      initiative: round.initiative,
      emperorHand: round.emperorHand,
      slaveHand: round.slaveHand,
      discard: round.discard,
    },
  };
}

export function isGameComplete(game: GameState): boolean {
  return game.round >= TOTAL_ROUNDS && game.current.status === "REVEALED" && game.current.result !== undefined && game.current.result !== "tie";
}

/** Decisive result -> next round's fresh deal. Seats swap according to the schedule, not by choice. */
export function nextRound(rawGame: GameState): GameState {
  const game = normalizeGame(rawGame);
  const round = game.current;
  if (round.status !== "REVEALED" || round.result === undefined || round.result === "tie") {
    throw new Error("Can only advance to the next round after a decisive result.");
  }
  if (game.round >= TOTAL_ROUNDS) {
    throw new Error(`The game is already complete (${TOTAL_ROUNDS} rounds played).`);
  }
  const next = game.round + 1;
  return { ...game, round: next, current: startRound(next) };
}
