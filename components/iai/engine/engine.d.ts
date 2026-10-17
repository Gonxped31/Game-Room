export interface EngineOptions {
  /** Called once the painted assets are ready and the title screen shows. */
  onReady?: () => void;
  /** Puts the API (plus internals) on `window.Iai`, for Playwright checks. */
  exposeForTests?: boolean;
}

export interface Engine {
  /** Starts a run from the title or results screen. */
  startSolo(): void;
  destroy(): void;
}

/** Boots the game on `root`, which must contain the stage markup (components/iai/Stage.tsx). */
export function createEngine(root: HTMLElement, options?: EngineOptions): Engine;
