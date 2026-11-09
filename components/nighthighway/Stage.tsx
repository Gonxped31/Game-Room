"use client";

import { memo, type ReactNode, useEffect, useRef } from "react";
import { useLang } from "@/lib/i18n/useLang";
import type { RunResult } from "@/lib/games/nighthighway/game";
import type { Engine } from "./engine/engine";
import { ENGINE_TEXT, STAGE_TEXT } from "./text";
import "./nighthighway.css";
import "./screens.css";

interface StageProps {
  /** "solo": the original title and results screens. "race": the page draws its own screens as `children`. */
  mode: "solo" | "race";
  /** Called with the engine once it's running, and with null when it's torn down. */
  onEngine?: (engine: Engine | null) => void;
  /** Solo: called once each run's 60 seconds are up (its results screen). */
  onSoloFinish?: (result: RunResult) => void;
  /** The page's own screens, drawn over the road. */
  children?: ReactNode;
}

/**
 * The full-screen game: the WebGL road plus the original page's HUD, drawn by
 * the engine (./engine/engine.js). The engine writes straight into this
 * markup every frame (clock, speed, score...), so it's rendered once by a
 * memoized component that never re-renders, and React never fights it. Both
 * the markup and the engine speak the page's language (`useLang`), which only
 * changes with a new page load.
 */
export default function Stage({ mode, onEngine, onSoloFinish, children }: StageProps) {
  const lang = useLang();
  const rootRef = useRef<HTMLDivElement>(null);
  const onEngineRef = useRef(onEngine);
  const onSoloFinishRef = useRef(onSoloFinish);
  useEffect(() => {
    onEngineRef.current = onEngine;
    onSoloFinishRef.current = onSoloFinish;
  }, [onEngine, onSoloFinish]);

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
        text: ENGINE_TEXT[lang],
        onSoloFinish: (result) => onSoloFinishRef.current?.(result),
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
  }, [mode, lang]);

  return (
    <div ref={rootRef} className="nh">
      <StageMarkup mode={mode} t={STAGE_TEXT[lang]} n={ENGINE_TEXT[lang]} />
      {children}
    </div>
  );
}

/** The reference page's markup (references/night-highway/Night Highway.html), as JSX. */
const StageMarkup = memo(function StageMarkup({ mode, t, n }: { mode: "solo" | "race"; t: (typeof STAGE_TEXT)["en"]; n: (typeof ENGINE_TEXT)["en"] }) {
  return (
    <>
      <canvas id="scene" tabIndex={0} aria-label={t.canvas} />

      <div id="hud" className="layer" hidden>
        <div className="timebar" id="timebar">
          <i id="timefill" />
        </div>
        <div className="stat">
          <span className="label">{t.time}</span>
          <span className="clock" id="clock">
            {n.decimal(60, 1)}
          </span>
        </div>
        <div className="stat right">
          <span className="label">{t.score}</span>
          <span className="score" id="score">
            0
          </span>
          <span className="sub">
            <span id="dist">{n.decimal(0, 2)}</span> km · {t.nearMissesBefore}
            <span id="nm">0</span>
            {t.nearMissesAfter}
          </span>
          <span className="sub power" id="power" aria-live="polite" />
          {mode === "race" ? <span className="sub opp" id="opp" aria-live="off" /> : null}
        </div>
        <div className="hint" id="hint">
          {t.hint}
          <br />
          {t.hint2}
          {mode === "solo" ? t.hintPause : null}
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
              {t.gear}
              <b id="gear">1</b>
            </span>
            <div className="nbar" aria-label={t.nitro}>
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
              <p className="kicker">
                {/* The engine marks the stage .nh-desert in the desert. */}
                <span className="nh-city-only">{t.kickerCity}</span>
                <span className="nh-desert-only">{t.kickerDesert}</span>
              </p>
              <h1 className="wordmark">
                <span>Night</span>
                <span className="hot">Highway</span>
              </h1>
              <p className="lede">{t.lede}</p>
              {/* Phones and tablets only (screens.css): the race page's PhoneNote, as static markup. */}
              <p className="nh-phone-note">{t.phoneNote}</p>
              <div className="row">
                <button className="cta" id="startBtn" type="button">
                  {t.drive} <kbd>{t.enter}</kbd>
                </button>
                <span className="note" id="bestLine" />
              </div>
              <div className="row nh-options" aria-label={t.options}>
                {/* The engine wires these and remembers them on this device. */}
                <button type="button" role="switch" aria-checked="true" className="nh-switch" id="optPickups">
                  {t.pickups}
                </button>
                <button type="button" role="switch" aria-checked="false" className="nh-switch" id="optRain">
                  {t.rain}
                </button>
                <button type="button" role="switch" aria-checked="false" className="nh-switch" id="optDesert">
                  {t.desert}
                </button>
              </div>
              <dl className="keys">
                {t.keys.map(([key, action]) => (
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
                {n.runComplete}
              </p>
              <p className="results-score" id="resScore">
                0
              </p>
              <p className="best" id="resBest" />
              <dl className="stats">
                <div>
                  <dt>{t.distance}</dt>
                  <dd>
                    <span id="rDist">0</span>
                    <small>km</small>
                  </dd>
                </div>
                <div>
                  <dt>{t.topSpeed}</dt>
                  <dd>
                    <span id="rTop">0</span>
                    <small>km/h</small>
                  </dd>
                </div>
                <div>
                  <dt>{t.average}</dt>
                  <dd>
                    <span id="rAvg">0</span>
                    <small>km/h</small>
                  </dd>
                </div>
                <div>
                  <dt>{t.nearMisses}</dt>
                  <dd id="rNm">0</dd>
                </div>
                <div>
                  <dt>{t.overtakes}</dt>
                  <dd id="rOv">0</dd>
                </div>
                <div>
                  <dt>{t.crashes}</dt>
                  <dd id="rCr">0</dd>
                </div>
              </dl>
              <div className="row">
                <button className="cta" id="againBtn" type="button">
                  {t.driveAgain} <kbd>{t.enter}</kbd>
                </button>
              </div>
            </div>
          </section>
        </>
      ) : null}

      <div id="pause" className="layer" hidden>
        <p>
          {t.paused}
          <small>{t.pauseHelp}</small>
        </p>
      </div>

      <div id="touch" hidden>
        <div className="tgroup">
          <button className="tbtn" data-k="left" type="button" aria-label={t.steerLeft}>
            ◀
          </button>
          <button className="tbtn" data-k="right" type="button" aria-label={t.steerRight}>
            ▶
          </button>
        </div>
        <div className="tgroup">
          <button className="tbtn" data-k="down" type="button">
            {t.brake}
          </button>
          <button className="tbtn" data-k="boost" type="button">
            {t.nitro}
          </button>
        </div>
      </div>

      <div id="boot" className="layer">
        <p>{t.boot}</p>
      </div>
    </>
  );
});
