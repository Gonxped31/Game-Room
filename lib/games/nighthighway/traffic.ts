import { LANES } from "./constants";

/**
 * Same-direction traffic, simulated in world coordinates: `s` is a car's
 * distance down the road (m, forward is +), `x` its lateral position.
 *
 * In a race both devices must see the same traffic, so a "fixed" simulation
 * is fully deterministic: a seeded generator, fixed time steps, and only
 * arithmetic that every JavaScript engine computes bit-for-bit the same
 * (+ - * /, comparisons, Math.imul/min/max/abs - no Math.exp/sin/pow, whose
 * last digits may differ between Safari and Chrome). It never looks at the
 * players, so nothing either of them does can make the two copies drift.
 * Its cars are spread over the whole stretch a 60-second race can reach.
 *
 * A "recycle" simulation (solo runs and the title screen) instead keeps a
 * small set of cars around a focus point - the player - respawning them
 * ahead once they fall behind or too far ahead, like the original game.
 */

/** Simulation step (s). The renderer extrapolates between steps. */
export const TRAFFIC_STEP = 1 / 30;

export const CAR_LEN = 4.85;
export const CAR_HALF_W = 0.94;
export const TRUCK_LEN = 14.5;
export const TRUCK_HALF_W = 1.28;
/** How many colours the renderer has for cars and trucks (see the engine's CAR_COLORS/TRUCK_COLORS). */
export const CAR_COLOR_COUNT = 12;
export const TRUCK_COLOR_COUNT = 4;

/** The road a fixed (race) simulation populates: behind the start, to past the furthest a run can reach. */
export const FIXED_ROAD_START = -600;
export const FIXED_ROAD_END = 7000;
/** One car per this many metres of road, on average (the original's density). */
export const FIXED_SPACING = 37;
/** No car starts here, so the racers' starting grid is clear. */
export const START_CLEAR_FROM = -30;
export const START_CLEAR_TO = 70;

/** In recycle mode: cars kept around the focus, as in the original (13 cars + 3 trucks). */
export const RECYCLE_CARS = 13;
export const RECYCLE_TRUCKS = 3;

export interface LaneChange {
  from: number;
  to: number;
  /** Progress, 0 to 1. */
  t: number;
}

export interface TrafficCar {
  id: number;
  kind: "car" | "truck";
  len: number;
  halfW: number;
  lane: number;
  x: number;
  s: number;
  /** Speed (m/s). */
  v: number;
  cruise: number;
  brake: 0 | 1;
  lc: LaneChange | null;
  /** Vertical scale, for a few taller cars (SUVs). */
  sy: number;
  /** Index into the renderer's car or truck colour list. */
  color: number;
}

/** mulberry32: a small, fast, seeded generator built only on integer ops, so it's identical in every engine. */
export function createRng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
/** Smoothstep from 0 to 1 - a polynomial, so it's deterministic. */
const smooth01 = (t: number) => {
  const c = t < 0 ? 0 : t > 1 ? 1 : t;
  return c * c * (3 - 2 * c);
};

// The original eases speed with `damp(v, target, k, dt)` = 1 - exp(-k*dt).
// At the fixed step those factors are constants, written out so no device
// computes Math.exp itself.
/** 1 - exp(-2.2 / 30): easing toward a lower target (braking). */
const EASE_BRAKE = 0.070709;
/** 1 - exp(-0.8 / 30): easing toward the cruise speed. */
const EASE_CRUISE = 0.026314;

export type TrafficMode = "fixed" | "recycle";

export class TrafficSim {
  readonly mode: TrafficMode;
  readonly cars: TrafficCar[] = [];
  /** Simulated time (s) of the current state. */
  time = 0;
  private readonly rng: () => number;
  /** Car indices sorted by `s`, rebuilt each step. */
  private order: number[] = [];

  /**
   * @param focus recycle mode only: where to place the first cars (the player's `s`).
   */
  constructor(seed: number, mode: TrafficMode, focus = 0) {
    this.mode = mode;
    this.rng = createRng(seed);
    if (mode === "fixed") {
      const count = Math.ceil((FIXED_ROAD_END - FIXED_ROAD_START) / FIXED_SPACING);
      for (let i = 0; i < count; i++) {
        const car = this.newCar(i, this.rng() < 0.18 ? "truck" : "car");
        if (this.place(car, FIXED_ROAD_START, FIXED_ROAD_END, true)) this.cars.push(car);
      }
    } else {
      for (let i = 0; i < RECYCLE_CARS + RECYCLE_TRUCKS; i++) {
        const car = this.newCar(i, i < RECYCLE_CARS ? "car" : "truck");
        this.place(car, focus + 45, focus + 640, false);
        this.cars.push(car);
      }
    }
    this.sortOrder();
  }

  private newCar(id: number, kind: "car" | "truck"): TrafficCar {
    return {
      id,
      kind,
      len: kind === "truck" ? TRUCK_LEN : CAR_LEN,
      halfW: kind === "truck" ? TRUCK_HALF_W : CAR_HALF_W,
      lane: 0,
      x: 0,
      s: 0,
      v: 0,
      cruise: 0,
      brake: 0,
      lc: null,
      sy: 1,
      color: 0,
    };
  }

  private range(a: number, b: number): number {
    return a + this.rng() * (b - a);
  }

  /** Is `laneX` occupied within `gap` of `s` (ignoring `car`), or is the spot too crowded? */
  private laneBlocked(car: TrafficCar, laneX: number, s: number, gap: number): boolean {
    let near = 0;
    for (const o of this.cars) {
      if (o === car) continue;
      const ds = Math.abs(o.s - s);
      if (Math.abs(o.x - laneX) < 2.4 && ds < gap + (o.len + car.len) / 2) return true;
      if (ds < 22 && Math.abs(o.x - laneX) > 1) near++;
    }
    return near >= 3;
  }

  /** Puts `car` somewhere free in [sMin, sMax], re-rolling its looks. Returns false if no free spot turned up. */
  private place(car: TrafficCar, sMin: number, sMax: number, avoidStart: boolean): boolean {
    for (let attempt = 0; attempt < 16; attempt++) {
      const lane = car.kind === "truck" ? 2 + Math.floor(this.rng() * 2) : Math.floor(this.rng() * 4);
      const s = this.range(sMin, sMax);
      if (avoidStart && s > START_CLEAR_FROM && s < START_CLEAR_TO) continue;
      if (this.laneBlocked(car, LANES[lane], s, 14)) continue;
      car.lane = lane;
      car.x = LANES[lane];
      car.s = s;
      car.lc = null;
      car.brake = 0;
      car.cruise = car.kind === "truck" ? this.range(21, 25) : this.range(23, 31) + (3 - lane) * 1.6;
      car.v = car.cruise;
      car.sy = car.kind === "truck" ? 1 : this.rng() < 0.3 ? this.range(1.12, 1.25) : this.range(0.97, 1.05);
      car.color = Math.floor(this.rng() * (car.kind === "truck" ? TRUCK_COLOR_COUNT : CAR_COLOR_COUNT));
      return true;
    }
    // Nowhere free: park it far ahead, out of sight, as the original does.
    car.s = sMax + 320;
    return false;
  }

  private sortOrder() {
    this.order = this.cars.map((_, i) => i).sort((a, b) => this.cars[a].s - this.cars[b].s || this.cars[a].id - this.cars[b].id);
  }

  /** The nearest car ahead in (roughly) the same lane, and the bumper-to-bumper gap to it. */
  private leadOf(car: TrafficCar, orderIndex: number): { lead: TrafficCar | null; gap: number } {
    let lead: TrafficCar | null = null;
    let gap = 1e9;
    // `order` was sorted at the start of this step and cars move ~1 m per
    // step, so scan a little past the 32 m that matters.
    for (let k = orderIndex + 1; k < this.order.length; k++) {
      const o = this.cars[this.order[k]];
      if (o.s - car.s > 60) break;
      if (o.s <= car.s || Math.abs(o.x - car.x) > 2.2) continue;
      const g = o.s - car.s - (car.len + o.len) / 2;
      if (g < gap) {
        gap = g;
        lead = o;
      }
    }
    return { lead, gap };
  }

  /** Advances one fixed step. In recycle mode, `focus` is the player's `s`. */
  step(focus = 0) {
    const dt = TRAFFIC_STEP;
    const position = new Map<number, number>();
    this.order.forEach((carIndex, k) => position.set(carIndex, k));
    this.cars.forEach((car, i) => {
      const { lead, gap } = this.leadOf(car, position.get(i) ?? 0);
      let target = car.cruise;
      if (lead && gap < 32) target = Math.min(target, lead.v - (gap < 10 ? 4 : 0));
      car.brake = target < car.v - 0.8 ? 1 : 0;
      car.v = car.v + (Math.max(target, 8) - car.v) * (car.brake ? EASE_BRAKE : EASE_CRUISE);
      if (!car.lc && car.kind === "car" && lead && gap < 30 && lead.v < car.cruise - 2.5 && this.rng() < dt * 0.8) {
        const options = [car.lane - 1, car.lane + 1].filter((l) => l >= 0 && l < LANES.length);
        if (this.rng() < 0.5) options.reverse();
        for (const lane of options) {
          if (!this.laneBlocked(car, LANES[lane], car.s, 10)) {
            car.lc = { from: car.x, to: LANES[lane], t: 0 };
            car.lane = lane;
            break;
          }
        }
      }
      car.s += car.v * dt;
      if (car.lc) {
        car.lc.t += dt / 2.2;
        car.x = lerp(car.lc.from, car.lc.to, smooth01(car.lc.t));
        if (car.lc.t >= 1) {
          car.x = car.lc.to;
          car.lc = null;
        }
      }
      if (this.mode === "recycle" && (car.s < focus - 40 || car.s > focus + 980)) this.place(car, focus + 520, focus + 720, false);
    });
    this.time += dt;
    this.sortOrder();
  }

  /**
   * Steps until the simulation reaches `time` (never past it), at most
   * `maxSteps` at once so a device that fell behind catches up over a few
   * frames instead of freezing on one.
   */
  advanceTo(time: number, focus = 0, maxSteps = 300) {
    for (let n = 0; n < maxSteps && this.time + TRAFFIC_STEP <= time + 1e-9; n++) this.step(focus);
  }

  /** A fingerprint of the current state, for checking two devices agree. */
  checksum(): string {
    let h = 0;
    for (const car of this.cars) h = (Math.imul(h, 31) + Math.round(car.s * 1000) + Math.round(car.x * 1000) * 7) | 0;
    return `${this.time.toFixed(4)}:${h >>> 0}`;
  }
}
