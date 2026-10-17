import { LANES } from "./constants";
import { createRng } from "./traffic";

/**
 * Pickups floating over the road. Like the traffic, a race's pickups come
 * from its seed, so both racers meet exactly the same ones in the same spots
 * (each collects in their own world - grabbing one never takes it from the
 * other). The road is cut into segments, each laid out from its own seed, so
 * the layout is endless (solo) yet any stretch can be computed on its own.
 * Only integer-op randomness and plain arithmetic, as in ./traffic.ts.
 */

/**
 * - nitro: a canister that tops up the nitro bar.
 * - phase: a few seconds see-through - the car passes through traffic, and the
 *   combo can neither break nor time out.
 * - shield: absorbs the next crash entirely (no slowdown, combo kept).
 */
export type PickupKind = "nitro" | "phase" | "shield";

export interface Pickup {
  /** Stable within a layout: "segment:index". */
  id: string;
  kind: PickupKind;
  /** Distance down the road (m). */
  s: number;
  /** Lane index into LANES. */
  lane: number;
}

/** Road per layout segment (m). */
export const PICKUP_SEGMENT = 220;
/** No pickups before this distance: the start grid and the countdown run stay clear. */
export const PICKUP_START = 160;
/** Share of each kind; the rest are nitro. */
export const PHASE_SHARE = 0.2;
export const SHIELD_SHARE = 0.25;

/** Nitro a canister adds (the bar runs 0 to 1). */
export const NITRO_REFILL = 0.5;
/** How long phasing lasts (s). */
export const PHASE_SECONDS = 5;
/** How close (m) the car must pass to collect one. */
export const PICKUP_REACH_X = 1.5;
export const PICKUP_REACH_S = 2.6;

/** A segment's seed: the layout seed and segment number mixed with integer ops only. */
function segmentSeed(seed: number, segment: number): number {
  let h = (seed ^ Math.imul(segment + 1, 0x9e3779b1)) >>> 0;
  h = Math.imul(h ^ (h >>> 16), 0x85ebca6b) >>> 0;
  return (h ^ (h >>> 13)) >>> 0;
}

/** The pickups in one segment: one or two, never two in the same lane. */
export function pickupsInSegment(seed: number, segment: number): Pickup[] {
  const rng = createRng(segmentSeed(seed, segment));
  const count = rng() < 0.45 ? 2 : 1;
  const out: Pickup[] = [];
  const usedLanes: number[] = [];
  for (let i = 0; i < count; i++) {
    let lane = Math.floor(rng() * LANES.length);
    while (usedLanes.includes(lane)) lane = (lane + 1) % LANES.length;
    usedLanes.push(lane);
    const s = segment * PICKUP_SEGMENT + 20 + rng() * (PICKUP_SEGMENT - 40);
    const roll = rng();
    const kind: PickupKind = roll < PHASE_SHARE ? "phase" : roll < PHASE_SHARE + SHIELD_SHARE ? "shield" : "nitro";
    if (s >= PICKUP_START) out.push({ id: `${segment}:${i}`, kind, s, lane });
  }
  return out;
}

/** Every pickup with `s` in [from, to], in road order. */
export function pickupsBetween(seed: number, from: number, to: number): Pickup[] {
  const out: Pickup[] = [];
  const first = Math.max(0, Math.floor(from / PICKUP_SEGMENT));
  const last = Math.floor(to / PICKUP_SEGMENT);
  for (let segment = first; segment <= last; segment++) {
    for (const p of pickupsInSegment(seed, segment)) if (p.s >= from && p.s <= to) out.push(p);
  }
  return out.sort((a, b) => a.s - b.s);
}

/** Does a car at (s, x) collect `pickup`? */
export function reaches(pickup: Pickup, s: number, x: number): boolean {
  return Math.abs(pickup.s - s) < PICKUP_REACH_S && Math.abs(LANES[pickup.lane] - x) < PICKUP_REACH_X;
}
