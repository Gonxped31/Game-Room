import { describe, expect, it } from "vitest";
import { countByStatus, DEFAULT_FILTER, filterRooms, normalizeQuery, type RoomFilter } from "./roomFilter";
import type { RoomRow } from "./types";

const row = (over: Partial<RoomRow> & Pick<RoomRow, "code">): RoomRow => ({
  gameSlug: "ftw",
  seatsFilled: 2,
  maxPlayers: 2,
  online: 0,
  status: "idle",
  createdAgoMs: 0,
  ...over,
});

const rooms = [
  row({ code: "abc234", name: "Friday Night", status: "playing", online: 2 }),
  row({ code: "q6r7s8", gameSlug: "buzzerquiz", maxPlayers: 4, seatsFilled: 1, status: "waiting", online: 1 }),
  row({ code: "m3n4p5", seatsFilled: 0, status: "idle" }),
  row({ code: "fri111", name: "Quiz", gameSlug: "buzzerquiz", maxPlayers: 4, seatsFilled: 4, status: "idle" }),
  row({ code: "zzz999", name: "Old friday", seatsFilled: 1, status: "closed" }),
];
const codes = (filter: Partial<RoomFilter>) => filterRooms(rooms, { ...DEFAULT_FILTER, ...filter }).map((r) => r.code);

describe("filterRooms", () => {
  it("shows live rooms by default", () => {
    expect(codes({})).toEqual(["abc234", "q6r7s8"]);
  });

  it("filters by status", () => {
    expect(codes({ status: "open" })).toEqual(["abc234", "q6r7s8", "m3n4p5", "fri111"]);
    expect(codes({ status: "closed" })).toEqual(["zzz999"]);
    expect(codes({ status: "all" })).toHaveLength(5);
  });

  it("finds a room by part of its name or code, ignoring case", () => {
    expect(codes({ status: "all", query: "FRIDAY" })).toEqual(["abc234", "zzz999"]);
    expect(codes({ status: "all", query: "fri" })).toEqual(["abc234", "fri111", "zzz999"]);
    expect(codes({ status: "all", query: " r7s " })).toEqual(["q6r7s8"]);
  });

  it("accepts a pasted room link", () => {
    expect(normalizeQuery("https://game-room.app/same-page#ABC234")).toBe("abc234");
    expect(codes({ status: "all", query: "http://localhost:3000/buzzerquiz#q6r7s8" })).toEqual(["q6r7s8"]);
  });

  it("filters by game", () => {
    expect(codes({ status: "all", gameSlug: "buzzerquiz" })).toEqual(["q6r7s8", "fri111"]);
  });

  it("filters by how many people hold a seat", () => {
    expect(codes({ status: "all", players: "empty" })).toEqual(["m3n4p5"]);
    expect(codes({ status: "all", players: "under2" })).toEqual(["q6r7s8", "m3n4p5", "zzz999"]);
    expect(codes({ status: "all", players: "2plus" })).toEqual(["abc234", "fri111"]);
    expect(codes({ status: "all", players: "full" })).toEqual(["abc234", "fri111"]);
  });

  it("combines filters", () => {
    expect(codes({ status: "open", gameSlug: "buzzerquiz", players: "under2" })).toEqual(["q6r7s8"]);
  });
});

describe("countByStatus", () => {
  it("counts each status with the other filters applied", () => {
    expect(countByStatus(rooms, DEFAULT_FILTER)).toEqual({ live: 2, open: 4, closed: 1, all: 5 });
    expect(countByStatus(rooms, { ...DEFAULT_FILTER, query: "friday" })).toEqual({ live: 1, open: 1, closed: 1, all: 2 });
  });
});
