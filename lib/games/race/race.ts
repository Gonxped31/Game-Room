import type { SeatId, WithMultiplayerIdentity } from "@/lib/session/types";

/**
 * Racing others in a solo game (Border Run, Checkmate Grid): everyone plays
 * the same round at the same moment, round after round.
 *
 * - **Challenge** (2-4 players): a set number of rounds; the lowest total
 *   time (with the game's penalty) wins.
 * - **Survival** (4-8 players): after each round the slowest are knocked out
 *   (two while more than 4 are left, then one) until one is left.
 *
 * The room's state (`games/{room}/{slug}`) holds the round and the results;
 * each player's moves live in `{slug}Runs/{seat}`, which only that seat
 * writes (8 players at once would fight over one transaction). A round ends
 * at its deadline, or as soon as every player still in is done; any device
 * that sees it transacts `endRound`, which replays everyone's run itself.
 *
 * A game plugs in with a `RaceSpec` (what a round is, how a run scores) and
 * gets its transitions from `createRace`.
 */

export type Mode = "challenge" | "survival";
export const MODES: readonly Mode[] = ["challenge", "survival"];
export const MODE_NAME: Record<Mode, string> = { challenge: "Challenge", survival: "Survival" };

/** Rounds in a challenge. */
export const ROUND_COUNTS = [3, 5] as const;
export type RoundCount = (typeof ROUND_COUNTS)[number];

/** How many players each mode takes. A private room has 8 seats; a public one, the mode's most. */
export const PLAYERS: Record<Mode, { min: number; max: number }> = {
  challenge: { min: 2, max: 4 },
  survival: { min: 4, max: 8 },
};
export const ROOM_SEATS = 8;

/** "3, 2, 1" before each round. */
export const COUNTDOWN_MS = 4_000;
/** How long a round's results show before the next round (or the final standings). */
export const RESULTS_MS = 12_000;
/** A round not finished counts in a challenge's total as the slowest finish (at least the time limit), plus this. */
export const DNF_EXTRA_MS = 30_000;
/** The most rounds a game can last (the rules check the same): a survival that keeps tying ends there. */
export const MAX_ROUNDS = 10;

/** One player's round: their time to finish (or the limit), the penalties, how far they got, and whether they finished. */
export interface RoundScore {
  ms: number;
  extra: number;
  found: number;
  done: boolean;
}

export interface RoundResult {
  scores: Partial<Record<SeatId, RoundScore>>;
  /** Survival: who was knocked out after this round. */
  out: SeatId[];
}

export type Phase = "lobby" | "round" | "results" | "over";

/** What every race's state has; each game adds its settings and its round's content. */
export interface RaceCore extends WithMultiplayerIdentity {
  phase: Phase;
  mode: Mode;
  rounds: RoundCount;
  /** Everyone who started this game. */
  players: SeatId[];
  /** Still in (survival); everyone (challenge). */
  alive: SeatId[];
  /** The current round, from 0. */
  round: number;
  /** Server ms: the round starts (after the countdown), its time limit, the next round. 0 when unset. */
  startsAt: number;
  endsAt: number;
  nextAt: number;
  results: RoundResult[];
}

/**
 * One player's round as they send it (`{slug}Runs/{seat}`). `at` is the
 * round's `startsAt`, which no other round shares (not even a rematch's first
 * round), so last round's moves never count in this one.
 */
export interface RunCore {
  at: number;
  gaveUp: boolean;
}

export type Runs<R extends RunCore> = Partial<Record<SeatId, R>>;

/** What a game tells the race layer. */
export interface RaceSpec<S extends RaceCore, R extends RunCore> {
  /** A round's time limit. */
  roundMs: number;
  /** What each `extra` adds to a finish's time. */
  penaltyMs: number;
  /** A new lobby in this mode, keeping the settings of `from` (a finished game) if given. */
  lobby(mode: Mode, from?: S): S;
  /** Puts back the game's own fields the Realtime Database dropped (empty arrays and objects). */
  normalize(state: S): S;
  /** Round `round`'s content (a route, a puzzle), drawn from `seed`. */
  roundContent(state: S, round: number, seed: string): Partial<S>;
  /** A player's round so far, from their run (already checked to be this round's). */
  score(state: S, run: R | undefined): RoundScore;
}

const SEATS: readonly SeatId[] = [];

/** The core fields the Realtime Database drops when empty. */
export function normalizeCore<S extends RaceCore>(state: S): S {
  const results = (state.results ?? []).map((result) => ({ scores: result?.scores ?? {}, out: result?.out ?? SEATS }));
  return { ...state, names: state.names ?? {}, players: state.players ?? [], alive: state.alive ?? [], results };
}

/** This round's run, or undefined for one from another round. */
export const runOf = <R extends RunCore>(state: RaceCore, run: R | undefined): R | undefined => (run && run.at === state.startsAt ? run : undefined);

/** Why a game of this mode can't start with this many players, or null if it can. */
export function startProblem(mode: Mode, players: number): string | null {
  const { min, max } = PLAYERS[mode];
  if (players < min) return `${MODE_NAME[mode]} needs at least ${min} players.`;
  if (players > max) return `${MODE_NAME[mode]} is for ${max} players at most.`;
  return null;
}

/** How many players a survival round knocks out: two while more than 4 are left, then one. */
export const knockouts = (left: number) => (left > 4 ? 2 : left > 1 ? 1 : 0);

export interface Standing {
  seat: SeatId;
  /** Challenge: the total (lower is better). Survival: the rounds survived. */
  value: number;
  /** Survival: the round they went out in, or null for the winner (or anyone still in). */
  outIn: number | null;
}

/** A game's race transitions, built on its spec. */
export function createRace<S extends RaceCore, R extends RunCore>(spec: RaceSpec<S, R>) {
  const normalize = (state: S): S => spec.normalize(normalizeCore(state));

  const inLobby = (state: S) => {
    if (state.phase !== "lobby") throw new Error("Only in the lobby.");
  };

  function setMode(state: S, mode: Mode): S {
    inLobby(state);
    return { ...normalize(state), mode };
  }

  function setRounds(state: S, rounds: RoundCount): S {
    inLobby(state);
    if (!ROUND_COUNTS.includes(rounds)) throw new Error("No such length.");
    return { ...normalize(state), rounds };
  }

  const beginRound = (state: S, round: number, seed: string, now: number): S => {
    const startsAt = now + COUNTDOWN_MS;
    return { ...state, ...spec.roundContent(state, round, seed), phase: "round", round, startsAt, endsAt: startsAt + spec.roundMs, nextAt: 0 };
  };

  /** Starts a game (from the lobby, or again once one is over) with `seated`, the first round drawn from `seed`. */
  function start(state: S, opts: { seated: SeatId[]; seed: string; now: number }): S {
    const current = normalize(state);
    if (current.phase !== "lobby" && current.phase !== "over") throw new Error("Already playing.");
    const problem = startProblem(current.mode, opts.seated.length);
    if (problem) throw new Error(problem);
    return beginRound({ ...current, players: [...opts.seated], alive: [...opts.seated], results: [] }, 0, opts.seed, opts.now);
  }

  /** Back to the lobby after a game, to change the mode or the settings. */
  function backToLobby(state: S): S {
    const current = normalize(state);
    if (current.phase !== "over") throw new Error("Not over.");
    return spec.lobby(current.mode, current);
  }

  /** A player's round so far (nothing yet if their run is from another round). */
  const scoreOf = (state: S, run: R | undefined): RoundScore => spec.score(state, runOf(state, run));

  /** Finished or gave up: nothing more will come from this player this round. */
  const isDone = (state: S, run: R | undefined): boolean => runOf(state, run)?.gaveUp === true || scoreOf(state, run).done;

  /** A finish's time with the penalty. */
  const total = (score: RoundScore) => score.ms + score.extra * spec.penaltyMs;

  /** Best first: finishers by time with penalty, then the rest by how far they got, then fewer penalties. */
  function compareScores(a: RoundScore, b: RoundScore): number {
    if (a.done !== b.done) return a.done ? -1 : 1;
    if (a.done) return total(a) - total(b);
    return b.found - a.found || a.extra - b.extra;
  }

  /** The round's seats, best first (ties keep seat order). */
  function ranking(scores: Partial<Record<SeatId, RoundScore>>, seats: SeatId[]): SeatId[] {
    return seats.filter((seat) => scores[seat]).sort((a, b) => compareScores(scores[a]!, scores[b]!));
  }

  /**
   * Who a survival round knocks out: the slowest `knockouts(n)`. A tie at the
   * cut knocks out nobody in the tie, so a round may send fewer home (or none,
   * if everyone ties).
   */
  function knockedOut(scores: Partial<Record<SeatId, RoundScore>>, alive: SeatId[]): SeatId[] {
    const order = ranking(scores, alive);
    const cut = order.length - knockouts(order.length);
    if (cut >= order.length) return [];
    const same = (a: SeatId, b: SeatId) => compareScores(scores[a]!, scores[b]!) === 0;
    const tied = cut > 0 && same(order[cut - 1], order[cut]);
    return order.slice(cut).filter((seat) => !(tied && same(seat, order[cut])));
  }

  /**
   * True once the round can end: its time is up, or everyone still in that
   * `present` lists (by default all of them; the page passes those online, so
   * a player who left doesn't hold the round up) is done.
   */
  function roundOver(state: S, runs: Runs<R>, now: number, present?: SeatId[]): boolean {
    if (state.phase !== "round") return false;
    if (now >= state.endsAt) return true;
    const waiting = state.alive.filter((seat) => !present || present.includes(seat));
    return now >= state.startsAt && waiting.length > 0 && waiting.every((seat) => isDone(state, runs[seat]));
  }

  /** Ends the round: everyone's score from their run, and (survival) who goes out. Throws unless `roundOver` (with the same `present`). */
  function endRound(state: S, runs: Runs<R>, now: number, present?: SeatId[]): S {
    const current = normalize(state);
    if (!roundOver(current, runs, now, present)) throw new Error("The round isn't over.");
    const scores: Partial<Record<SeatId, RoundScore>> = {};
    for (const seat of current.alive) scores[seat] = scoreOf(current, runs[seat]);
    const out = current.mode === "survival" ? knockedOut(scores, current.alive) : [];
    return {
      ...current,
      phase: "results",
      alive: current.alive.filter((seat) => !out.includes(seat)),
      results: [...current.results, { scores, out }],
      nextAt: now + RESULTS_MS,
    };
  }

  /** The game is decided: the challenge's last round, one survivor (or none left to knock out), or `MAX_ROUNDS` played. */
  function decided(state: S): boolean {
    if (state.results.length >= MAX_ROUNDS) return true;
    if (state.mode === "challenge") return state.results.length >= state.rounds;
    return state.alive.length <= 1;
  }

  /** After the results: the next round (drawn from `seed`), or the final standings. */
  function next(state: S, seed: string, now: number): S {
    const current = normalize(state);
    if (current.phase !== "results") throw new Error("Not showing results.");
    if (now < current.nextAt) throw new Error("Not due yet.");
    if (decided(current)) return { ...current, phase: "over", nextAt: 0 };
    return beginRound(current, current.round + 1, seed, now);
  }

  /** A challenge round's score for the total: a finish's time with penalty; not finished, the slowest finish (at least the limit) plus `DNF_EXTRA_MS`. */
  function roundPoints(result: RoundResult, seat: SeatId): number {
    const score = result.scores[seat];
    const finishes = Object.values(result.scores)
      .filter((s): s is RoundScore => s != null && s.done)
      .map(total);
    const unfinished = Math.max(spec.roundMs, ...finishes) + DNF_EXTRA_MS;
    return score?.done ? total(score) : unfinished;
  }

  /** Everyone in the game, best first. Challenge: by total. Survival: still in first, then by how late they went out. */
  function standings(state: S): Standing[] {
    const { players, results } = normalize(state);
    if (state.mode === "challenge") {
      return players
        .map((seat) => ({ seat, value: results.reduce((sum, result) => sum + roundPoints(result, seat), 0), outIn: null }))
        .sort((a, b) => a.value - b.value);
    }
    const outIn = (seat: SeatId) => {
      const index = results.findIndex((result) => result.out.includes(seat));
      return index < 0 ? null : index;
    };
    // Among those out in the same round, the better round score first.
    const lastScore = (seat: SeatId, round: number) => results[round]?.scores[seat];
    return players
      .map((seat) => ({ seat, outIn: outIn(seat), value: outIn(seat) ?? results.length }))
      .sort((a, b) => {
        if (a.outIn === null || b.outIn === null) return a.outIn === b.outIn ? 0 : a.outIn === null ? -1 : 1;
        if (a.outIn !== b.outIn) return b.outIn - a.outIn;
        const x = lastScore(a.seat, a.outIn);
        const y = lastScore(b.seat, b.outIn);
        return x && y ? compareScores(x, y) : 0;
      });
  }

  return {
    normalize,
    setMode,
    setRounds,
    start,
    backToLobby,
    scoreOf,
    isDone,
    total,
    compareScores,
    ranking,
    knockedOut,
    roundOver,
    endRound,
    decided,
    next,
    roundPoints,
    standings,
  };
}

export type Race<S extends RaceCore, R extends RunCore> = ReturnType<typeof createRace<S, R>>;
