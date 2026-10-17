import { describe, expect, it } from "vitest";
import { GhostTrack, type LiveCar } from "./live";

const car = (t: number, s: number, x = 0, race = 1): LiveCar => ({ race, t, s, x, v: 30, score: 0, paint: 0 });

describe("GhostTrack", () => {
  it("interpolates between samples", () => {
    const g = new GhostTrack();
    g.push(car(1000, 100, -1));
    g.push(car(1100, 103, 1));
    expect(g.at(1050, 1)).toEqual({ s: 101.5, x: 0, v: 30 });
  });

  it("extrapolates by speed past the newest sample, but not for too long", () => {
    const g = new GhostTrack();
    g.push(car(1000, 100));
    expect(g.at(1200, 1)!.s).toBeCloseTo(106);
    expect(g.at(2000, 1)).toBeUndefined();
  });

  it("ignores out-of-order samples, and starts over on a new race", () => {
    const g = new GhostTrack();
    g.push(car(1000, 100));
    g.push(car(900, 50));
    expect(g.latest()!.t).toBe(1000);
    g.push(car(10, 1, 0, 2));
    expect(g.at(10, 1)).toBeUndefined();
    expect(g.at(10, 2)!.s).toBe(1);
  });

  it("has nothing for a race it has no samples of", () => {
    expect(new GhostTrack().at(0, 1)).toBeUndefined();
  });
});
