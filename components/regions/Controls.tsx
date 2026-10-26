"use client";

import { useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { readJson, removeKey, writeJson } from "./storage";

/**
 * A segmented switch: role="radiogroup", arrow keys move the choice
 * (the pattern the other games use).
 */
export function Segmented<T extends string | number>({
  label,
  options,
  value,
  onChange,
  render,
}: {
  label: string;
  options: readonly T[];
  value: T;
  onChange: (value: T) => void;
  render: (option: T) => ReactNode;
}) {
  const buttons = useRef<(HTMLButtonElement | null)[]>([]);
  const onKeyDown = (event: KeyboardEvent, index: number) => {
    const step = event.key === "ArrowRight" || event.key === "ArrowDown" ? 1 : event.key === "ArrowLeft" || event.key === "ArrowUp" ? -1 : 0;
    if (!step) return;
    event.preventDefault();
    const next = (index + step + options.length) % options.length;
    onChange(options[next]);
    buttons.current[next]?.focus();
  };
  return (
    <div role="radiogroup" aria-label={label} className="cg-seg">
      {options.map((option, index) => (
        <button
          key={String(option)}
          ref={(el) => {
            buttons.current[index] = el;
          }}
          type="button"
          role="radio"
          aria-checked={option === value}
          tabIndex={option === value ? 0 : -1}
          className="cg-seg-option"
          onClick={() => onChange(option)}
          onKeyDown={(event) => onKeyDown(event, index)}
        >
          {render(option)}
        </button>
      ))}
    </div>
  );
}

/**
 * Auto ✕, the user's call (2026-10-26): a press shows a faint ✕ on every
 * square the placed pieces rule out, without placing anything, for
 * AUTO_MARK_SHOW_MS; the ✕s then fade out over AUTO_MARK_FADE_MS, and the
 * button stays locked until AUTO_MARK_LOCK_MS after the press. A peek, not a
 * permanent aid.
 */
export const AUTO_MARK_SHOW_MS = 3000;
export const AUTO_MARK_FADE_MS = 400;
export const AUTO_MARK_LOCK_MS = 30_000;

/** What the board draws for Auto ✕: nothing, the faint ✕s, or the ✕s fading out. */
export type AutoMarkHint = "off" | "on" | "fading";

/** A press as saved: which puzzle it was used on, and when (ms, wall clock). */
interface AutoMarkPress {
  puzzle: string;
  at: number;
}

const isPress = (value: unknown): value is AutoMarkPress =>
  !!value && typeof (value as AutoMarkPress).puzzle === "string" && typeof (value as AutoMarkPress).at === "number";

/**
 * Auto ✕'s timing, shared by Daily and Endless: the hint to draw, the lock's
 * seconds left, and `use` for a press.
 * - The lock belongs to the puzzle it was used on (`puzzleId`: Endless's
 *   puzzle fingerprint, Daily's day): another puzzle - New puzzle, Next
 *   puzzle, Change then Start - is unlocked straight away, and shows no hint.
 * - The press is saved under `storageKey`, so a reload of the same puzzle
 *   doesn't reset the lock: it carries on with the time it has left, and
 *   keeps counting while the page is closed.
 * - With no puzzle (`null`: the setup card, a puzzle being built) nothing is locked.
 */
export function useAutoMark(storageKey: string, puzzleId: string | null) {
  const [press, setPress] = useState<AutoMarkPress | null>(null);
  const [now, setNow] = useState(0);

  // A saved press for this puzzle whose lock hasn't run out (read after mount and on each new puzzle, never during render).
  useEffect(() => {
    if (puzzleId === null) return;
    const timer = setTimeout(() => {
      const saved = readJson(storageKey);
      const t = Date.now();
      if (isPress(saved) && saved.puzzle === puzzleId && saved.at <= t && t - saved.at < AUTO_MARK_LOCK_MS) {
        setNow(t);
        setPress(saved);
      } else if (saved !== null && (!isPress(saved) || t - saved.at >= AUTO_MARK_LOCK_MS)) {
        removeKey(storageKey);
      }
    }, 0);
    return () => clearTimeout(timer);
  }, [storageKey, puzzleId]);

  // Only a press on this very puzzle counts.
  const active = press !== null && press.puzzle === puzzleId ? press : null;

  useEffect(() => {
    if (active === null) return;
    const timer = setInterval(() => {
      const t = Date.now();
      setNow(t);
      if (t - active.at >= AUTO_MARK_LOCK_MS) {
        setPress(null);
        removeKey(storageKey);
      }
    }, 100);
    return () => clearInterval(timer);
  }, [active, storageKey]);

  const since = active === null ? Infinity : now - active.at;
  const hint: AutoMarkHint = since < AUTO_MARK_SHOW_MS ? "on" : since < AUTO_MARK_SHOW_MS + AUTO_MARK_FADE_MS ? "fading" : "off";
  const lockLeft = active === null ? 0 : Math.max(1, Math.ceil((AUTO_MARK_LOCK_MS - since) / 1000));
  const use = () => {
    if (puzzleId === null) return;
    const next = { puzzle: puzzleId, at: Date.now() };
    setNow(next.at);
    setPress(next);
    writeJson(storageKey, next);
  };
  return { hint, locked: active !== null, lockLeft, use };
}

/**
 * The Auto ✕ button. While locked (or with no piece on the board, or once
 * solved) it ignores presses, shown dimmed, with the lock's seconds left;
 * aria-disabled rather than disabled, so keyboard focus isn't lost.
 */
export function AutoMarkButton({ auto, usable }: { auto: ReturnType<typeof useAutoMark>; usable: boolean }) {
  const off = auto.locked || !usable;
  return (
    <button
      type="button"
      className="cg-button cg-auto"
      aria-disabled={off || undefined}
      aria-label={auto.locked ? `Auto ✕, available in ${auto.lockLeft} seconds` : "Auto ✕: show the squares your pieces rule out"}
      onClick={() => {
        if (!off) auto.use();
      }}
    >
      Auto ✕{auto.locked ? <span className="cg-auto-left"> {auto.lockLeft}s</span> : null}
    </button>
  );
}

/** The row above the board while playing: the time (and best), Undo and Clear. */
export function Toolbar({
  elapsed,
  best,
  canUndo,
  canClear,
  onUndo,
  onClear,
}: {
  elapsed: number;
  best?: number;
  canUndo: boolean;
  canClear: boolean;
  onUndo: () => void;
  onClear: () => void;
}) {
  return (
    <div className="cg-toolbar">
      <span className="cg-time" aria-label={`Time ${formatTime(elapsed)}`}>
        {formatTime(elapsed)}
        {best !== undefined ? <span className="cg-best"> · best {formatTime(best)}</span> : null}
      </span>
      <span className="cg-actions">
        <button type="button" className="cg-button" disabled={!canUndo} onClick={onUndo}>
          Undo
        </button>
        <button type="button" className="cg-button" disabled={!canClear} onClick={onClear}>
          Clear
        </button>
      </span>
    </div>
  );
}

/** m:ss (or h:mm:ss past an hour). */
export function formatTime(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = String(total % 60).padStart(2, "0");
  return h ? `${h}:${String(m).padStart(2, "0")}:${s}` : `${m}:${s}`;
}
