import { describe, expect, it } from "vitest";
import { BEND_SAMPLES, BEND_START, BEND_STEP, bendAt, CURVATURE_MAX, CURVE_SEGMENT, curvatureAt, fillBendTable, segmentCurvature } from "./road";

describe("curvature", () => {
  it("is the same for the same seed and differs between seeds", () => {
    const at = (seed: number) => Array.from({ length: 60 }, (_, i) => curvatureAt(seed, i * 97));
    expect(at(3)).toEqual(at(3));
    expect(at(3)).not.toEqual(at(4));
  });

  it("keeps the start straight", () => {
    for (let s = -100; s < CURVE_SEGMENT; s += 5) expect(curvatureAt(9, s)).toBe(0);
  });

  it("bends both ways, within range, and some segments stay straight", () => {
    const peaks = Array.from({ length: 300 }, (_, i) => segmentCurvature(11, i + 1));
    expect(peaks.some((k) => k > 0)).toBe(true);
    expect(peaks.some((k) => k < 0)).toBe(true);
    expect(peaks.some((k) => k === 0)).toBe(true);
    for (const k of peaks) expect(Math.abs(k)).toBeLessThanOrEqual(CURVATURE_MAX);
  });

  it("has no jumps, even across segment boundaries", () => {
    for (let s = 0; s < 20000; s += 2) expect(Math.abs(curvatureAt(5, s + 2) - curvatureAt(5, s))).toBeLessThan(3e-5);
  });
});

describe("the bend table", () => {
  it("is zero at the car, and zero everywhere on a straight start", () => {
    const table = new Float32Array(BEND_SAMPLES);
    fillBendTable(1, 0, table);
    const atCar = (0 - BEND_START) / BEND_STEP;
    expect(table[atCar]).toBe(0);
    expect(Math.abs(bendAt(table, 300))).toBeLessThan(1e-9);
  });

  it("bends toward a right-hand curve's side, more the further ahead", () => {
    // Find a right-hand bend and stand at its start.
    let segment = 1;
    while (segmentCurvature(21, segment) <= 0) segment++;
    const table = new Float32Array(BEND_SAMPLES);
    fillBendTable(21, segment * CURVE_SEGMENT, table);
    expect(bendAt(table, 200)).toBeGreaterThan(0);
    expect(bendAt(table, 400)).toBeGreaterThan(bendAt(table, 200));
    expect(Math.abs(bendAt(table, -50))).toBeLessThan(1); // behind the car, barely any
  });

  it("curves equally ahead and behind in a steady bend, like a circle", () => {
    // Stand at the sharpest point of a strong bend: curvature is nearly flat around it.
    let segment = 1;
    while (Math.abs(segmentCurvature(33, segment)) < 8e-4) segment++;
    const table = new Float32Array(BEND_SAMPLES);
    fillBendTable(33, (segment + 0.5) * CURVE_SEGMENT, table);
    for (const d of [48, 96]) {
      expect(Math.sign(bendAt(table, -d))).toBe(Math.sign(bendAt(table, d)));
      expect(bendAt(table, -d)).toBeCloseTo(bendAt(table, d), 0);
    }
    expect(Math.abs(bendAt(table, -48))).toBeLessThan(Math.abs(bendAt(table, -96)));
  });

  it("interpolates between samples", () => {
    const table = Array.from({ length: BEND_SAMPLES }, (_, i) => i * 10);
    expect(bendAt(table, BEND_START + BEND_STEP * 2.5)).toBeCloseTo(25);
  });
});
