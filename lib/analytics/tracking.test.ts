import { describe, expect, it } from "vitest";
import { attributionOf, BEFORE_TRACKING, computeFinished, computeSources, daysBefore, rangeFromParams, resolveRange, TOUCH_GRACE_MS, weekOf } from "./tracking";
import { toTrackingSnapshot } from "./trackingAdapter";
import type { FinishedGameSnap, FinisherSnap, TrackedGuestSnap, TrackingSnapshot } from "./types";

// Wednesday 2026-11-11, noon in Toronto: this week began Monday 2026-11-09.
const NOW = Date.parse("2026-11-11T17:00:00Z");
const HOUR = 3_600_000;
const DAY = 24 * HOUR;

const game = (key: string, at: number, over: Partial<FinishedGameSnap> = {}): FinishedGameSnap => ({ key, slug: "ftw", mode: "room", matchmade: false, at, ...over });
const fin = (gameKey: string, uid: string, at: number, src = "direct", cmp?: string): FinisherSnap => ({ game: gameKey, uid, src, ...(cmp ? { cmp } : {}), at });
const guest = (uid: string, src: string, at: number, firstActiveAt?: number, cmp?: string): TrackedGuestSnap => ({
  uid,
  touch: { src, ...(cmp ? { cmp } : {}), at },
  ...(firstActiveAt != null ? { firstActiveAt } : {}),
});
const snap = (over: Partial<TrackingSnapshot>): TrackingSnapshot => ({ games: [], finishers: [], guests: [], rooms: [], now: NOW, ...over });

describe("weeks", () => {
  it("run Monday to Sunday in Toronto, not UTC", () => {
    expect(weekOf(NOW)).toBe("2026-11-09");
    // Sunday 23:30 in Toronto is already Monday in UTC.
    expect(weekOf(Date.parse("2026-11-16T04:30:00Z"))).toBe("2026-11-09");
    expect(weekOf(Date.parse("2026-11-16T05:00:00Z"))).toBe("2026-11-16");
  });

  it("change at local midnight across the clock changes", () => {
    // Clocks went back on Sunday 2026-11-01: Monday's midnight is 05:00 UTC.
    expect(weekOf(Date.parse("2026-11-02T04:59:00Z"))).toBe("2026-10-26");
    expect(weekOf(Date.parse("2026-11-02T05:00:00Z"))).toBe("2026-11-02");
    // Clocks go forward on Sunday 2026-03-08: Monday's midnight is 04:00 UTC.
    expect(weekOf(Date.parse("2026-03-09T03:59:00Z"))).toBe("2026-03-02");
    expect(weekOf(Date.parse("2026-03-09T04:00:00Z"))).toBe("2026-03-09");
  });

  it("count days back", () => {
    expect(daysBefore("2026-11-09", 7)).toBe("2026-11-02");
    expect(daysBefore("2026-03-01", 1)).toBe("2026-02-28");
  });
});

describe("computeFinished", () => {
  it("counts each game once, however many players reported it", () => {
    const stats = computeFinished(
      snap({
        games: [game("abc234_1", NOW - HOUR), game("abc234_2", NOW - 2 * HOUR), game("a_x", NOW - 9 * DAY, { slug: "regions", mode: "solo" })],
        finishers: [fin("abc234_1", "a", NOW - HOUR), fin("abc234_1", "b", NOW - HOUR), fin("abc234_2", "a", NOW - 2 * HOUR), fin("a_x", "a", NOW - 9 * DAY)],
      }),
      ["ftw", "regions", "lasthop"],
    );
    expect(stats.thisWeek).toEqual({ start: "2026-11-09", games: 2, players: 2 });
    expect(stats.lastWeek).toEqual({ start: "2026-11-02", games: 1, players: 1 });
    expect(stats.allTime).toEqual({ games: 3, players: 2 });
    expect(stats.weeks).toHaveLength(12);
    expect(stats.weeks[0].start).toBe("2026-08-24");
    expect(stats.weeks.at(-1)).toEqual(stats.thisWeek);
    expect(stats.byGame.map((row) => [row.key, row.thisWeek, row.lastWeek, row.allTime])).toEqual([
      ["ftw", 2, 0, 2],
      ["regions", 0, 1, 1],
      ["lasthop", 0, 0, 0],
    ]);
  });

  it("splits modes, matchmade races apart", () => {
    const stats = computeFinished(
      snap({
        games: [
          game("r_1", NOW, { mode: "challenge", matchmade: true }),
          game("r_2", NOW, { mode: "challenge" }),
          game("r_3", NOW, { mode: "daily" }),
          game("r_4", NOW, { mode: "daily" }),
        ],
      }),
    );
    expect(stats.byMode.map((row) => [row.key, row.allTime])).toEqual([
      ["daily", 2],
      ["challenge", 1],
      ["challenge-matchmade", 1],
    ]);
  });

  it("counts a game once per source among its finishers", () => {
    const stats = computeFinished(
      snap({
        games: [game("g_1", NOW), game("g_2", NOW)],
        finishers: [fin("g_1", "t1", NOW), fin("g_1", "t2", NOW), fin("g_1", "d1", NOW), fin("g_2", "t1", NOW)],
        guests: [guest("t1", "tiktok", NOW - DAY), guest("t2", "tiktok", NOW - DAY), guest("d1", "direct", NOW - DAY)],
      }),
    );
    expect(stats.bySource.map((row) => [row.key, row.thisWeek])).toEqual([
      ["tiktok", 2],
      ["direct", 1],
    ]);
  });

  it("leaves out what came before the last stats clear", () => {
    const stats = computeFinished(
      snap({ games: [game("g_1", NOW - 2 * HOUR), game("g_2", NOW)], finishers: [fin("g_1", "a", NOW - 2 * HOUR), fin("g_2", "b", NOW)], statsSince: NOW - HOUR }),
    );
    expect(stats.allTime).toEqual({ games: 1, players: 1 });
  });
});

describe("attribution", () => {
  it("is the first touch, else the source sent with a finished game", () => {
    expect(attributionOf(guest("a", "tiktok", NOW, undefined, "test1"))).toEqual({ src: "tiktok", cmp: "test1" });
    expect(attributionOf({ uid: "a", firstActiveAt: NOW }, { src: "reddit", at: NOW })).toEqual({ src: "reddit" });
  });

  it("puts guests from before tracking in their own bucket, not under direct", () => {
    // Played a week ago, first touch written when they came back today.
    expect(attributionOf(guest("a", "direct", NOW, NOW - 7 * DAY))).toEqual({ src: BEFORE_TRACKING });
    // Never seen by the tracking code at all.
    expect(attributionOf({ uid: "b", firstActiveAt: NOW - DAY })).toEqual({ src: BEFORE_TRACKING });
    expect(attributionOf(undefined)).toEqual({ src: BEFORE_TRACKING });
  });

  it("allows a first room just before the first touch lands", () => {
    expect(attributionOf(guest("a", "invite", NOW, NOW - 5000))).toEqual({ src: "invite" });
    expect(attributionOf(guest("a", "invite", NOW, NOW - TOUCH_GRACE_MS - 1))).toEqual({ src: BEFORE_TRACKING });
  });
});

describe("computeSources", () => {
  const data = snap({
    guests: [
      guest("t1", "tiktok", NOW - DAY, NOW - DAY, "test1"),
      guest("t2", "tiktok", NOW - 40 * DAY, NOW - 40 * DAY),
      guest("i1", "invite", NOW - HOUR, NOW - HOUR, "ftw"),
      guest("old", "direct", NOW - DAY, NOW - 90 * DAY),
    ],
    rooms: [
      { code: "abc234", createdAt: NOW - DAY, createdBy: "t1" },
      { code: "xyz789", createdAt: NOW - 2 * DAY, createdBy: "old" },
      { code: "nobody", createdAt: NOW - 2 * DAY },
    ],
    games: [game("abc234_1", NOW - DAY + HOUR), game("abc234_2", NOW - 50 * DAY)],
    finishers: [fin("abc234_1", "t1", NOW - DAY + HOUR, "tiktok", "test1"), fin("abc234_1", "i1", NOW - DAY + HOUR, "invite", "ftw"), fin("abc234_2", "t2", NOW - 50 * DAY, "tiktok")],
  });

  it("counts new guests, rooms created and games finished per source and campaign", () => {
    const stats = computeSources(data, resolveRange({ preset: "30d" }, NOW));
    expect(stats.from).toBe("2026-10-13");
    expect(stats.to).toBe("2026-11-11");
    const bySrc = Object.fromEntries(stats.sources.map(({ src, ...row }) => [src, row]));
    expect(bySrc.tiktok).toEqual({ newGuests: 1, roomsCreated: 1, gamesFinished: 1, finishers: 1 });
    expect(bySrc.invite).toEqual({ newGuests: 1, roomsCreated: 0, gamesFinished: 1, finishers: 1 });
    // The returning guest and the room with no known creator: before tracking.
    expect(bySrc[BEFORE_TRACKING]).toEqual({ newGuests: 0, roomsCreated: 2, gamesFinished: 0, finishers: 0 });
    expect(stats.campaigns.find((row) => row.src === "tiktok")).toEqual({ src: "tiktok", cmp: "test1", newGuests: 1, roomsCreated: 1, gamesFinished: 1, finishers: 1 });
  });

  it("filters by the chosen days, and from the last stats clear", () => {
    const all = computeSources(data, resolveRange({ preset: "all" }, NOW));
    expect(all.from).toBeUndefined();
    expect(all.sources.find((row) => row.src === "tiktok")).toMatchObject({ newGuests: 2, gamesFinished: 2, finishers: 2 });
    const narrow = computeSources(data, resolveRange({ from: "2026-11-11", to: "2026-11-11" }, NOW));
    expect(narrow.sources.find((row) => row.src === "invite")).toMatchObject({ newGuests: 1, gamesFinished: 0 });
    expect(narrow.sources.find((row) => row.src === "tiktok")).toBeUndefined();
    const cleared = computeSources({ ...data, statsSince: NOW - 2 * HOUR }, resolveRange({ preset: "all" }, NOW));
    expect(cleared.sources.map((row) => row.src)).toEqual(["invite"]);
  });
});

describe("ranges", () => {
  it("resolves presets in Toronto days", () => {
    expect(resolveRange({ preset: "7d" }, NOW)).toEqual({ from: "2026-11-05", to: "2026-11-11" });
    expect(resolveRange({ preset: "week" }, NOW)).toEqual({ from: "2026-11-09", to: "2026-11-11" });
    expect(resolveRange({ preset: "lastweek" }, NOW)).toEqual({ from: "2026-11-02", to: "2026-11-08" });
    expect(resolveRange({ from: "2026-11-08", to: "2026-11-01" }, NOW)).toEqual({ from: "2026-11-01", to: "2026-11-08" });
  });

  it("reads the request's query, 30 days by default", () => {
    expect(rangeFromParams(new URLSearchParams("range=week"))).toEqual({ preset: "week" });
    expect(rangeFromParams(new URLSearchParams("from=2026-11-01&to=2026-11-08"))).toEqual({ from: "2026-11-01", to: "2026-11-08" });
    expect(rangeFromParams(new URLSearchParams("range=bogus"))).toEqual({ preset: "30d" });
    expect(rangeFromParams(new URLSearchParams("from=yesterday&to=2026-11-08"))).toEqual({ preset: "30d" });
  });
});

describe("trackingAdapter", () => {
  it("maps the raw trees, skipping malformed entries", () => {
    const tracking = toTrackingSnapshot(
      {
        games: { abc234: { meta: { gameSlug: "ftw", createdAt: NOW - DAY, createdBy: "a" } }, broken: { seats: {} } },
        users: {
          a: { firstTouch: { src: "tiktok", cmp: "test1", at: NOW - DAY }, rooms: { abc234: { gameSlug: "ftw", addedAt: NOW - DAY - 1000 } } },
          b: { firstTouch: { src: "Bad Tag", at: NOW }, visits: { "20261101": { abc234: { gameSlug: "ftw", at: NOW - 10 * DAY } } } },
        },
        archive: { old123: { gameSlug: "ftw", createdAt: NOW - 20 * DAY, createdBy: "c", guests: { c: { addedAt: NOW - 20 * DAY } } } },
        finishedGames: { abc234_1: { slug: "ftw", mode: "room", players: 2, lang: "en", at: NOW }, bad_1: { slug: "ftw", mode: "party", at: NOW } },
        finishedPlayers: { abc234_1_a: { game: "abc234_1", uid: "a", src: "tiktok", cmp: "test1", at: NOW }, bad: { uid: "a" } },
      },
      NOW,
    );
    expect(tracking.rooms).toEqual([
      { code: "abc234", createdAt: NOW - DAY, createdBy: "a" },
      { code: "old123", createdAt: NOW - 20 * DAY, createdBy: "c" },
    ]);
    expect(tracking.games).toEqual([{ key: "abc234_1", slug: "ftw", mode: "room", matchmade: false, at: NOW }]);
    expect(tracking.finishers).toEqual([{ game: "abc234_1", uid: "a", src: "tiktok", cmp: "test1", at: NOW }]);
    expect(tracking.guests).toEqual([
      { uid: "a", touch: { src: "tiktok", cmp: "test1", at: NOW - DAY }, firstActiveAt: NOW - DAY - 1000 },
      { uid: "c", firstActiveAt: NOW - 20 * DAY },
      { uid: "b", firstActiveAt: NOW - 10 * DAY },
    ]);
  });
});
