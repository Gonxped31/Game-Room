import { describe, expect, it } from "vitest";
import { fromArchivedRoom, toArchivedRoom, toSnapshot } from "./gameRoomAdapter";
import { computeDashboard, computeInviteLoop, DAY_MS, estimatePlayMs, PLAY_ESTIMATE_CAP_MS, playMs } from "./metrics";
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
        // Closed while someone was still connected: never live.
        room({ code: "closed", onlineUids: ["d"], lastActive: NOW - 30 * 1000, closedAt: NOW - 10 * 1000 }),
      ],
    }),
    ["ftw", "buzzerquiz"],
  );

  it("counts open rooms with someone online, split into playing and waiting", () => {
    expect(stats.totals.liveRooms).toBe(3);
    expect(stats.totals.playingRooms).toBe(1);
    expect(stats.rooms.map((r) => [r.code, r.status])).toEqual([
      ["playing", "playing"],
      ["stalled", "waiting"],
      ["lobby", "waiting"],
      ["empty", "idle"],
      ["closed", "closed"],
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

describe("room list", () => {
  it("lists idle rooms by last activity, then closed rooms by when they closed, leaving out deleted ones", () => {
    const stats = computeDashboard(
      snapshot({
        rooms: [
          room({ code: "older", closedAt: NOW - 60 * MIN, name: "Old" }),
          room({ code: "newer", closedAt: NOW - 5 * MIN }),
          room({ code: "gone", closedAt: NOW - MIN, deleted: true }),
          room({ code: "open" }),
          room({ code: "played", lastActive: NOW - 2 * MIN }),
        ],
      }),
    );
    expect(stats.rooms.map((r) => r.code)).toEqual(["played", "open", "newer", "older"]);
    expect(stats.rooms[0]).toEqual({
      code: "played",
      gameSlug: "ftw",
      name: undefined,
      seatsFilled: 2,
      maxPlayers: 2,
      online: 0,
      status: "idle",
      createdAgoMs: 10 * MIN,
      lastActiveAgoMs: 2 * MIN,
    });
    expect(stats.rooms[3]).toMatchObject({ code: "older", name: "Old", status: "closed", closedAgoMs: 60 * MIN });
  });
});

describe("rooms and play time", () => {
  it("estimates play as created to last active, capped", () => {
    expect(estimatePlayMs(room({ code: "x" }))).toBeNull();
    expect(estimatePlayMs(room({ code: "x", createdAt: NOW - 20 * MIN, lastActive: NOW - 5 * MIN }))).toBe(15 * MIN);
    expect(estimatePlayMs(room({ code: "x", createdAt: NOW - 5 * DAY_MS, lastActive: NOW }))).toBe(PLAY_ESTIMATE_CAP_MS);
  });

  it("prefers the counted minutes over the estimate", () => {
    expect(playMs(room({ code: "x", createdAt: NOW - 5 * DAY_MS, lastActive: NOW, activeMinutes: 12 }))).toBe(12 * MIN);
    expect(playMs(room({ code: "x", createdAt: NOW - 20 * MIN, lastActive: NOW - 5 * MIN }))).toBe(15 * MIN);
    expect(playMs(room({ code: "x" }))).toBeNull();
  });

  it("sums and takes the median over rooms played in the last 30 days", () => {
    const stats = computeDashboard(
      snapshot({
        rooms: [
          room({ code: "a", createdAt: NOW - 30 * MIN, lastActive: NOW - 20 * MIN }),
          room({ code: "b", createdAt: NOW - 60 * MIN, lastActive: NOW - 20 * MIN }),
          room({ code: "c", createdAt: NOW - 100 * MIN, lastActive: NOW - 40 * MIN }),
          room({ code: "counted", createdAt: NOW - 3 * DAY_MS, lastActive: NOW - MIN, activeMinutes: 25 }),
          room({ code: "never-played" }),
          room({ code: "old", createdAt: NOW - 60 * DAY_MS, lastActive: NOW - 59 * DAY_MS }),
        ],
      }),
    );
    expect(stats.totals.playedRooms30d).toBe(4);
    expect(stats.totals.estimatedPlayRooms30d).toBe(3);
    expect(stats.totals.playMs30d).toBe((10 + 40 + 60 + 25) * MIN);
    expect(stats.totals.medianPlayMs30d).toBe(32.5 * MIN);
    expect(stats.totals.roomsCreated30d).toBe(5);
    expect(stats.perGame[0]).toMatchObject({ roomsAllTime: 6, roomsCreated30d: 5, playedRooms30d: 4, medianPlayMs30d: 32.5 * MIN });
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

  it("counts coming back to the same room on another day (daily visits)", () => {
    const stats = computeDashboard(
      snapshot({
        guests: [
          { uid: "same-room", rooms: [entry("r1", NOW - 3 * DAY_MS)], visits: [NOW - 3 * DAY_MS, NOW - DAY_MS] },
          { uid: "once", rooms: [entry("r1", NOW - 3 * DAY_MS)], visits: [NOW - 3 * DAY_MS + MIN] },
        ],
      }),
    );
    expect(stats.totals.returning).toEqual({ count: 1, of: 2, rate: 0.5 });
    expect(stats.totals.returnedWithin7d.of).toBe(0);
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

describe("invite loop", () => {
  const created = (code: string, addedAt: number) => entry(code, addedAt, { createdByMe: true });
  const guests = [
    // Ana creates two rooms; Ben joins the first, then creates his own, which nobody joins.
    { uid: "ana", rooms: [created("r1", NOW - 5 * DAY_MS), created("r2", NOW - 4 * DAY_MS)] },
    { uid: "ben", rooms: [entry("r1", NOW - 5 * DAY_MS), created("r3", NOW - 2 * DAY_MS)] },
    // Cy joins Ana's second room and never creates one.
    { uid: "cy", rooms: [entry("r2", NOW - 4 * DAY_MS)] },
    // Dee came through matchmaking (pub), then created a room: not an invite.
    { uid: "dee", rooms: [entry("pub", NOW - 3 * DAY_MS), created("r4", NOW - DAY_MS)] },
    { uid: "eve", rooms: [created("pub", NOW - 3 * DAY_MS)] },
    // An old room and an old invitee, outside the 30 days.
    { uid: "old", rooms: [created("r0", NOW - 60 * DAY_MS)] },
    { uid: "olda", rooms: [entry("r0", NOW - 60 * DAY_MS), created("r5", NOW - DAY_MS)] },
  ];
  const rooms = [room({ code: "pub", matchmade: true })];
  const loop = computeInviteLoop(rooms, guests, NOW - 30 * DAY_MS);

  it("counts private rooms created in the window that got a second guest", () => {
    // r1, r2, r3, r4, r5 were created in the window; r1 and r2 got a guest. pub is matchmade.
    expect(loop.converted).toEqual({ count: 2, of: 5, rate: 0.4 });
  });

  it("counts invited guests and the creators who brought them", () => {
    expect(loop.invitedGuests).toBe(2); // ben, cy
    expect(loop.creators).toBe(4); // ana, ben, dee, olda; eve's matchmade room is left out
  });

  it("counts invited newcomers who went on to create a room", () => {
    // Newcomers from a link in the window: ben (created r3) and cy (didn't). Dee came from matchmaking; olda is too old.
    expect(loop.loop).toEqual({ count: 1, of: 2, rate: 0.5 });
  });

  it("is part of the dashboard", () => {
    expect(computeDashboard(snapshot({ rooms, guests })).inviteLoop).toEqual(loop);
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
        activeMinutes: { n: 7, at: NOW },
        ftw: { round: 3 },
      },
      closed1: { meta: { gameSlug: "ftw", maxPlayers: 2, createdAt: NOW - MIN, createdBy: "a" }, closedAt: NOW },
      public1: { meta: { gameSlug: "buzzerquiz", maxPlayers: 4, createdAt: NOW - MIN, createdBy: "a", publicLang: "en" } },
      nometa: { seats: { p1: "a" } },
      badtime: { meta: { gameSlug: "ftw", createdAt: "yesterday" } },
    };
    const users = {
      a: { rooms: { abc123: { gameSlug: "ftw", addedAt: NOW - MIN, createdByMe: true }, broken: { addedAt: NOW } }, visits: { "20261023": { abc123: { gameSlug: "ftw", at: NOW - DAY_MS } }, "20261024": "bad" } },
      b: {},
    };
    const snap = toSnapshot(games, users, NOW);
    expect(snap.rooms).toEqual([
      { code: "abc123", gameSlug: "ftw", createdAt: NOW - MIN, lastActive: NOW, activeMinutes: 7, name: "Friday", seatsFilled: 1, maxPlayers: 2, onlineUids: ["a"] },
      { code: "closed1", gameSlug: "ftw", createdAt: NOW - MIN, lastActive: undefined, name: undefined, seatsFilled: 0, maxPlayers: 2, onlineUids: [], closedAt: NOW },
      { code: "public1", gameSlug: "buzzerquiz", createdAt: NOW - MIN, lastActive: undefined, name: undefined, seatsFilled: 0, maxPlayers: 4, onlineUids: [], matchmade: true },
    ]);
    expect(snap.guests).toEqual([
      // The visit a day earlier than addedAt becomes the room's first day.
      { uid: "a", rooms: [{ code: "abc123", gameSlug: "ftw", addedAt: NOW - DAY_MS, createdByMe: true }], visits: [NOW - DAY_MS] },
      { uid: "b", rooms: [] },
    ]);
  });

  it("archives a room for deletion without names or game state, and reads it back", () => {
    const raw = {
      meta: { gameSlug: "ftw", maxPlayers: 2, createdAt: NOW - DAY_MS, createdBy: "a", name: "Friday", nameKey: "friday" },
      seats: { p1: "a", p2: "b" },
      lastActive: NOW - MIN,
      activeMinutes: { n: 9, at: NOW - MIN },
      closedAt: NOW - 30 * 1000,
      ftw: { round: 3 },
    };
    const users = {
      a: { rooms: { abc234: { gameSlug: "ftw", addedAt: NOW - DAY_MS, createdByMe: true }, other1: { gameSlug: "ftw", addedAt: NOW } } },
      b: { rooms: { abc234: { gameSlug: "ftw", addedAt: NOW - DAY_MS + MIN } } },
      c: { rooms: { other1: { gameSlug: "ftw", addedAt: NOW } } },
    };
    const archived = toArchivedRoom("abc234", raw, users, NOW);
    expect(archived).toEqual({
      gameSlug: "ftw",
      maxPlayers: 2,
      createdAt: NOW - DAY_MS,
      seatsFilled: 2,
      deletedAt: NOW,
      lastActive: NOW - MIN,
      activeMinutes: 9,
      closedAt: NOW - 30 * 1000,
      createdBy: "a",
      guests: { a: { addedAt: NOW - DAY_MS, createdByMe: true }, b: { addedAt: NOW - DAY_MS + MIN } },
    });
    expect(JSON.stringify(archived)).not.toContain("undefined");
    expect(fromArchivedRoom("abc234", archived)).toEqual({
      code: "abc234",
      gameSlug: "ftw",
      createdAt: NOW - DAY_MS,
      lastActive: NOW - MIN,
      activeMinutes: 9,
      seatsFilled: 2,
      maxPlayers: 2,
      onlineUids: [],
      closedAt: NOW - 30 * 1000,
      deleted: true,
    });
    expect(fromArchivedRoom("bad", { gameSlug: "ftw" })).toBeNull();
  });

  it("counts deleted rooms from the archive, and puts back guest entries the hub dropped", () => {
    const archive = {
      abc234: { gameSlug: "ftw", maxPlayers: 2, createdAt: NOW - DAY_MS, seatsFilled: 2, closedAt: NOW - MIN, deletedAt: NOW, guests: { a: { addedAt: NOW - DAY_MS, createdByMe: true }, b: { addedAt: NOW - DAY_MS } } },
    };
    // a still has the entry; b's hub dropped it (b has no rooms left at all).
    const users = { a: { rooms: { abc234: { gameSlug: "ftw", addedAt: NOW - DAY_MS, createdByMe: true } } } };
    const snap = toSnapshot(null, users, NOW, archive);
    expect(snap.rooms.map((r) => [r.code, r.deleted])).toEqual([["abc234", true]]);
    expect(snap.guests).toEqual([
      { uid: "a", rooms: [{ code: "abc234", gameSlug: "ftw", addedAt: NOW - DAY_MS, createdByMe: true }] },
      { uid: "b", rooms: [{ code: "abc234", gameSlug: "ftw", addedAt: NOW - DAY_MS, createdByMe: false }] },
    ]);
    const stats = computeDashboard(snap);
    expect(stats.totals.playersAllTime).toBe(2);
    expect(stats.inviteLoop.converted).toEqual({ count: 1, of: 1, rate: 1 });
    expect(stats.rooms).toEqual([]); // deleted, so not listed
  });

  it("keeps guests who left a room (their room list is cleared, their visits stay)", () => {
    const games = {
      abc234: { meta: { gameSlug: "ftw", maxPlayers: 2, createdAt: NOW - 2 * DAY_MS, createdBy: "ana" }, seats: {} },
    };
    // Both left with "Leave room": no rooms entries, only visits.
    const users = {
      ana: { visits: { "20261022": { abc234: { gameSlug: "ftw", at: NOW - 2 * DAY_MS } } } },
      ben: { visits: { "20261022": { abc234: { gameSlug: "ftw", at: NOW - 2 * DAY_MS + MIN } }, "20261024": { abc234: { gameSlug: "ftw", at: NOW - MIN } } } },
    };
    const snap = toSnapshot(games, users, NOW);
    expect(snap.guests).toEqual([
      { uid: "ana", rooms: [{ code: "abc234", gameSlug: "ftw", addedAt: NOW - 2 * DAY_MS, createdByMe: true }], visits: [NOW - 2 * DAY_MS] },
      { uid: "ben", rooms: [{ code: "abc234", gameSlug: "ftw", addedAt: NOW - 2 * DAY_MS + MIN, createdByMe: false }], visits: [NOW - 2 * DAY_MS + MIN, NOW - MIN] },
    ]);
    const stats = computeDashboard(snap);
    expect(stats.totals.playersAllTime).toBe(2);
    expect(stats.inviteLoop.converted).toEqual({ count: 1, of: 1, rate: 1 });
    expect(stats.totals.returning).toEqual({ count: 1, of: 2, rate: 0.5 }); // ben came back today
  });

  it("accepts an empty database", () => {
    expect(toSnapshot(null, null, NOW)).toEqual({ rooms: [], guests: [], now: NOW });
  });
});
