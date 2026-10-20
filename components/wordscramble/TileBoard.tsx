"use client";

import { type CSSProperties, useEffect, useRef, useState } from "react";
import type { Team } from "@/lib/games/wordscramble/teams";
import { BulbIcon, ChunkyButton, DISPLAY, FOCUS, teamColor, teamEdge, teamText, TEXT } from "./ui";

/**
 * The playing team's board: drag the scrambled tiles into the answer slots
 * (or tap a tile to send it to the next empty slot, and a placed tile to send
 * it back), then Confirm. Each player arranges on their own device; only a
 * confirmed word is shared. Hint letters are locked in their slots.
 *
 * Desktop keys: a letter places a matching tile, Backspace takes the last one
 * back, Enter confirms.
 *
 * Tiles are sized by the `--t` custom property, so one board serves phones
 * (`phoneTile`) and desktop (76 px) without duplicating its state.
 */

type From = { kind: "row"; tile: number } | { kind: "slot"; slot: number };

interface Drag {
  from: From;
  tile: number;
  pointerId: number;
  startX: number;
  startY: number;
  x: number;
  y: number;
  moving: boolean;
}

/** How far a pointer moves before a press becomes a drag. */
const DRAG_THRESHOLD = 6;

export default function TileBoard({ scrambled, answer, hints, team, phoneTile, onConfirm, onArrange }: {
  scrambled: string[];
  /** The answer's letters: only the hinted ones (the first `hints`) are shown. */
  answer: string[];
  hints: number;
  team: Team;
  phoneTile: number;
  /** Returns whether the word was right. */
  onConfirm: (word: string) => boolean;
  /** Called on every change, for the teammates' "is arranging…". */
  onArrange: () => void;
}) {
  const n = answer.length;

  // The tiles the hints have taken (each hinted letter uses the first matching tile).
  const hintTiles: number[] = [];
  for (let i = 0; i < hints; i++) {
    const t = scrambled.findIndex((l, j) => l === answer[i] && !hintTiles.includes(j));
    hintTiles.push(t);
  }

  // slots[i]: the scrambled tile in answer slot i (hint slots are fixed), or null.
  const [slots, setSlots] = useState<(number | null)[]>(() => Array.from({ length: n }, (_, i) => (i < hints ? hintTiles[i] : null)));
  const [drag, setDrag] = useState<Drag | null>(null);
  const [shake, setShake] = useState(0);
  const boardRef = useRef<HTMLDivElement>(null);

  const inSlots = new Set(slots.filter((s): s is number => s != null));
  const full = slots.every((s) => s != null);
  const word = slots.map((s) => (s == null ? "" : scrambled[s])).join("");

  const update = (next: (number | null)[]) => {
    setSlots(next);
    onArrange();
  };

  /** Puts `tile` in `slot` (or the first empty one). A tile already there goes where `tile` came from. */
  const place = (tile: number, from: From, slot?: number) => {
    const target = slot ?? slots.findIndex((s, i) => s == null && i >= hints);
    if (target < hints || target < 0 || target >= n) return;
    const next = [...slots];
    const displaced = next[target];
    if (from.kind === "slot") next[from.slot] = displaced ?? null;
    next[target] = tile;
    update(next);
  };
  const unplace = (slot: number) => {
    if (slot < hints || slots[slot] == null) return;
    const next = [...slots];
    next[slot] = null;
    update(next);
  };
  const clear = () => update(slots.map((s, i) => (i < hints ? s : null)));

  const confirm = () => {
    if (!full) return;
    if (!onConfirm(word)) setShake((k) => k + 1);
  };

  // Desktop keys.
  const latest = useRef({ slots, place, unplace, confirm });
  useEffect(() => {
    latest.current = { slots, place, unplace, confirm };
  });
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey || e.target instanceof HTMLInputElement) return;
      const { slots: s, place: p, unplace: u, confirm: c } = latest.current;
      const used = new Set(s.filter((x): x is number => x != null));
      if (e.key === "Enter") {
        if (e.target instanceof HTMLButtonElement) return; // the focused button handles it
        e.preventDefault();
        c();
      } else if (e.key === "Backspace") {
        e.preventDefault();
        for (let i = s.length - 1; i >= hints; i--) {
          if (s[i] != null) {
            u(i);
            break;
          }
        }
      } else if (/^[a-z]$/i.test(e.key)) {
        const tile = scrambled.findIndex((l, j) => l === e.key.toUpperCase() && !used.has(j) && !hintTiles.includes(j));
        if (tile >= 0) p(tile, { kind: "row", tile });
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [scrambled, hints]); // eslint-disable-line react-hooks/exhaustive-deps -- hintTiles derives from these

  // ---- Pointer drag ---------------------------------------------------------------------

  const startDrag = (e: React.PointerEvent, from: From, tile: number) => {
    if (e.button !== 0) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    setDrag({ from, tile, pointerId: e.pointerId, startX: e.clientX, startY: e.clientY, x: e.clientX, y: e.clientY, moving: false });
  };
  const moveDrag = (e: React.PointerEvent) => {
    if (!drag || e.pointerId !== drag.pointerId) return;
    const moving = drag.moving || Math.hypot(e.clientX - drag.startX, e.clientY - drag.startY) > DRAG_THRESHOLD;
    setDrag({ ...drag, x: e.clientX, y: e.clientY, moving });
  };
  const endDrag = (e: React.PointerEvent) => {
    if (!drag || e.pointerId !== drag.pointerId) return;
    const { from, tile, moving } = drag;
    setDrag(null);
    if (!moving) {
      // A tap.
      if (from.kind === "row") place(tile, from);
      else unplace(from.slot);
      return;
    }
    const under = document.elementFromPoint(e.clientX, e.clientY)?.closest<HTMLElement>("[data-slot], [data-row]");
    if (under?.dataset.slot != null) place(tile, from, Number(under.dataset.slot));
    else if (under?.dataset.row != null && from.kind === "slot") unplace(from.slot);
  };

  // ---- Rendering --------------------------------------------------------------------------

  const tileBase = `${DISPLAY} ${FOCUS} relative flex shrink-0 cursor-grab touch-none select-none items-center justify-center rounded-[12px] text-[var(--ink)] active:cursor-grabbing`;
  const size: CSSProperties = { width: "var(--t)", height: "var(--t)", fontSize: "calc(var(--t) * 0.6)" };
  const wood: CSSProperties = { ...size, background: "var(--tile)", boxShadow: "0 6px 0 var(--tile-edge)" };
  const lifted = (tile: number) => drag?.moving && drag.tile === tile;

  return (
    <div
      ref={boardRef}
      className="flex flex-col items-center gap-5 [--t:var(--phone-t)] min-[900px]:[--t:76px]"
      style={{ "--phone-t": `${phoneTile}px` } as CSSProperties}
    >
      {/* The scrambled row: also where a dragged tile goes back to. */}
      <div data-row="" role="group" aria-label="Scrambled letters" className="flex min-h-[var(--t)] justify-center gap-1.5 min-[900px]:gap-2">
        {scrambled.map((letter, i) => {
          const gone = inSlots.has(i);
          if (gone) return <span key={i} aria-hidden="true" className="shrink-0 rounded-[12px] bg-[var(--line)] opacity-50" style={size} />;
          return (
            <button
              key={i}
              type="button"
              aria-label={`Letter ${letter}`}
              onPointerDown={(e) => startDrag(e, { kind: "row", tile: i }, i)}
              onPointerMove={moveDrag}
              onPointerUp={endDrag}
              onPointerCancel={() => setDrag(null)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  place(i, { kind: "row", tile: i });
                }
              }}
              className={tileBase}
              style={{ ...wood, transform: `rotate(${((i * 37) % 11) - 5}deg)`, opacity: lifted(i) ? 0.3 : 1 }}
            >
              {letter}
            </button>
          );
        })}
      </div>

      {/* The answer slots. */}
      <div
        role="group"
        aria-label="Your word"
        className={`flex justify-center gap-1.5 min-[900px]:gap-2 ${shake ? "animate-[ws-shake_300ms] motion-reduce:animate-none" : ""}`}
        key={`slots-${shake}`}
      >
        {slots.map((tile, i) => {
          const locked = i < hints;
          if (tile == null) {
            return (
              <span
                key={i}
                data-slot={i}
                aria-label={`Slot ${i + 1}, empty`}
                role="img"
                className="shrink-0 rounded-[12px] border-[3px] border-dashed"
                style={{ ...size, borderColor: drag?.moving ? teamColor(team) : "var(--slot)" }}
              />
            );
          }
          const letter = scrambled[tile];
          if (locked) {
            return (
              <span
                key={i}
                data-slot={i}
                role="img"
                aria-label={`Slot ${i + 1}, ${letter} (hint)`}
                className={`${DISPLAY} relative flex shrink-0 items-center justify-center rounded-[12px]`}
                style={{ ...size, background: teamColor(team), color: teamText(team), boxShadow: `0 6px 0 ${teamEdge(team)}` }}
              >
                {letter}
                <span className="absolute right-0.5 top-0.5 opacity-80">
                  <BulbIcon size={13} />
                </span>
              </span>
            );
          }
          return (
            <button
              key={i}
              type="button"
              data-slot={i}
              aria-label={`Slot ${i + 1}, ${letter}. Press to take it back`}
              onPointerDown={(e) => startDrag(e, { kind: "slot", slot: i }, tile)}
              onPointerMove={moveDrag}
              onPointerUp={endDrag}
              onPointerCancel={() => setDrag(null)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  unplace(i);
                }
              }}
              className={tileBase}
              style={{ ...wood, opacity: lifted(tile) ? 0.3 : 1 }}
            >
              {letter}
            </button>
          );
        })}
      </div>

      <div className="flex w-full max-w-[560px] gap-2">
        <ChunkyButton white className="min-h-12 flex-none px-4 text-[16px]" onClick={clear} disabled={slots.every((s, i) => i < hints || s == null)}>
          Clear
        </ChunkyButton>
        <ChunkyButton team={team} className="min-h-12 flex-1" onClick={confirm} disabled={!full}>
          {full ? `Confirm ${word}` : `Confirm (${slots.filter((s) => s != null).length}/${n})`}
        </ChunkyButton>
      </div>
      <p className={`${TEXT} m-0 -mt-2 text-center text-[13px] font-bold text-[var(--muted)]`}>Drag the tiles into the slots, or tap them in order.</p>

      {/* The tile under the finger while dragging. */}
      {drag?.moving ? (
        <span
          aria-hidden="true"
          className={`${DISPLAY} pointer-events-none fixed z-50 flex items-center justify-center rounded-[12px] text-[var(--ink)]`}
          style={{ ...wood, left: drag.x, top: drag.y, transform: "translate(-50%, -60%) rotate(-4deg) scale(1.08)", boxShadow: "0 12px 18px rgba(42,27,18,.3)" }}
        >
          {scrambled[drag.tile]}
        </span>
      ) : null}
    </div>
  );
}
