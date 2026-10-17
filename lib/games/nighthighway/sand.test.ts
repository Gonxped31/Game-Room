import { describe, expect, it } from "vitest";
import { LANES } from "./constants";
import { inSand, SAND_DRAG, SAND_SEGMENT, SAND_START, sandBetween, sandInSegment, sandSpan } from "./sand";

describe("deep sand layout", () => {
  it("is the same for the same seed, however the road is sliced", () => {
    const whole = sandBetween(42, 0, 6000);
    const pieces = [...sandBetween(42, 0, 2999.5), ...sandBetween(42, 3000, 6000)];
    expect(pieces.map((p) => p.id)).toEqual(whole.map((p) => p.id));
    expect(sandBetween(42, 0, 6000)).toEqual(whole);
  });

  it("differs between seeds", () => {
    expect(sandBetween(1, 0, 6000)).not.toEqual(sandBetween(2, 0, 6000));
  });

  it("keeps the start clear", () => {
    for (const seed of [3, 99, 2024]) expect(sandBetween(seed, 0, 20000).every((p) => p.s >= SAND_START)).toBe(true);
  });

  it("always leaves a way round: at most two lanes, inside the road, never overlapping", () => {
    for (let segment = 0; segment < 400; segment++) {
      const patches = sandInSegment(7, segment);
      expect(patches.length).toBeLessThanOrEqual(2);
      for (const p of patches) {
        expect(p.lanes === 1 || p.lanes === 2).toBe(true);
        expect(p.lane + p.lanes).toBeLessThanOrEqual(LANES.length);
        expect(p.length).toBeGreaterThanOrEqual(18);
        expect(p.length).toBeLessThanOrEqual(40);
        expect(p.s).toBeGreaterThanOrEqual(segment * SAND_SEGMENT);
        expect(p.s + p.length).toBeLessThanOrEqual((segment + 1) * SAND_SEGMENT);
      }
      if (patches.length === 2) expect(patches[0].s + patches[0].length).toBeLessThan(patches[1].s);
    }
  });

  it("has some sand most of the way down the road", () => {
    const segments = 200;
    const withSand = Array.from({ length: segments }, (_, i) => sandInSegment(5, i + 1).length > 0).filter(Boolean).length;
    expect(withSand / segments).toBeGreaterThan(0.6);
  });

  it("knows where the sand is", () => {
    const p = sandBetween(11, 1000, 20000)[0];
    const { left, right } = sandSpan(p);
    expect(inSand(11, p.s + p.length / 2, (left + right) / 2)).toBe(true);
    expect(inSand(11, p.s - 1, (left + right) / 2)).toBe(false);
    expect(inSand(11, p.s + p.length / 2, right + 0.5)).toBe(false);
  });

  it("costs about a quarter of the speed across an average patch, at any speed", () => {
    for (const v0 of [25, 50, 90]) {
      let v = v0;
      let s = 0;
      const dt = 1 / 240;
      while (s < 29) {
        v -= SAND_DRAG * v * v * dt;
        s += v * dt;
      }
      expect(1 - v / v0).toBeGreaterThan(0.22);
      expect(1 - v / v0).toBeLessThan(0.3);
    }
  });
});
