import { dayKey, isDay, weekdayOf } from "@/lib/daily/day";
import type { FinishedRow, FinishedStats, FinisherSnap, SourceRow, SourceStats, TrackedGuestSnap, TrackingSnapshot, WeekCount } from "./types";

/**
 * Games finished (the north star: games finished per week) and where guests
 * came from (docs/tracking.md). Pure, over a TrackingSnapshot. Weeks and days
 * are the daily's calendar: America/Toronto, weeks Monday to Sunday.
 */

/** Guests tracking never saw arrive: they existed before it shipped (or kept a page open from before). */
export const BEFORE_TRACKING = "(before tracking)";

/**
 * A first touch is written a moment after the guest's first page, so their
 * first room can land just before it. Activity earlier than this before the
 * first touch means the guest existed before tracking.
 */
export const TOUCH_GRACE_MS = 60 * 60 * 1000;

export const TREND_WEEKS = 12;

const DAY_MS = 86_400_000;
const noon = (day: string) => Date.parse(`${day}T12:00:00Z`);

/** The day `n` days before `day` (negative: after). */
export function daysBefore(day: string, n: number): string {
  return new Date(noon(day) - n * DAY_MS).toISOString().slice(0, 10);
}

/** The Monday (YYYY-MM-DD) of the week holding time `ms`, in Toronto. */
export function weekOf(ms: number): string {
  const day = dayKey(ms);
  return daysBefore(day, weekdayOf(day));
}

export interface Attribution {
  src: string;
  cmp?: string;
}

/**
 * Where a guest came from: their first touch, else (it never reached the
 * database) the source their device sent with a finished game. Before
 * tracking when there's neither, or when they were active well before it.
 */
export function attributionOf(guest: TrackedGuestSnap | undefined, entry?: Pick<FinisherSnap, "src" | "cmp" | "at">): Attribution {
  const touch = guest?.touch ?? entry;
  if (!touch) return { src: BEFORE_TRACKING };
  if (guest?.firstActiveAt != null && guest.firstActiveAt < touch.at - TOUCH_GRACE_MS) return { src: BEFORE_TRACKING };
  return { src: touch.src, ...(touch.cmp ? { cmp: touch.cmp } : {}) };
}

/** When a guest was first seen: their first touch or first activity, whichever came first. */
function firstSeen(guest: TrackedGuestSnap): number | undefined {
  const times = [guest.touch?.at, guest.firstActiveAt].filter((t): t is number => t != null);
  return times.length ? Math.min(...times) : undefined;
}

/** Each guest's attribution, by uid, with their earliest finisher entry as the fallback. */
function attributions(snapshot: TrackingSnapshot): (uid: string | undefined) => Attribution {
  const guests = new Map(snapshot.guests.map((guest) => [guest.uid, guest]));
  const earliest = new Map<string, FinisherSnap>();
  for (const entry of snapshot.finishers) {
    const known = earliest.get(entry.uid);
    if (!known || entry.at < known.at) earliest.set(entry.uid, entry);
  }
  const cache = new Map<string, Attribution>();
  return (uid) => {
    if (uid == null) return { src: BEFORE_TRACKING };
    let found = cache.get(uid);
    if (!found) {
      found = attributionOf(guests.get(uid), earliest.get(uid));
      cache.set(uid, found);
    }
    return found;
  };
}

/** Finishers by game key. */
function finishersByGame(finishers: FinisherSnap[]) {
  const byGame = new Map<string, FinisherSnap[]>();
  for (const entry of finishers) byGame.set(entry.game, [...(byGame.get(entry.game) ?? []), entry]);
  return byGame;
}

const modeKey = (mode: string, matchmade: boolean) => ((mode === "challenge" || mode === "survival") && matchmade ? `${mode}-matchmade` : mode);

/**
 * Games finished: this week against last week, the 12-week trend, all time,
 * and by game, mode and source. Everything counts from the last stats clear.
 * `gameOrder` puts the games in display order (others follow, most first).
 */
export function computeFinished(snapshot: TrackingSnapshot, gameOrder: string[] = []): FinishedStats {
  const from = snapshot.statsSince ?? 0;
  const games = snapshot.games.filter((game) => game.at >= from);
  const finishers = snapshot.finishers.filter((entry) => entry.at >= from);
  const thisWeek = weekOf(snapshot.now);
  const lastWeek = daysBefore(thisWeek, 7);
  const trend = Array.from({ length: TREND_WEEKS }, (_, i) => daysBefore(thisWeek, 7 * (TREND_WEEKS - 1 - i)));
  const inTrend = new Set(trend);

  const weekGames = new Map<string, number>();
  const weekPlayers = new Map<string, Set<string>>();
  for (const game of games) weekGames.set(weekOf(game.at), (weekGames.get(weekOf(game.at)) ?? 0) + 1);
  for (const entry of finishers) {
    const week = weekOf(entry.at);
    weekPlayers.set(week, (weekPlayers.get(week) ?? new Set<string>()).add(entry.uid));
  }
  const count = (start: string): WeekCount => ({ start, games: weekGames.get(start) ?? 0, players: weekPlayers.get(start)?.size ?? 0 });

  const rows = new Map<string, Map<string, FinishedRow>>([
    ["game", new Map()],
    ["mode", new Map()],
    ["source", new Map()],
  ]);
  const add = (kind: string, key: string, week: string) => {
    const table = rows.get(kind)!;
    const row = table.get(key) ?? { key, thisWeek: 0, lastWeek: 0, weeks12: 0, allTime: 0 };
    table.set(key, row);
    row.allTime++;
    if (week === thisWeek) row.thisWeek++;
    if (week === lastWeek) row.lastWeek++;
    if (inTrend.has(week)) row.weeks12++;
  };
  const sourceOf = attributions(snapshot);
  const byGame = finishersByGame(finishers);
  for (const game of games) {
    const week = weekOf(game.at);
    add("game", game.slug, week);
    add("mode", modeKey(game.mode, game.matchmade), week);
    const sources = new Set((byGame.get(game.key) ?? []).map((entry) => sourceOf(entry.uid).src));
    sources.forEach((src) => add("source", src, week));
  }

  const most = (a: FinishedRow, b: FinishedRow) => b.allTime - a.allTime || a.key.localeCompare(b.key);
  const gameRows = rows.get("game")!;
  const orderedGames = [
    ...gameOrder.map((slug) => gameRows.get(slug) ?? { key: slug, thisWeek: 0, lastWeek: 0, weeks12: 0, allTime: 0 }),
    ...[...gameRows.values()].filter((row) => !gameOrder.includes(row.key)).sort(most),
  ];
  return {
    thisWeek: count(thisWeek),
    lastWeek: count(lastWeek),
    weeks: trend.map(count),
    allTime: { games: games.length, players: new Set(finishers.map((entry) => entry.uid)).size },
    byGame: orderedGames,
    byMode: [...rows.get("mode")!.values()].sort(most),
    bySource: [...rows.get("source")!.values()].sort(most),
  };
}

/** The days the source table covers: a preset or two dates, as the dashboard asks. */
export type RangeQuery = { preset: "7d" | "30d" | "week" | "lastweek" | "all" } | { from: string; to: string };

export const RANGE_PRESETS = ["7d", "30d", "week", "lastweek", "all"] as const;

/** The range's first and last days (Toronto, both included); no `from` means from the beginning. */
export function resolveRange(query: RangeQuery, now: number): { from?: string; to: string } {
  const today = dayKey(now);
  if ("from" in query) {
    const from = isDay(query.from) ? query.from : today;
    const to = isDay(query.to) ? query.to : today;
    return from <= to ? { from, to } : { from: to, to: from };
  }
  switch (query.preset) {
    case "7d":
      return { from: daysBefore(today, 6), to: today };
    case "week":
      return { from: weekOf(now), to: today };
    case "lastweek":
      return { from: daysBefore(weekOf(now), 7), to: daysBefore(weekOf(now), 1) };
    case "all":
      return { to: today };
    default:
      return { from: daysBefore(today, 29), to: today };
  }
}

/** Reads the range from the stats request's query (?range=30d, or ?from=YYYY-MM-DD&to=YYYY-MM-DD); 30 days by default. */
export function rangeFromParams(params: URLSearchParams): RangeQuery {
  const from = params.get("from");
  const to = params.get("to");
  if (from && to && isDay(from) && isDay(to)) return { from, to };
  const preset = params.get("range");
  return { preset: RANGE_PRESETS.find((p) => p === preset) ?? "30d" };
}

const NO_CAMPAIGN = "";

/**
 * Per source, and per source and campaign, over a range of days: new guests,
 * rooms created by them, games finished with one of them, and how many of
 * them finished. Nothing from before the last stats clear counts.
 */
export function computeSources(snapshot: TrackingSnapshot, range: { from?: string; to: string }): SourceStats {
  const since = snapshot.statsSince ?? 0;
  const inRange = (t: number | undefined) => {
    if (t == null || t < since) return false;
    const day = dayKey(t);
    return (range.from == null || day >= range.from) && day <= range.to;
  };
  const sourceOf = attributions(snapshot);
  const sources = new Map<string, SourceRow & { players: Set<string> }>();
  const campaigns = new Map<string, SourceRow & { players: Set<string> }>();
  const rowsFor = (who: Attribution) => {
    const cmp = who.cmp ?? NO_CAMPAIGN;
    const bySrc = sources.get(who.src) ?? { src: who.src, newGuests: 0, roomsCreated: 0, gamesFinished: 0, finishers: 0, players: new Set<string>() };
    sources.set(who.src, bySrc);
    const id = `${who.src}\u0000${cmp}`;
    const byCmp = campaigns.get(id) ?? { src: who.src, ...(cmp ? { cmp } : {}), newGuests: 0, roomsCreated: 0, gamesFinished: 0, finishers: 0, players: new Set<string>() };
    campaigns.set(id, byCmp);
    return [bySrc, byCmp];
  };

  for (const guest of snapshot.guests) {
    if (inRange(firstSeen(guest))) rowsFor(sourceOf(guest.uid)).forEach((row) => row.newGuests++);
  }
  for (const room of snapshot.rooms) {
    if (inRange(room.createdAt)) rowsFor(sourceOf(room.createdBy)).forEach((row) => row.roomsCreated++);
  }
  const byGame = finishersByGame(snapshot.finishers);
  for (const game of snapshot.games) {
    if (!inRange(game.at)) continue;
    const seen = new Set<string>();
    for (const entry of byGame.get(game.key) ?? []) {
      const who = sourceOf(entry.uid);
      const id = `${who.src}\u0000${who.cmp ?? NO_CAMPAIGN}`;
      const [bySrc, byCmp] = rowsFor(who);
      if (!seen.has(who.src)) bySrc.gamesFinished++;
      if (!seen.has(id)) byCmp.gamesFinished++;
      seen.add(who.src).add(id);
    }
  }
  for (const entry of snapshot.finishers) {
    if (inRange(entry.at)) rowsFor(sourceOf(entry.uid)).forEach((row) => row.players.add(entry.uid));
  }

  const done = (rows: Iterable<SourceRow & { players: Set<string> }>): SourceRow[] =>
    [...rows]
      .map(({ players, ...row }) => ({ ...row, finishers: players.size }))
      .sort((a, b) => b.gamesFinished - a.gamesFinished || b.newGuests - a.newGuests || a.src.localeCompare(b.src) || (a.cmp ?? "").localeCompare(b.cmp ?? ""));
  return { ...(range.from ? { from: range.from } : {}), to: range.to, sources: done(sources.values()), campaigns: done(campaigns.values()) };
}
