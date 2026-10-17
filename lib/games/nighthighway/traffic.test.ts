import { describe, expect, it } from "vitest";
import { COUNTDOWN_SECONDS, LANES, RUN_SECONDS } from "./constants";
import { createRng, FIXED_ROAD_END, FIXED_ROAD_START, START_CLEAR_FROM, START_CLEAR_TO, TRAFFIC_STEP, TrafficSim } from "./traffic";

const RACE_SECONDS = COUNTDOWN_SECONDS + RUN_SECONDS;

describe("createRng", () => {
  it("repeats for a seed and stays in [0, 1)", () => {
    const a = createRng(42);
    const b = createRng(42);
    for (let i = 0; i < 1000; i++) {
      const x = a();
      expect(x).toBe(b());
      expect(x).toBeGreaterThanOrEqual(0);
      expect(x).toBeLessThan(1);
    }
  });

  it("differs between seeds", () => {
    expect(createRng(1)()).not.toBe(createRng(2)());
  });
});

describe("a fixed (race) simulation", () => {
  it("is identical for the same seed, step for step, and the same however it's advanced", () => {
    const a = new TrafficSim(1234, "fixed");
    const b = new TrafficSim(1234, "fixed");
    for (let i = 0; i < 300; i++) a.step();
    // b catches up in uneven chunks, as a device with an irregular frame rate would.
    for (const t of [0.4, 0.41, 3, 7.77, 10]) b.advanceTo(t);
    expect(b.checksum()).toBe(a.checksum());
    expect(b.cars).toEqual(a.cars);
  });

  it("differs between seeds", () => {
    expect(new TrafficSim(1, "fixed").checksum()).not.toBe(new TrafficSim(2, "fixed").checksum());
  });

  it("covers the whole road, but leaves the starting grid clear", () => {
    const sim = new TrafficSim(7, "fixed");
    expect(sim.cars.length).toBeGreaterThan(150);
    expect(sim.cars.some((c) => c.s < 0)).toBe(true);
    expect(sim.cars.some((c) => c.s > FIXED_ROAD_END - 500)).toBe(true);
    for (const car of sim.cars) {
      expect(car.s).toBeGreaterThanOrEqual(FIXED_ROAD_START);
      expect(car.s > START_CLEAR_FROM && car.s < START_CLEAR_TO).toBe(false);
    }
  });

  it("never lets two vehicles overlap in a lane through a whole race", () => {
    for (const seed of [3, 99, 2024]) {
      const sim = new TrafficSim(seed, "fixed");
      for (let t = 0; t < RACE_SECONDS; t += TRAFFIC_STEP) {
        sim.step();
        const sorted = [...sim.cars].sort((a, b) => a.s - b.s);
        for (let i = 0; i < sorted.length; i++) {
          for (let j = i + 1; j < sorted.length && sorted[j].s - sorted[i].s < 20; j++) {
            const a = sorted[i];
            const b = sorted[j];
            const overlapX = Math.abs(a.x - b.x) < a.halfW + b.halfW - 0.5;
            const overlapS = b.s - a.s < (a.len + b.len) / 2 - 0.5;
            expect(overlapX && overlapS, `seed ${seed}, t=${sim.time.toFixed(2)}: cars ${a.id} and ${b.id}`).toBe(false);
          }
        }
      }
    }
  });

  it("keeps cars on the road at sane speeds, ending lane changes in a lane", () => {
    const sim = new TrafficSim(5, "fixed");
    sim.advanceTo(RACE_SECONDS, 0, 1e6);
    for (const car of sim.cars) {
      expect(car.v).toBeGreaterThanOrEqual(8);
      expect(car.v).toBeLessThan(40);
      expect(car.x).toBeGreaterThanOrEqual(LANES[0]);
      expect(car.x).toBeLessThanOrEqual(LANES[3]);
      if (!car.lc) expect(LANES).toContain(car.x);
    }
  });

  it("has some cars change lanes", () => {
    const sim = new TrafficSim(11, "fixed");
    const lanes = new Map(sim.cars.map((c) => [c.id, c.lane]));
    sim.advanceTo(RACE_SECONDS, 0, 1e6);
    expect(sim.cars.filter((c) => c.lane !== lanes.get(c.id)).length).toBeGreaterThan(0);
  });

  it("advanceTo never steps past the target, and caps steps per call", () => {
    const sim = new TrafficSim(1, "fixed");
    sim.advanceTo(1.0);
    expect(sim.time).toBeLessThanOrEqual(1.0 + 1e-9);
    expect(sim.time).toBeGreaterThan(1.0 - TRAFFIC_STEP);
    sim.advanceTo(100, 0, 10);
    expect(sim.time).toBeCloseTo(1.0 + 10 * TRAFFIC_STEP, 6);
  });
});

describe("a recycle (solo) simulation", () => {
  it("keeps its cars around a moving focus", () => {
    const sim = new TrafficSim(8, "recycle", 0);
    let focus = 0;
    for (let i = 0; i < 30 * 120; i++) {
      focus += 40 * TRAFFIC_STEP; // faster than any traffic
      sim.step(focus);
    }
    expect(sim.cars).toHaveLength(16);
    for (const car of sim.cars) {
      expect(car.s).toBeGreaterThan(focus - 41);
      expect(car.s).toBeLessThan(focus + 1050);
    }
  });
});
