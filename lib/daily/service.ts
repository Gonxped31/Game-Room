import { dayKey, dayNumber, previousDay } from "./day";
import type { DailyGame } from "./types";

/**
 * The shared daily system, for any game that provides a DailyGame. It runs on
 * the server only (app/api/daily/), against `/daily` in the database, which
 * the rules close to every client: players never write a time, a result or
 * the board themselves.
 *
 * /daily/{slug}/{day}/puzzle          the day's puzzle, generated once
 * /daily/{slug}/{day}/attempts/{uid}  { startedAt, ranked, finishedAt?, ms?, penaltyMs?, unranked? }
 * /daily/{slug}/{day}/ips/{ipHash}    the uid whose attempt is this connection's ranked one
 * /daily/{slug}/{day}/board/{uid}     { name, ms }: ranked solves only
 * /daily/{slug}/streaks/{uid}         { streak, lastDay }
 * /daily/names/{uid}                  the name shown on boards
 *
 * Anti-cheat (the user's choices, 2026-10-25):
 * - the server stamps the start and the finish, so a doctored clock gains nothing;
 * - the server replays the moves (DailyGame.verify) before anything is written;
 * - the seed is secret, so the puzzle only exists once Start is pressed;
 * - one attempt per guest per day, and only a connection's first attempt is ranked;
 * - a solve faster than a person could, or with machine-regular moves, is kept unranked.
 */

/** What the service needs from the database; adminStore() (server.ts) is the real one, tests use a Map. */
export interface DailyStore {
  get<T>(path: string): Promise<T | null>;
  set(path: string, value: unknown): Promise<void>;
  /** Writes `value` only if nothing is there yet (a transaction); resolves to whatever is there afterwards. */
  claim<T>(path: string, value: T): Promise<T>;
  /** The children of `path`, ordered by their numeric `by` field, smallest first, at most `limit`. */
  lowest<T>(path: string, by: string, limit: number): Promise<[string, T][]>;
  /** How many children of `path` have `by` below `value`. */
  countBelow(path: string, by: string, value: number): Promise<number>;
}

export interface DailyContext {
  store: DailyStore;
  game: DailyGame;
  /** The day's secret seed for this game (server.ts: an HMAC of the day). */
  seedFor: (slug: string, day: string) => string;
  uid: string;
  now: number;
}

export interface Attempt {
  startedAt: number;
  ranked: boolean;
  finishedAt?: number;
  /** The time on the board: from Start to the finish, plus any penalty. */
  ms?: number;
  /** The part of `ms` that is a penalty (DailyGame.verify's), when there is one. */
  penaltyMs?: number;
  /** Why a finished attempt isn't on the board. */
  unranked?: UnrankedReason;
}

export type UnrankedReason = "connection" | "too-fast" | "regular";

export interface BoardEntry {
  name: string;
  ms: number;
  me?: true;
}

export interface DailyStatus {
  day: string;
  number: number;
  /** DailyGame.describe: "Knight · 7×7". */
  label: string;
  attempt: Attempt | null;
  streak: number;
  name: string | null;
  board: BoardEntry[];
  /** Your place on today's board, if you're on it. */
  rank: number | null;
  /** Ranked solves today. */
  players: number;
}

export const BOARD_SIZE = 50;
export const MAX_NAME_LENGTH = 20;
/** The day before yesterday's attempts can't be submitted any more; a puzzle started before midnight can. */
const SUBMIT_GRACE_DAYS = 1;
/** Moves this evenly spaced (standard deviation of the gaps, ms) are a script, not a hand. */
const REGULAR_GAP_MS = 15;
const REGULAR_MIN_GAPS = 6;

export class DailyError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

const base = (ctx: DailyContext, day: string) => `daily/${ctx.game.slug}/${day}`;

/** The day's puzzle, generating and saving it on first use. */
async function puzzleOf(ctx: DailyContext, day: string): Promise<unknown> {
  const path = `${base(ctx, day)}/puzzle`;
  const saved = await ctx.store.get<string>(path);
  if (saved) return JSON.parse(saved);
  const fresh = JSON.stringify(ctx.game.generate(ctx.seedFor(ctx.game.slug, day), day));
  return JSON.parse(await ctx.store.claim(path, fresh));
}

async function boardOf(ctx: DailyContext, day: string, mine?: Attempt | null) {
  const path = `${base(ctx, day)}/board`;
  const rows = await ctx.store.lowest<{ name: string; ms: number }>(path, "ms", BOARD_SIZE);
  const board: BoardEntry[] = rows.map(([uid, row]) => (uid === ctx.uid ? { name: row.name, ms: row.ms, me: true } : { name: row.name, ms: row.ms }));
  const onBoard = mine?.ranked && typeof mine.ms === "number";
  const rank = onBoard ? (await ctx.store.countBelow(path, "ms", mine.ms!)) + 1 : null;
  const players = await ctx.store.countBelow(path, "ms", Number.MAX_SAFE_INTEGER);
  return { board, rank, players };
}

async function streakOf(ctx: DailyContext, today: string): Promise<number> {
  const saved = await ctx.store.get<{ streak: number; lastDay: string }>(`daily/${ctx.game.slug}/streaks/${ctx.uid}`);
  if (!saved) return 0;
  // A streak still counts today if it reached yesterday.
  return saved.lastDay === today || saved.lastDay === previousDay(today) ? saved.streak : 0;
}

/** Today's puzzle line, your attempt, streak and name, and the board. */
export async function dailyStatus(ctx: DailyContext): Promise<DailyStatus> {
  const day = dayKey(ctx.now);
  const attempt = await ctx.store.get<Attempt>(`${base(ctx, day)}/attempts/${ctx.uid}`);
  const [streak, name, board] = await Promise.all([streakOf(ctx, day), ctx.store.get<string>(`daily/names/${ctx.uid}`), boardOf(ctx, day, attempt)]);
  return { day, number: dayNumber(day), label: ctx.game.describe(day), attempt, streak, name, ...board };
}

/**
 * Starts today's attempt, or resumes it: the same puzzle and the same
 * `startedAt` however often Start is pressed. Only the first attempt from a
 * connection (`ipHash`, salted and per day) is ranked.
 */
export async function startDaily(ctx: DailyContext, ipHash: string) {
  const day = dayKey(ctx.now);
  const puzzle = await puzzleOf(ctx, day);
  const path = `${base(ctx, day)}/attempts/${ctx.uid}`;
  let attempt = await ctx.store.get<Attempt>(path);
  if (!attempt) {
    const owner = await ctx.store.claim(`${base(ctx, day)}/ips/${ipHash}`, ctx.uid);
    attempt = await ctx.store.claim<Attempt>(path, { startedAt: ctx.now, ranked: owner === ctx.uid });
  }
  return { day, number: dayNumber(day), label: ctx.game.describe(day), puzzle, attempt, serverNow: ctx.now };
}

/**
 * Words a public board won't show (EN and FR), matched inside names with
 * letters only, so "f.u.c.k" or "FuCk99" count too. A short list on
 * purpose: it stops the obvious, not the determined.
 */
const BLOCKED = ["fuck", "shit", "cunt", "bitch", "nigg", "fagg", "whore", "slut", "rape", "nazi", "hitler", "pute", "salope", "connard", "encule", "enculé", "merde", "pd"];

/** The name as shown on boards: trimmed, single-spaced, printable, at most MAX_NAME_LENGTH; null if empty or blocked. */
export function cleanName(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const name = raw
    .replace(/[\p{C}]/gu, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, MAX_NAME_LENGTH)
    .trim();
  if (!name) return null;
  const letters = name.toLowerCase().normalize("NFD").replace(/[^a-z]/g, "");
  const words = name.toLowerCase().split(/[^\p{L}]+/u);
  // "pd" only as a whole word: too many names contain those two letters.
  if (BLOCKED.some((word) => (word.length <= 2 ? words.includes(word) : letters.includes(word.normalize("NFD").replace(/[^a-z]/g, ""))))) return null;
  return name;
}

/** "Player 4821", from the uid, for someone who never gave a name. */
export function fallbackName(uid: string): string {
  let hash = 0;
  for (const ch of uid) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  return `Player ${1000 + (hash % 9000)}`;
}

function standardDeviation(values: number[]): number {
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  return Math.sqrt(values.reduce((a, b) => a + (b - mean) ** 2, 0) / values.length);
}

/**
 * Finishes an attempt: the moves must solve the day's puzzle. The time is
 * the server's, from Start to now. A second submit returns the first result.
 */
export async function submitDaily(ctx: DailyContext, input: { day: unknown; moves: unknown; name: unknown }) {
  const today = dayKey(ctx.now);
  const day = typeof input.day === "string" ? input.day : "";
  let oldest = today;
  for (let i = 0; i < SUBMIT_GRACE_DAYS; i++) oldest = previousDay(oldest);
  if (day !== today && !(day >= oldest && day < today)) throw new DailyError("That puzzle is over.", 409);

  const path = `${base(ctx, day)}/attempts/${ctx.uid}`;
  const attempt = await ctx.store.get<Attempt>(path);
  if (!attempt) throw new DailyError("Press Start first.", 409);

  if (attempt.finishedAt === undefined) {
    const puzzle = await puzzleOf(ctx, day);
    const verdict = ctx.game.verify(puzzle, input.moves);
    if (!verdict.ok) throw new DailyError(verdict.reason, 422);

    const elapsed = ctx.now - attempt.startedAt;
    const penaltyMs = Number.isSafeInteger(verdict.penaltyMs) && verdict.penaltyMs! > 0 ? verdict.penaltyMs! : 0;
    const ms = elapsed + penaltyMs;
    const gaps = verdict.moveTimes.slice(1).map((t, i) => t - verdict.moveTimes[i]);
    let unranked: UnrankedReason | undefined = attempt.ranked ? undefined : "connection";
    if (!unranked && elapsed < ctx.game.minHumanMs(puzzle)) unranked = "too-fast";
    if (!unranked && gaps.length >= REGULAR_MIN_GAPS && standardDeviation(gaps) < REGULAR_GAP_MS) unranked = "regular";

    const name = cleanName(input.name) ?? (await ctx.store.get<string>(`daily/names/${ctx.uid}`)) ?? fallbackName(ctx.uid);
    const finished: Attempt = { ...attempt, finishedAt: ctx.now, ms, ranked: !unranked, ...(penaltyMs ? { penaltyMs } : {}), ...(unranked ? { unranked } : {}) };
    // claim on finishedAt: of two submits racing, only the first writes a result.
    const first = await ctx.store.claim(`${path}/finishedAt`, ctx.now);
    if (first === ctx.now) {
      await ctx.store.set(path, finished);
      await ctx.store.set(`daily/names/${ctx.uid}`, name);
      if (finished.ranked) await ctx.store.set(`${base(ctx, day)}/board/${ctx.uid}`, { name, ms });
      const streakPath = `daily/${ctx.game.slug}/streaks/${ctx.uid}`;
      const saved = await ctx.store.get<{ streak: number; lastDay: string }>(streakPath);
      if (!saved || saved.lastDay < day) {
        const streak = saved && saved.lastDay === previousDay(day) ? saved.streak + 1 : 1;
        await ctx.store.set(streakPath, { streak, lastDay: day });
      }
    }
  }

  const result = (await ctx.store.get<Attempt>(path))!;
  const [streak, board] = await Promise.all([streakOf(ctx, today), boardOf(ctx, day, result)]);
  return { day, attempt: result, streak, ...board };
}
