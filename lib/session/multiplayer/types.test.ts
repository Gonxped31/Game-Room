import { describe, expect, it } from "vitest";
import { seatIds } from "./types";

describe("seatIds", () => {
  it("generates p1..pN for a given player count", () => {
    expect(seatIds(3)).toEqual(["p1", "p2", "p3"]);
  });

  it("works for 2 players (degenerate case)", () => {
    expect(seatIds(2)).toEqual(["p1", "p2"]);
  });

  it("works for larger player counts", () => {
    expect(seatIds(6)).toEqual(["p1", "p2", "p3", "p4", "p5", "p6"]);
  });

  it("returns an empty array for 0 players", () => {
    expect(seatIds(0)).toEqual([]);
  });
});
