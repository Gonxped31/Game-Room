"use client";

import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import { MAX_SIZE, MIN_SIZE, VARIANTS, type Variant } from "@/lib/games/regions/constants";
import { generate } from "@/lib/games/regions/generate";
import { clearAll, newPlay, setMark, status, undo, type Mark, type Play } from "@/lib/games/regions/play";
import { GLYPH, VARIANT_NAME, VARIANT_RULE } from "@/lib/games/regions/theme";
import Board from "./Board";
import { formatTime, Segmented, Toggle, Toolbar } from "./Controls";

const SIZES = Array.from({ length: MAX_SIZE - MIN_SIZE + 1 }, (_, i) => MIN_SIZE + i);
const VARIANT_ICON: Record<Variant, string> = { rook: GLYPH.rook, king: GLYPH.king, knight: GLYPH.knight, queen: GLYPH.queen, mix: "✦" };

/** This device's choices and best times (try/catch: storage can be blocked). */
const STORAGE_KEY = "checkmate-grid:endless:v1";
interface Saved {
  variant: Variant;
  size: number;
  autoMark: boolean;
  /** Best solve time (ms) per `${variant}-${size}`. */
  best: Record<string, number>;
}
const DEFAULTS: Saved = { variant: "king", size: 7, autoMark: false, best: {} };

function load(): Saved {
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "null") as Partial<Saved> | null;
    if (!raw) return DEFAULTS;
    return {
      variant: VARIANTS.includes(raw.variant as Variant) ? (raw.variant as Variant) : DEFAULTS.variant,
      size: SIZES.includes(raw.size as number) ? (raw.size as number) : DEFAULTS.size,
      autoMark: raw.autoMark === true,
      best: raw.best && typeof raw.best === "object" ? raw.best : {},
    };
  } catch {
    return DEFAULTS;
  }
}
function save(saved: Saved) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(saved));
  } catch {
    // Not saved: the game plays the same.
  }
}

/**
 * Endless mode: a fresh puzzle whenever you like, of the piece and size you
 * pick, timed, with your best time per piece and size kept on this device.
 */
export default function EndlessGame() {
  const [saved, setSaved] = useState<Saved | null>(null);
  const [play, setPlay] = useState<Play | null>(null);
  const [startedAt, setStartedAt] = useState(0);
  const [now, setNow] = useState(0);

  const update = (change: Partial<Saved>) =>
    setSaved((current) => {
      const next = { ...(current ?? DEFAULTS), ...change };
      save(next);
      return next;
    });

  // The latest game, for handlers that run several times before React re-renders (a drag paints many cells).
  const latest = useRef<Play | null>(null);
  const commit = useCallback((next: Play | null) => {
    latest.current = next;
    setPlay(next);
  }, []);

  const deal = useCallback(
    (variant: Variant, size: number) => {
      commit(null);
      // After a paint, so "Shuffling…" shows while a big grid is built.
      setTimeout(() => {
        const { puzzle } = generate(crypto.randomUUID(), { variant, size });
        const start = performance.now();
        commit(newPlay(puzzle));
        setStartedAt(start);
        setNow(start);
      }, 30);
    },
    [commit],
  );

  useEffect(() => {
    const timer = setTimeout(() => {
      const first = load();
      setSaved(first);
      deal(first.variant, first.size);
    }, 0);
    return () => clearTimeout(timer);
  }, [deal]);

  const solved = play ? status(play).solved : false;
  useEffect(() => {
    if (!play || solved) return;
    const timer = setInterval(() => setNow(performance.now()), 250);
    return () => clearInterval(timer);
  }, [play, solved]);

  const elapsed = (play && solved ? play.moves[play.moves.length - 1].t : now - startedAt) || 0;
  const bestKey = play ? `${play.puzzle.variant}-${play.puzzle.size}` : "";
  const best = saved && bestKey ? saved.best[bestKey] : undefined;

  const onSet = (cell: number, to: Mark) => {
    const current = latest.current;
    if (!current || status(current).solved) return;
    const t = Math.round(performance.now() - startedAt);
    const next = setMark(current, cell, to, t);
    commit(next);
    // A solve's time is its last move's; keep it if it beats this piece and size's best.
    if (status(next).solved && saved && !(saved.best[bestKey] <= t)) update({ best: { ...saved.best, [bestKey]: t } });
  };

  if (!saved) return <p className="cg-status">Shuffling…</p>;

  return (
    <>
      <div className="cg-settings">
        <Segmented
          label="Piece"
          options={VARIANTS}
          value={saved.variant}
          onChange={(variant) => {
            update({ variant });
            deal(variant, saved.size);
          }}
          render={(variant) => (
            <>
              <span aria-hidden="true" className="cg-seg-icon">
                {VARIANT_ICON[variant]}
              </span>
              {VARIANT_NAME[variant]}
            </>
          )}
        />
        <Segmented
          label="Grid size"
          options={SIZES}
          value={saved.size}
          onChange={(size) => {
            update({ size });
            deal(saved.variant, size);
          }}
          render={(size) => (
            <>
              {size}
              <span className="cg-sr">{` by ${size}`}</span>
            </>
          )}
        />
      </div>

      <p className="cg-rule">{VARIANT_RULE[saved.variant]}</p>

      {/* Once solved, the result takes the timer row's place, above the board, where a phone shows it. */}
      <div aria-live="polite">
        {solved ? (
          <div className="cg-solved">
            <div>
              <p className="cg-solved-title">Solved in {formatTime(elapsed)}</p>
              <p className="cg-solved-note">
                {best !== undefined && best === elapsed ? "A new best for this piece and size." : best !== undefined ? `Best ${formatTime(best)}` : null}
              </p>
            </div>
            <button type="button" className="cg-button cg-button-primary" onClick={() => deal(saved.variant, saved.size)}>
              Next puzzle
            </button>
          </div>
        ) : (
          <Toolbar
            elapsed={elapsed}
            best={best}
            canUndo={!!play && play.moves.length > 0}
            canClear={!!play && play.marks.some((mark) => mark !== 0)}
            onUndo={() => play && commit(undo(play))}
            onClear={() => play && commit(clearAll(play, Math.round(performance.now() - startedAt)))}
          />
        )}
      </div>

      {play ? (
        <Board play={play} autoMark={saved.autoMark} locked={solved} onSet={onSet} />
      ) : (
        <div className="cg-board cg-board-empty" style={{ "--n": saved.size } as CSSProperties}>
          <p className="cg-status">Shuffling…</p>
        </div>
      )}

      <div className="cg-footer">
        <Toggle label="Auto ✕" checked={saved.autoMark} onChange={(autoMark) => update({ autoMark })} />
        <button type="button" className="cg-button" onClick={() => deal(saved.variant, saved.size)}>
          New puzzle
        </button>
      </div>
    </>
  );
}
