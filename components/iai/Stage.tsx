"use client";

import { memo, type ReactNode, useEffect, useRef } from "react";
import type { Engine } from "./engine/engine";
import "./fonts.css";
import "./iai.css";

interface StageProps {
  /** Called with the engine once it's running, and with null when it's torn down. */
  onEngine?: (engine: Engine | null) => void;
  /** The page's own overlays (e.g. the way back to the hub). */
  children?: ReactNode;
}

/**
 * Iaï's full-screen stage: the canvas plus the original page's screens and
 * HUD, which the engine (./engine/engine.js) drives directly - so the markup
 * renders once, memoized, and React never fights it.
 */
export default function Stage({ onEngine, children }: StageProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const onEngineRef = useRef(onEngine);
  useEffect(() => {
    onEngineRef.current = onEngine;
  }, [onEngine]);

  useEffect(() => {
    let engine: Engine | null = null;
    let cancelled = false;
    void import("./engine/engine").then(({ createEngine }) => {
      const root = rootRef.current;
      if (cancelled || !root) return;
      // window.Iai, for the live checks (as the original exposed window.__iai).
      engine = createEngine(root, { exposeForTests: true });
      onEngineRef.current?.(engine);
    });
    return () => {
      cancelled = true;
      engine?.destroy();
      onEngineRef.current?.(null);
    };
  }, []);

  return (
    <div ref={rootRef} className="iai">
      <StageMarkup />
      {children}
    </div>
  );
}

/** references/iai/iai.html's markup, in English, with health in place of the countdown and Game Room's controls. */
const StageMarkup = memo(function StageMarkup() {
  return (
    <>
      <svg width="0" height="0" style={{ position: "absolute" }} aria-hidden="true">
        <filter id="rough">
          <feTurbulence type="fractalNoise" baseFrequency=".9" numOctaves={2} seed={3} />
          <feDisplacementMap in="SourceGraphic" scale={3.2} />
        </filter>
      </svg>
      <canvas id="out" aria-label="Iaï, a samurai sword game" />

      <div id="loading" className="screen show">
        <div className="box">
          <svg viewBox="0 0 120 120">
            <circle className="enso" cx="60" cy="60" r="46" transform="rotate(-100 60 60)" />
          </svg>
          <div id="loadTxt">Grinding the ink…</div>
          <div className="lbar">
            <div id="loadBar" />
          </div>
        </div>
      </div>

      <div id="title" className="screen">
        <div className="title-wrap">
          <div className="vert-wrap" aria-hidden="true">
            <div className="vert">居合</div>
            <div className="vseal">一閃</div>
          </div>
          <div className="title-col">
            <div className="eyebrow">One blade · Endless foes · One life</div>
            <h1 className="logo">IAÏ</h1>
            <p className="tag">
              The wind carries their blades.
              <br />
              Cut at the perfect moment.
            </p>
            <ul className="howto">
              <li className="desk">
                <span className="k">A</span>
                <span className="k">D</span>move · <span className="k">W</span>jump
              </li>
              <li className="desk">
                <span className="k">Space</span>slash the way you face
              </li>
              <li className="desk">
                <span className="k">Shift</span>unleash the wolf spirit
              </li>
              <li className="touchonly">◀ ▶ to move, Jump to leap, 斬 to slash</li>
              <li className="touchonly">Tap the wolf when it glows</li>
              <li>
                Strike at the right moment for a <b>perfect cut</b>
              </li>
            </ul>
            <button id="btnPlay" className="seal-btn" type="button">
              抜刀<span>Draw</span>
            </button>
            <div className="records">
              Best <b id="tBest">—</b> &nbsp;·&nbsp; Best combo <b id="tCombo">—</b>
            </div>
            <button className="mute" type="button" />
          </div>
        </div>
      </div>

      <div id="hud">
        <div className="hud-score">
          <div className="lab">得点 · SCORE</div>
          <div id="score">0</div>
          <div id="mult">×1</div>
        </div>
        <div id="health" role="meter" aria-label="Health" aria-valuemin={0} aria-valuemax={100} aria-valuenow={100}>
          <div className="hp-lab">体 · HEALTH</div>
          <div className="hp-bar">
            <i id="hpFill" />
          </div>
          <div id="survived">0:00</div>
        </div>
        <button id="wolfBtn" type="button" aria-label="Unleash the wolf spirit">
          <span className="ico">
            <svg viewBox="0 0 64 64" aria-hidden="true">
              <defs>
                <clipPath id="wolfClip">
                  <path d="M8 40 L14 12 L24 26 L34 22 L46 10 L48 28 L58 36 L50 40 L56 46 L44 46 L38 54 L30 46 L18 50 Z" />
                </clipPath>
              </defs>
              <path
                d="M8 40 L14 12 L24 26 L34 22 L46 10 L48 28 L58 36 L50 40 L56 46 L44 46 L38 54 L30 46 L18 50 Z"
                fill="rgba(12,13,28,.12)"
                stroke="#0c0d1c"
                strokeWidth="2.4"
                strokeLinejoin="round"
              />
              <rect id="wolfFill" x="0" y="64" width="64" height="64" fill="#2246c0" clipPath="url(#wolfClip)" />
              <circle cx="44" cy="30" r="2.4" fill="#ff9b3d" />
            </svg>
          </span>
          <span className="lbl">
            <span className="desk">SHIFT</span>
            <span className="touchonly">WOLF</span>
          </span>
        </button>
        <div id="bossbar">
          <span>鬼</span>
          <div className="bar">
            <i id="bossHp" />
          </div>
        </div>
      </div>
      <div id="touch">
        <div className="grp">
          <button type="button" data-k="left" aria-label="Move left">
            ◀
          </button>
          <button type="button" data-k="right" aria-label="Move right">
            ▶
          </button>
          <button type="button" data-k="jump">
            JUMP
          </button>
        </div>
        <div className="grp">
          <button type="button" data-k="slash" className="big" aria-label="Slash">
            斬
          </button>
        </div>
      </div>

      <div id="end" className="screen">
        <div className="end-card">
          <div className="eyebrow">風止む · The wind falls still</div>
          <div className="rank">
            <div className="seal">
              <span id="rankK">侍</span>
            </div>
            <div className="rank-fr" id="rankFr">
              Samurai
            </div>
          </div>
          <div id="eScore">0</div>
          <div id="eNew">New best</div>
          <div className="stats">
            <div>
              <b id="eKills">0</b>
              <span>foes cut down</span>
            </div>
            <div>
              <b id="ePerf">—</b>
              <span>perfect cuts</span>
            </div>
            <div>
              <b id="eCombo">0</b>
              <span>best combo</span>
            </div>
            <div>
              <b id="eOni">0</b>
              <span>oni slain</span>
            </div>
          </div>
          <div className="bestline">
            Survived <b id="eTime">0:00</b> &nbsp;·&nbsp; Best &nbsp;<b id="eBest">0</b>
          </div>
          <div className="btns">
            <button id="btnAgain" className="seal-btn small" type="button">
              再戦<span>Again</span>
            </button>
            <button id="btnMenu" className="ghost" type="button">
              Menu
            </button>
          </div>
          <div className="hint">
            <span className="desk">
              <span className="k">Space</span>to play again right away
            </span>
          </div>
          <button className="mute" type="button" />
        </div>
      </div>
    </>
  );
});
