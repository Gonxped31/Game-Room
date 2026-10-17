import { LANES } from "./constants";
import { createRng } from "./traffic";

/**
 * Deep sand on the desert track: patches of soft sand across one or two lanes
 * that drag the car back and make it slide. Like the pickups, a race's patches
 * come from its seed, so both racers meet exactly the same ones. The road is
 * cut into segments, each laid out from its own seed, so any stretch can be
 * computed on its own. Only integer-op randomness and plain arithmetic, as in
 * ./traffic.ts.
 */

export interface SandPatch {
  /** Stable within a layout: "segment:index". */
  id: string;
  /** Where it starts down the road (m), and how long it is (m). */
  s: number;
  length: number;
  /** The first lane it covers (index into LANES), and how many (1 or 2). */
  lane: number;
  lanes: number;
}

/** Road per layout segment (m). */
export const SAND_SEGMENT = 300;
/** No sand before this distance: the start grid and the countdown run stay clear. */
export const SAND_START = 220;
/** Half a lane: a patch reaches this far (m) past its outer lanes' centres. */
const LANE_HALF = 1.8;
/**
 * Drag in deep sand, per metre: the car slows by `SAND_DRAG * v²` (m/s²), so
 * crossing a patch costs the same share of its speed at any speed - about a
 * quarter across an average one (1 - e^(-SAND_DRAG * 29) ≈ 0.26).
 */
export const SAND_DRAG = 0.0103;

/** A segment's seed: the layout seed and segment number mixed with integer ops only. */
function segmentSeed(seed: number, segment: number): number {
  let h = (seed ^ Math.imul(segment + 3, 0x85ebca77)) >>> 0;
  h = Math.imul(h ^ (h >>> 15), 0xc2b2ae3d) >>> 0;
  return (h ^ (h >>> 16)) >>> 0;
}

/** The patches in one segment: none, one or two, never overlapping, and never across more than two lanes. */
export function sandInSegment(seed: number, segment: number): SandPatch[] {
  const rng = createRng(segmentSeed(seed, segment));
  const roll = rng();
  const count = roll < 0.2 ? 0 : roll < 0.7 ? 1 : 2;
  const out: SandPatch[] = [];
  // Two patches go one in each half of the segment, so they can't overlap.
  const span = count === 2 ? SAND_SEGMENT / 2 : SAND_SEGMENT;
  for (let i = 0; i < count; i++) {
    const length = 18 + Math.floor(rng() * 23); // 18-40 m
    const lanes = rng() < 0.45 ? 2 : 1;
    const lane = Math.floor(rng() * (LANES.length - lanes + 1));
    const s = segment * SAND_SEGMENT + i * span + 10 + Math.floor(rng() * (span - length - 20));
    if (s >= SAND_START) out.push({ id: `${segment}:${i}`, s, length, lane, lanes });
  }
  return out;
}

/** Every patch overlapping [from, to], in road order. */
export function sandBetween(seed: number, from: number, to: number): SandPatch[] {
  const out: SandPatch[] = [];
  const first = Math.max(0, Math.floor(from / SAND_SEGMENT));
  const last = Math.floor(to / SAND_SEGMENT);
  for (let segment = first; segment <= last; segment++) {
    for (const p of sandInSegment(seed, segment)) if (p.s + p.length >= from && p.s <= to) out.push(p);
  }
  return out;
}

/** The patch's sideways extent (m): from half a lane outside its first lane to half a lane outside its last. */
export function sandSpan(p: SandPatch): { left: number; right: number } {
  return { left: LANES[p.lane] - LANE_HALF, right: LANES[p.lane + p.lanes - 1] + LANE_HALF };
}

/** Is a car's middle at (s, x) in deep sand? */
export function inSand(seed: number, s: number, x: number): boolean {
  for (const p of sandBetween(seed, s, s)) {
    const { left, right } = sandSpan(p);
    if (s >= p.s && s <= p.s + p.length && x >= left && x <= right) return true;
  }
  return false;
}
