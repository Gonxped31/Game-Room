import { describe, expect, it } from "vitest";
import { toSnapshot } from "./gameRoomAdapter";
import { computeDashboard, DAY_MS, estimatePlayMs, PLAY_ESTIMATE_CAP_MS } from "./metrics";
import type { GuestRoomSnap, RoomSnap, Snapshot } from "./types";

// Noon UTC, so "today" and "yesterday" are unambiguous.
const NOW = Date.UTC(2026, 9, 24, 12);
const MIN = 60 * 1000;

const room = (over: Partial<RoomSnap> & Pick<RoomSnap, "code">): RoomSnap => ({
  gameSlug: "ftw",
  createdAt: NOW - 10 * MIN,
  seatsFilled: 2,
  maxPlayers: 2,
  onlineUids: [],
  ...over,
});
const entry = (code: string, addedAt: number, over: Partial<GuestRoomSnap> = {}): GuestRoomSnap => ({ code, gameSlug: "ftw", addedAt, createdByMe: false, ...over });
const snapshot = (over: Partial<Snapshot>): Snapshot => ({ rooms: [], guests: [], now: NOW, ...over });

describe("live rooms", () => {
  const stats = computeDashboard(
    snapshot({
      rooms: [
        room({ code: "playing", onlineUids: ["a", "b"], lastActive: NOW - 30 * 1000 }),
        room({ code: "stalled", onlineUids: ["c"], lastActive: NOW - 5 * MIN, gameSlug: "buzzerquiz", maxPlayers: 4 }),
        room({ code: "lobby", onlineUids: ["a"], seatsFilled: 1 }),
        room({ code: "empty", onlineUids: [], lastActive: NOW - 30 * 1000 }),
      ],
    }),
    ["ftw", "buzzerquiz"],
  );

  it("counts rooms with someone online, split into playing and waiting", () => {
    expect(stats.totals.liveRooms).toBe(3);
    expect(stats.totals.playingRooms).toBe(1);
    expect(stats.liveRooms.map((r) => [r.code, r.status])).toEqual([
      ["playing", "playing"],
      ["stalled", "waiting"],
      ["lobby", "waiting"],
    ]);
  });

  it("counts each online guest once, and live rooms per game", () => {
    expect(stats.totals.onlineGuests).toBe(3);
    expect(stats.perGame.map((g) => [g.gameSlug, g.liveRooms])).toEqual([
      ["ftw", 2],
      ["buzzerquiz", 1],
    ]);
  });
});

describe("players per game", () => {
  const stats = computeDashboard(
    snapshot({
      guests: [
        { uid: "a", rooms: [entry("r1", NOW - DAY_MS), entry("r2", NOW - 40 * DAY_MS, { gameSlug: "wordscramble" })] },
        { uid: "b", rooms: [entry("r1", NOW - 2 * DAY_MS), entry("r3", NOW - DAY_MS)] },
        { uid: "c", rooms: [] },
      ],
    }),
    ["ftw"],
  );

  it("counts distinct guests per game, all time and in the last 30 days", () => {
    const ftw = stats.perGame.find((g) => g.gameSlug === "ftw")!;
    const ws = stats.perGame.find((g) => g.gameSlug === "wordscramble")!;
    expect([ftw.playersAllTime, ftw.players30d]).toEqual([2, 2]);
    expect([ws.playersAllTime, ws.players30d]).toEqual([1, 0]);
    expect([stats.totals.playersAllTime, stats.totals.players30d]).toEqual([2, 2]);
  });

  it("appends games found in the data but missing from the order", () => {
    expect(stats.perGame.map((g) => g.gameSlug)).toEqual(["ftw", "wordscramble"]);
  });
});

describe("rooms and play time", () => {
  it("estimates play as created to last active, capped", () => {
    expect(estimatePlayMs(room({ code: "x" }))).toBeNull();
    expect(estimatePlayMs(room({ code: "x", createdAt: NOW - 20 * MIN, lastActive: NOW - 5 * MIN }))).toBe(15 * MIN);
    expect(estimatePlayMs(room({ code: "x", createdAt: NOW - 5 * DAY_MS, lastActive: NOW }))).toBe(PLAY_ESTIMATE_CAP_MS);
  });

  it("sums and takes the median over rooms played in the last 30 days", () => {
    const stats = computeDashboard(
      snapshot({
        rooms: [
          room({ code: "a", createdAt: NOW - 30 * MIN, lastActive: NOW - 20 * MIN }),
          room({ code: "b", createdAt: NOW - 60 * MIN, lastActive: NOW - 20 * MIN }),
          room({ code: "c", createdAt: NOW - 100 * MIN, lastActive: NOW - 40 * MIN }),
          room({ code: "never-played" }),
          room({ code: "old", createdAt: NOW - 60 * DAY_MS, lastActive: NOW - 59 * DAY_MS }),
        ],
      }),
    );
    expect(stats.totals.playedRooms30d).toBe(3);
    expect(stats.totals.playMs30d).toBe((10 + 40 + 60) * MIN);
    expect(stats.totals.medianPlayMs30d).toBe(40 * MIN);
    expect(stats.totals.roomsCreated30d).toBe(4);
    expect(stats.perGame[0]).toMatchObject({ roomsAllTime: 5, roomsCreated30d: 4, playedRooms30d: 3, medianPlayMs30d: 40 * MIN });
  });

  it("has no median when nothing was played", () => {
    expect(computeDashboard(snapshot({ rooms: [room({ code: "a" })] })).totals.medianPlayMs30d).toBeNull();
  });
});

describe("return rate", () => {
  it("counts guests seen before today who were active on 2+ days", () => {
    const stats = computeDashboard(
      snapshot({
        guests: [
          { uid: "back", rooms: [entry("r1", NOW - 3 * DAY_MS), entry("r2", NOW - DAY_MS)] },
          { uid: "once", rooms: [entry("r1", NOW - 3 * DAY_MS)] },
          { uid: "same-day", rooms: [entry("r1", NOW - 2 * DAY_MS), entry("r2", NOW - 2 * DAY_MS + MIN)] },
          { uid: "new-today", rooms: [entry("r3", NOW - MIN), entry("r4", NOW)] },
        ],
      }),
    );
    expect(stats.totals.returning).toEqual({ count: 1, of: 3, rate: 1 / 3 });
  });

  it("counts a 7-day return only for guests first seen a week ago, within their first week", () => {
    const stats = computeDashboard(
      snapshot({
        guests: [
          { uid: "quick", rooms: [entry("r1", NOW - 10 * DAY_MS), entry("r2", NOW - 8 * DAY_MS)] },
          { uid: "late", rooms: [entry("r1", NOW - 20 * DAY_MS), entry("r2", NOW - DAY_MS)] },
          { uid: "too-new", rooms: [entry("r1", NOW - 3 * DAY_MS), entry("r2", NOW - DAY_MS)] },
        ],
      }),
    );
    expect(stats.totals.returnedWithin7d).toEqual({ count: 1, of: 2, rate: 0.5 });
  });

  it("has no rate while nobody qualifies", () => {
    expect(computeDashboard(snapshot({})).totals.returning).toEqual({ count: 0, of: 0, rate: null });
  });
});

describe("gameRoomAdapter", () => {
  it("maps the games and users trees, skipping malformed entries", () => {
    const games = {
      abc123: {
        meta: { gameSlug: "ftw", maxPlayers: 2, createdAt: NOW - MIN, createdBy: "a", name: "Friday" },
        seats: { p1: "a", p2: null },
        members: { a: "p1" },
        presence: { a: { online: true, lastSeen: NOW }, b: { online: false, lastSeen: NOW - MIN } },
        lastActive: NOW,
        ftw: { round: 3 },
      },
      nometa: { seats: { p1: "a" } },
      badtime: { meta: { gameSlug: "ftw", createdAt: "yesterday" } },
    };
    const users = {
      a: { rooms: { abc123: { gameSlug: "ftw", addedAt: NOW - MIN, createdByMe: true }, broken: { addedAt: NOW } } },
      b: {},
    };
    const snap = toSnapshot(games, users, NOW);
    expect(snap.rooms).toEqual([
      { code: "abc123", gameSlug: "ftw", createdAt: NOW - MIN, lastActive: NOW, name: "Friday", seatsFilled: 1, maxPlayers: 2, onlineUids: ["a"] },
    ]);
    expect(snap.guests).toEqual([
      { uid: "a", rooms: [{ code: "abc123", gameSlug: "ftw", addedAt: NOW - MIN, createdByMe: true }] },
      { uid: "b", rooms: [] },
    ]);
  });

  it("accepts an empty database", () => {
    expect(toSnapshot(null, null, NOW)).toEqual({ rooms: [], guests: [], now: NOW });
  });
});
