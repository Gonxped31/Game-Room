/**
 * A racer's live car, written ten times a second to
 * `games/{room}/nighthighwayCars/{seat}` so the other device can draw it as
 * a ghost. Plain `set()`s at its own path, not a transaction on the game
 * state: each seat only ever writes its own node, so there's nothing to
 * contend over, and a missed sample just means the next one is used.
 */
export interface LiveCar {
  /** Which race this belongs to (GameState.race), so a stale car from the last race is ignored. */
  race: number;
  /** Race time (ms since the countdown started). */
  t: number;
  /** Distance down the road (m). */
  s: number;
  /** Lateral position (m). */
  x: number;
  /** Speed (m/s). */
  v: number;
  score: number;
  /** Paint index, so the ghost wears the other player's colour. */
  paint: number;
}

/** Sample buffer for one remote car, interpolated a little behind real time to hide network jitter. */
export class GhostTrack {
  private samples: LiveCar[] = [];

  /** Adds a sample (ignored if it's not newer than the last one, or from another race). */
  push(car: LiveCar) {
    const last = this.samples.at(-1);
    if (last && (car.race !== last.race || car.t <= last.t)) {
      if (car.race === last.race) return;
      this.samples = [];
    }
    this.samples.push(car);
    if (this.samples.length > 40) this.samples.shift();
  }

  clear() {
    this.samples = [];
  }

  latest(): LiveCar | undefined {
    return this.samples.at(-1);
  }

  /**
   * Where the car was at race time `t` (ms): interpolated between the two
   * samples around it, or extrapolated from the newest one by its speed for
   * up to `maxExtrapolateMs`. Undefined if there are no samples, or the
   * newest is too old to trust.
   */
  at(t: number, race: number, maxExtrapolateMs = 600): { s: number; x: number; v: number } | undefined {
    const samples = this.samples.filter((c) => c.race === race);
    if (!samples.length) return undefined;
    const newest = samples[samples.length - 1];
    if (t >= newest.t) {
      const ahead = t - newest.t;
      if (ahead > maxExtrapolateMs) return undefined;
      return { s: newest.s + (newest.v * ahead) / 1000, x: newest.x, v: newest.v };
    }
    if (t <= samples[0].t) return { s: samples[0].s, x: samples[0].x, v: samples[0].v };
    for (let i = samples.length - 1; i > 0; i--) {
      const a = samples[i - 1];
      const b = samples[i];
      if (t >= a.t) {
        const k = (t - a.t) / (b.t - a.t);
        return { s: a.s + (b.s - a.s) * k, x: a.x + (b.x - a.x) * k, v: a.v + (b.v - a.v) * k };
      }
    }
    return undefined;
  }
}
