import { describe, expect, it } from "vitest";
import { LANES } from "./constants";
import { PICKUP_SEGMENT, PICKUP_START, pickupsBetween, pickupsInSegment, reaches } from "./pickups";

describe("pickup layout", () => {
  it("is the same for the same seed, however the road is sliced", () => {
    const whole = pickupsBetween(42, 0, 5000);
    const pieces = [...pickupsBetween(42, 0, 1234.5), ...pickupsBetween(42, 1234.5000001, 5000)];
    expect(pieces).toEqual(whole);
    expect(pickupsBetween(42, 0, 5000)).toEqual(whole);
  });

  it("differs between seeds", () => {
    expect(pickupsBetween(1, 0, 3000)).not.toEqual(pickupsBetween(2, 0, 3000));
  });

  it("keeps the start clear, and puts one or two in every segment after it", () => {
    const all = pickupsBetween(7, 0, 8000);
    expect(all.every((p) => p.s >= PICKUP_START)).toBe(true);
    for (let segment = 1; segment < 8000 / PICKUP_SEGMENT; segment++) {
      const n = pickupsInSegment(7, segment).length;
      expect(n).toBeGreaterThanOrEqual(1);
      expect(n).toBeLessThanOrEqual(2);
    }
  });

  it("never stacks two pickups in one lane of a segment, and stays on the road", () => {
    for (let segment = 0; segment < 200; segment++) {
      const lanes = pickupsInSegment(99, segment).map((p) => p.lane);
      expect(new Set(lanes).size).toBe(lanes.length);
      for (const lane of lanes) expect(lane >= 0 && lane < LANES.length).toBe(true);
    }
  });

  it("mixes all three kinds, mostly nitro", () => {
    const all = pickupsBetween(5, 0, 40000);
    const share = (kind: string) => all.filter((p) => p.kind === kind).length / all.length;
    expect(share("phase")).toBeGreaterThan(0.12);
    expect(share("phase")).toBeLessThan(0.28);
    expect(share("shield")).toBeGreaterThan(0.17);
    expect(share("shield")).toBeLessThan(0.33);
    expect(share("nitro")).toBeGreaterThan(0.45);
  });
});

describe("reaches", () => {
  it("needs the car level with it, in its lane", () => {
    const p = { id: "1:0", kind: "nitro" as const, s: 500, lane: 1 };
    expect(reaches(p, 501, LANES[1] + 0.8)).toBe(true);
    expect(reaches(p, 505, LANES[1])).toBe(false);
    expect(reaches(p, 500, LANES[2])).toBe(false);
  });
});
