import { createRng } from "./traffic";

/**
 * The road's curves. The game itself stays straight - traffic, pickups,
 * collisions and the race sync all live in road coordinates (distance `s`,
 * lateral `x`) - and the curves are drawn by bending the world sideways in
 * the vertex shaders, by how far ahead each point is (like classic arcade
 * racers). Driving still feels them: the car is pushed toward the outside of
 * a bend in proportion to speed², so you steer into it.
 *
 * A race's curves come from its seed, so both racers face the same road.
 */

/** Road per curve segment (m). Each is straight or one smooth bend. */
export const CURVE_SEGMENT = 400;
/** Share of segments that bend. */
export const CURVE_SHARE = 0.6;
/** Curvature range (1/m) at a bend's sharpest point; the sign picks left or right. */
export const CURVATURE_MIN = 4.0e-4;
export const CURVATURE_MAX = 1.2e-3;
/** How hard a bend pushes the car outward: lateral speed = curvature × speed² × this. */
export const CENTRIFUGAL = 1.2;

/**
 * How much stronger bends are drawn than they are. At true scale, from a low
 * chase camera, a bend flattens into the horizon; arcade racers exaggerate
 * it. Only the picture changes - the game happens in road coordinates, and the
 * outward push uses the real curvature.
 */
export const BEND_EXAGGERATION = 3;

/** The bend table the shaders read: lateral offsets at fixed distances ahead (negative = behind the car). */
export const BEND_START = -96;
export const BEND_STEP = 48;
export const BEND_SAMPLES = 34; // covers -96 m to 1488 m

function segmentSeed(seed: number, segment: number): number {
  let h = (seed ^ Math.imul(segment + 7, 0x27d4eb2d)) >>> 0;
  h = Math.imul(h ^ (h >>> 15), 0x165667b1) >>> 0;
  return (h ^ (h >>> 13)) >>> 0;
}

/** A segment's peak curvature: 0 for a straight, ± for a bend. The first segment (the start) is always straight. */
export function segmentCurvature(seed: number, segment: number): number {
  if (segment <= 0) return 0;
  const rng = createRng(segmentSeed(seed, segment));
  if (rng() >= CURVE_SHARE) return 0;
  const sign = rng() < 0.5 ? -1 : 1;
  return sign * (CURVATURE_MIN + rng() * (CURVATURE_MAX - CURVATURE_MIN));
}

/**
 * Curvature (1/m, + bends right) at distance `s`: within a bending segment it
 * rises and falls as sin², so it starts and ends at zero with no kink.
 */
export function curvatureAt(seed: number, s: number): number {
  if (s <= 0) return 0;
  const segment = Math.floor(s / CURVE_SEGMENT);
  const peak = segmentCurvature(seed, segment);
  if (peak === 0) return 0;
  const t = (s - segment * CURVE_SEGMENT) / CURVE_SEGMENT;
  const sine = Math.sin(Math.PI * t);
  return peak * sine * sine;
}

/**
 * Fills `out` (BEND_SAMPLES long) with how far the road's centre line sits to
 * the side, relative to the car's own heading, at each sampled distance
 * ahead of `dist`: the double integral of the curvature. 0 at the car.
 */
export function fillBendTable(seed: number, dist: number, out: Float32Array | number[]) {
  const step = 4;
  // Integrate outward from the car (d = 0) in each direction, visiting the
  // samples nearest first, so each one continues from the last.
  const ahead: number[] = [];
  const behind: number[] = [];
  for (let i = 0; i < BEND_SAMPLES; i++) (BEND_START + i * BEND_STEP >= 0 ? ahead : behind).push(i);
  behind.reverse();
  for (const [direction, samples] of [
    [1, ahead],
    [-1, behind],
  ] as const) {
    let heading = 0;
    let offset = 0;
    let d = 0;
    for (const i of samples) {
      const target = BEND_START + i * BEND_STEP;
      while (Math.abs(d) < Math.abs(target)) {
        const ds = direction * Math.min(step, Math.abs(target) - Math.abs(d));
        heading += curvatureAt(seed, dist + d + ds / 2) * ds;
        offset += heading * ds;
        d += ds;
      }
      out[i] = offset;
    }
  }
}

/** The road's sideways offset at `ahead` metres, read from a filled table (as the shaders do). */
export function bendAt(table: Float32Array | number[], ahead: number): number {
  const f = Math.min(Math.max((ahead - BEND_START) / BEND_STEP, 0), BEND_SAMPLES - 1.001);
  const i = Math.floor(f);
  return table[i] + (table[i + 1] - table[i]) * (f - i);
}

// ---------- hills (the desert circuit) ----------
// Drawn like the curves: the world is lifted in the vertex shaders by how
// much higher the road is at each distance ahead than under the car. Only the
// picture changes; the game still happens on a flat road.

/** Road per hill segment (m). Each is flat, or one smooth crest or dip. */
export const HILL_SEGMENT = 260;
/** Share of segments with a crest or a dip. */
export const HILL_SHARE = 0.7;
/** Height range (m) of a crest (or depth of a dip) at its middle. */
export const HILL_HEIGHT_MIN = 6;
export const HILL_HEIGHT_MAX = 18;

/** A segment's height at its middle: 0 when flat, + a crest, - a dip. The first segment (the start) is always flat. */
export function segmentHill(seed: number, segment: number): number {
  if (segment <= 0) return 0;
  // Mixed, so the hills don't line up with the curves (which use the same seed).
  const rng = createRng(segmentSeed((seed ^ 0x9e3779b9) >>> 0, segment));
  if (rng() >= HILL_SHARE) return 0;
  const sign = rng() < 0.6 ? 1 : -1;
  return sign * (HILL_HEIGHT_MIN + rng() * (HILL_HEIGHT_MAX - HILL_HEIGHT_MIN));
}

/** The road's height (m) at distance `s`: each segment rises and falls as 1 - cos, so it starts and ends level. */
export function heightAt(seed: number, s: number): number {
  if (s <= 0) return 0;
  const segment = Math.floor(s / HILL_SEGMENT);
  const peak = segmentHill(seed, segment);
  if (peak === 0) return 0;
  const t = (s - segment * HILL_SEGMENT) / HILL_SEGMENT;
  return (peak * (1 - Math.cos(2 * Math.PI * t))) / 2;
}

/** Fills `out` (BEND_SAMPLES long, on the bend table's grid) with the road's height at each distance ahead, relative to the car's. */
export function fillHillTable(seed: number, dist: number, out: Float32Array | number[]) {
  const here = heightAt(seed, dist);
  for (let i = 0; i < BEND_SAMPLES; i++) out[i] = heightAt(seed, dist + BEND_START + i * BEND_STEP) - here;
}
