import type { CoopResult } from "@/lib/games/iai/coop";

export interface EngineOptions {
  /** "solo" (default) or "coop" (no title/results screens of its own; the page starts runs). */
  mode?: "solo" | "coop";
  /** Called once the painted assets are ready and the title screen shows. */
  onReady?: () => void;
  /** Puts the API (plus internals) on `window.Iai`, for Playwright checks. */
  exposeForTests?: boolean;
}

export interface Engine {
  /** Starts a run from the title or results screen. */
  startSolo(): void;
  /** Co-op: join run `run`, starting at `startAt` (server ms). The host ("p1") runs the fight. */
  startCoop(coop: {
    role: "host" | "guest";
    run: number;
    startAt: number;
    serverNow: () => number;
    /** Sends a message to the other screen. */
    send: (data: string) => void;
    /** Host only: how the run ended, once both samurai have fallen. */
    onFinish?: (result: CoopResult) => void;
  }): void;
  /** Co-op: the other samurai's name, shown over them. */
  setPartnerName(name: string): void;
  /** Co-op: a message from the other screen. */
  receive(data: string): void;
  /** Co-op: leave the run. */
  stopCoop(): void;
  destroy(): void;
}

/** Boots the game on `root`, which must contain the stage markup (components/iai/Stage.tsx). */
export function createEngine(root: HTMLElement, options?: EngineOptions): Engine;
