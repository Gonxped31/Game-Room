import { describe, expect, it } from "vitest";
import { AUTO_START_FULL_MS, AUTO_START_MS, betterRoom, nextAutoStart, type Queue, QUEUE_STALE_MS, rankRooms, staleRooms } from "./matchmaking";

const NOW = 1_000_000;
const fresh = (players: number) => ({ players, updatedAt: NOW - 1000 });
const stale = (players: number) => ({ players, updatedAt: NOW - QUEUE_STALE_MS - 1 });

describe("rankRooms", () => {
  it("tries the fullest fresh rooms with a free seat first, then by code", () => {
    const queue: Queue = { ccc222: fresh(1), aaa222: fresh(1), bbb222: fresh(3), ddd222: fresh(4), eee222: stale(3) };
    expect(rankRooms(queue, { now: NOW, maxPlayers: 4 })).toEqual(["bbb222", "aaa222", "ccc222"]);
  });

  it("skips the excluded room, and copes with an empty queue", () => {
    expect(rankRooms({ aaa222: fresh(1) }, { now: NOW, maxPlayers: 4, exclude: "aaa222" })).toEqual([]);
    expect(rankRooms(null, { now: NOW, maxPlayers: 4 })).toEqual([]);
  });
});

describe("staleRooms", () => {
  it("lists entries nobody refreshed for over a minute", () => {
    expect(staleRooms({ aaa222: fresh(1), bbb222: stale(2) }, NOW)).toEqual(["bbb222"]);
  });
});

describe("betterRoom", () => {
  it("moves a lone player to a room with company", () => {
    expect(betterRoom({ mmm222: fresh(1), zzz222: fresh(2) }, { mine: "mmm222", now: NOW, maxPlayers: 4 })).toBe("zzz222");
  });

  it("between two lone rooms, exactly one player moves: to the lower code", () => {
    const queue: Queue = { aaa222: fresh(1), bbb222: fresh(1) };
    expect(betterRoom(queue, { mine: "bbb222", now: NOW, maxPlayers: 4 })).toBe("aaa222");
    expect(betterRoom(queue, { mine: "aaa222", now: NOW, maxPlayers: 4 })).toBeNull();
  });

  it("ignores full, empty and stale rooms", () => {
    const queue: Queue = { aaa222: fresh(4), bbb222: fresh(0), ccc222: stale(2), mmm222: fresh(1) };
    expect(betterRoom(queue, { mine: "mmm222", now: NOW, maxPlayers: 4 })).toBeNull();
  });
});

describe("nextAutoStart", () => {
  it("has no countdown until the game is ready", () => {
    expect(nextAutoStart({ current: null, ready: false, full: false, now: NOW })).toBeNull();
    expect(nextAutoStart({ current: NOW + 5000, ready: false, full: false, now: NOW })).toBeNull();
  });

  it("counts down from the moment it's ready, and keeps that deadline", () => {
    expect(nextAutoStart({ current: null, ready: true, full: false, now: NOW })).toBe(NOW + AUTO_START_MS);
    expect(nextAutoStart({ current: NOW + 3000, ready: true, full: false, now: NOW })).toBe(NOW + 3000);
  });

  it("brings the start forward once the room is full, never back", () => {
    expect(nextAutoStart({ current: NOW + 15_000, ready: true, full: true, now: NOW })).toBe(NOW + AUTO_START_FULL_MS);
    expect(nextAutoStart({ current: NOW + 2000, ready: true, full: true, now: NOW })).toBe(NOW + 2000);
    expect(nextAutoStart({ current: null, ready: true, full: true, now: NOW })).toBe(NOW + AUTO_START_FULL_MS);
  });
});
