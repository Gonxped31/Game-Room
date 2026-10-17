"use client";

import { memo, type ReactNode, useEffect, useRef } from "react";
import type { Engine } from "./engine/engine";
import "./nighthighway.css";
import "./screens.css";

interface StageProps {
  /** "solo": the original title and results screens. "race": the page draws its own screens as `children`. */
  mode: "solo" | "race";
  /** Called with the engine once it's running, and with null when it's torn down. */
  onEngine?: (engine: Engine | null) => void;
  /** The page's own screens, drawn over the road. */
  children?: ReactNode;
}

/**
 * The full-screen game: the WebGL road plus the original page's HUD, drawn by
 * the engine (./engine/engine.js). The engine writes straight into this
 * markup every frame (clock, speed, score...), so it's rendered once by a
 * memoized component that never re-renders, and React never fights it.
 */
export default function Stage({ mode, onEngine, children }: StageProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const onEngineRef = useRef(onEngine);
  useEffect(() => {
    onEngineRef.current = onEngine;
  }, [onEngine]);

  useEffect(() => {
    let engine: Engine | null = null;
    let cancelled = false;
    // Loaded here, never on the server: three.js needs a browser.
    void import("./engine/engine").then(({ createEngine }) => {
      const root = rootRef.current;
      if (cancelled || !root) return;
      const css = getComputedStyle(root);
      engine = createEngine(root, {
        mode,
        fonts: {
          display: css.getPropertyValue("--font-display").trim(),
          body: css.getPropertyValue("--font-body").trim(),
          mono: css.getPropertyValue("--font-mono").trim(),
        },
        // window.NightHighway, for the live-test skill's checks (as the original page exposed it).
        exposeForTests: true,
      });
      onEngineRef.current?.(engine);
    });
    return () => {
      cancelled = true;
      engine?.destroy();
      onEngineRef.current?.(null);
    };
  }, [mode]);

  return (
    <div ref={rootRef} className="nh">
      <StageMarkup mode={mode} />
      {children}
    </div>
  );
}

/** The reference page's markup (references/night-highway/Night Highway.html), as JSX. */
const StageMarkup = memo(function StageMarkup({ mode }: { mode: "solo" | "race" }) {
  return (
    <>
      <canvas id="scene" tabIndex={0} aria-label="Night Highway driving game" />

      <div id="hud" className="layer" hidden>
        <div className="timebar" id="timebar">
          <i id="timefill" />
        </div>
        <div className="stat">
          <span className="label">Time</span>
          <span className="clock" id="clock">
            60.0
          </span>
        </div>
        <div className="stat right">
          <span className="label">Score</span>
          <span className="score" id="score">
            0
          </span>
          <span className="sub">
            <span id="dist">0.00</span> km · <span id="nm">0</span> near misses
          </span>
          {mode === "race" ? <span className="sub opp" id="opp" aria-live="off" /> : null}
        </div>
        <div className="hint" id="hint">
          W / ↑ gas · S / ↓ brake · A D / ← → steer
          <br />
          Shift or Space nitro · V camera · C paint · L glow · H hide HUD · P pause
        </div>
        <div className="speedo" id="speedo">
          <svg viewBox="0 0 250 140" aria-hidden="true">
            <g id="ticks" />
            <path className="arc-bg" d="M 25 125 A 100 100 0 0 1 225 125" />
            <path className="arc-fill" id="arc" d="M 25 125 A 100 100 0 0 1 225 125" />
          </svg>
          <div className="readout">
            <span className="speed" id="speed">
              0
            </span>
            <span className="unit">km/h</span>
          </div>
          <div className="speedo-foot">
            <span className="gear">
              Gear<b id="gear">1</b>
            </span>
            <div className="nbar" aria-label="Nitro">
              <i id="nitro" />
            </div>
          </div>
        </div>
      </div>

      <div id="pops" aria-live="polite" />
      <div id="count" aria-live="assertive" />

      {mode === "solo" ? (
        <>
          <section id="title" className="layer screen" hidden>
            <div className="card">
              <p className="kicker">60 seconds · one road · after midnight</p>
              <h1 className="wordmark">
                <span>Night</span>
                <span className="hot">Highway</span>
              </h1>
              <p className="lede">Weave through late traffic, chain near misses for points, and see how far one minute takes you.</p>
              <div className="row">
                <button className="cta" id="startBtn" type="button">
                  Drive <kbd>Enter</kbd>
                </button>
                <span className="note" id="bestLine" />
              </div>
              <dl className="keys">
                {[
                  ["W ↑", "Gas"],
                  ["S ↓", "Brake"],
                  ["A D ← →", "Steer"],
                  ["Shift", "Nitro"],
                  ["V", "Camera"],
                  ["C", "Paint"],
                  ["L", "Light glow"],
                  ["M", "Sound"],
                  ["H", "Hide HUD"],
                ].map(([key, action]) => (
                  <div key={key}>
                    <dt>{key}</dt>
                    <dd>{action}</dd>
                  </div>
                ))}
              </dl>
            </div>
          </section>

          <section id="results" className="layer screen" hidden>
            <div className="card">
              <p className="kicker" id="resKicker">
                Run complete
              </p>
              <p className="results-score" id="resScore">
                0
              </p>
              <p className="best" id="resBest" />
              <dl className="stats">
                <div>
                  <dt>Distance</dt>
                  <dd>
                    <span id="rDist">0</span>
                    <small>km</small>
                  </dd>
                </div>
                <div>
                  <dt>Top speed</dt>
                  <dd>
                    <span id="rTop">0</span>
                    <small>km/h</small>
                  </dd>
                </div>
                <div>
                  <dt>Average</dt>
                  <dd>
                    <span id="rAvg">0</span>
                    <small>km/h</small>
                  </dd>
                </div>
                <div>
                  <dt>Near misses</dt>
                  <dd id="rNm">0</dd>
                </div>
                <div>
                  <dt>Overtakes</dt>
                  <dd id="rOv">0</dd>
                </div>
                <div>
                  <dt>Crashes</dt>
                  <dd id="rCr">0</dd>
                </div>
              </dl>
              <div className="row">
                <button className="cta" id="againBtn" type="button">
                  Drive again <kbd>Enter</kbd>
                </button>
              </div>
            </div>
          </section>
        </>
      ) : null}

      <div id="pause" className="layer" hidden>
        <p>
          Paused<small>P to resume · R to restart</small>
        </p>
      </div>

      <div id="touch" hidden>
        <div className="tgroup">
          <button className="tbtn" data-k="left" type="button" aria-label="Steer left">
            ◀
          </button>
          <button className="tbtn" data-k="right" type="button" aria-label="Steer right">
            ▶
          </button>
        </div>
        <div className="tgroup">
          <button className="tbtn" data-k="down" type="button">
            Brake
          </button>
          <button className="tbtn" data-k="boost" type="button">
            Nitro
          </button>
        </div>
      </div>

      <div id="boot" className="layer">
        <p>Warming up the engine…</p>
      </div>
    </>
  );
});
