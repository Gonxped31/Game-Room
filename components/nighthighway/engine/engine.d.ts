import type { RaceOptions, RunResult } from "@/lib/games/nighthighway/game";
import type { LiveCar } from "@/lib/games/nighthighway/live";

export interface EngineOptions {
  /** "solo" (the original title/results screens, pausing) or "race" (the page shows its own screens). */
  mode: "solo" | "race";
  /** next/font's real family stacks - the engine draws signs and labels on canvases with them. */
  fonts?: { display?: string; body?: string; mono?: string };
  /** Called once the first frame is drawn. */
  onReady?: () => void;
  /** Called if the engine can't run (no WebGL, a graphics error) with a message for the player. */
  onFatal?: (message: string) => void;
  /** Puts the API (plus internals) on `window.NightHighway`, for Playwright checks. */
  exposeForTests?: boolean;
}

export interface EngineRace {
  /** GameState.race - the engine never re-runs a race number it already finished. */
  race: number;
  seed: number;
  /** Server time (ms) the countdown starts. */
  startAt: number;
  /** Index into LANES this racer starts in. */
  lane: number;
  /** The race's switches (GameState.options) - the same for both racers. */
  options: RaceOptions;
  /** The server's clock (ms), i.e. Date.now() plus the measured offset. */
  serverNow: () => number;
  /** Ten times a second while racing, plus a final sample at the end. */
  onLive?: (car: LiveCar) => void;
  /** Once, when this device's 60 seconds are up. */
  onFinish?: (result: RunResult) => void;
}

export interface EngineOpponent {
  name: string;
  /** Where their car was at race time `raceMs`, if known (see GhostTrack.at). */
  sample: (raceMs: number) => { s: number; x: number; v: number } | undefined;
  /** Their newest live sample - for the HUD line and their paint. */
  latest: () => LiveCar | undefined;
}

export interface Engine {
  startSolo(): void;
  startRace(race: EngineRace): void;
  stopRace(): void;
  setOpponent(opponent: EngineOpponent | null): void;
  /** Race page: the next race's switches, shown on the road between races (e.g. rain in the lobby). */
  setOptions(options: RaceOptions): void;
  trafficChecksum(): string;
  /** Test hook: a race's traffic at `time` (s), simulated from scratch in this browser. */
  raceTrafficChecksum(seed: number, time: number): string;
  destroy(): void;
}

/** Boots the game on `root`, which must contain the stage markup (components/nighthighway/Stage.tsx). */
export function createEngine(root: HTMLElement, options: EngineOptions): Engine;
