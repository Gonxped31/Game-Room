"use client";

import { useMemo, useRef, useState, type CSSProperties, type KeyboardEvent, type PointerEvent } from "react";
import { colOf, rowOf } from "@/lib/games/regions/board";
import { EMPTY, MARK, nextMark, PIECE, ruledOut, status, type Mark, type Play } from "@/lib/games/regions/play";
import { GLYPH, INK, PIECE_NAME, REGION_COLORS } from "@/lib/games/regions/theme";
import type { AutoMarkHint } from "./Controls";

const INNER_LINE = "rgba(22, 38, 29, 0.25)";

/** A cell's right or bottom line: none at the board's edge, thin inside a region, thick between regions. */
function edge(side: "Right" | "Bottom", atEdge: boolean, sameRegion: boolean): CSSProperties {
  if (atEdge) return { [`border${side}Width`]: 0 };
  return sameRegion
    ? { [`border${side}Width`]: 1, [`border${side}Color`]: INNER_LINE }
    : { [`border${side}Width`]: 3, [`border${side}Color`]: INK };
}

interface BoardProps {
  play: Play;
  /** Auto ✕ (Controls.tsx): a faint ✕ on every cell the placed pieces rule out while "on", fading out while "fading". */
  hint: AutoMarkHint;
  /** Taps stop once solved. */
  locked: boolean;
  onSet: (cell: number, to: Mark) => void;
}

/**
 * The grid. A tap cycles a cell (empty → ✕ → piece); dragging from an empty
 * cell paints ✕ on every empty cell it crosses, as in Queens. Arrow keys move
 * between cells, Enter or Space cycles one.
 */
export default function Board({ play, hint, locked, onSet }: BoardProps) {
  const { puzzle, marks } = play;
  const { size } = puzzle;
  const [focus, setFocus] = useState(0);
  const cells = useRef<(HTMLButtonElement | null)[]>([]);
  const drag = useRef<{ start: number; painting: boolean; seen: Set<number> } | null>(null);

  const bad = useMemo(() => new Set(status(play).bad), [play]);
  const out = useMemo(() => (hint !== "off" ? ruledOut(play) : new Set<number>()), [hint, play]);
  /** In mix, each region's piece is drawn small in its first cell. */
  const labelCells = useMemo(() => {
    const firsts = new Map<number, number>();
    puzzle.regions.forEach((region, cell) => {
      if (!firsts.has(region)) firsts.set(region, cell);
    });
    return new Set(firsts.values());
  }, [puzzle]);

  const cellAt = (x: number, y: number) => {
    const target = document.elementFromPoint(x, y)?.closest<HTMLElement>("[data-cell]");
    return target ? Number(target.dataset.cell) : null;
  };

  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (locked || event.button !== 0) return;
    const cell = cellAt(event.clientX, event.clientY);
    if (cell === null) return;
    drag.current = { start: cell, painting: false, seen: new Set([cell]) };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const current = drag.current;
    if (!current) return;
    const cell = cellAt(event.clientX, event.clientY);
    if (cell === null || current.seen.has(cell)) return;
    if (!current.painting) {
      // Only a drag that starts on an empty cell paints.
      if (marks[current.start] !== EMPTY) return;
      current.painting = true;
      onSet(current.start, MARK);
    }
    current.seen.add(cell);
    if (marks[cell] === EMPTY) onSet(cell, MARK);
  };

  // The board captures the pointer, so the browser's click lands on the board, not the cell: a pointer tap
  // is handled here, and the buttons' onClick only answers the keyboard (Enter, Space).
  const onPointerUp = () => {
    const current = drag.current;
    drag.current = null;
    if (current && !current.painting) tap(current.start);
  };
  const onPointerCancel = () => {
    drag.current = null;
  };

  const tap = (cell: number) => {
    if (locked) return;
    setFocus(cell);
    onSet(cell, nextMark(marks[cell]));
  };

  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>, cell: number) => {
    const r = rowOf(size, cell);
    const c = colOf(size, cell);
    const moves: Record<string, [number, number]> = {
      ArrowUp: [r - 1, c],
      ArrowDown: [r + 1, c],
      ArrowLeft: [r, c - 1],
      ArrowRight: [r, c + 1],
    };
    const to = moves[event.key];
    if (!to) return;
    event.preventDefault();
    const [nr, nc] = to;
    if (nr < 0 || nr >= size || nc < 0 || nc >= size) return;
    const next = nr * size + nc;
    setFocus(next);
    cells.current[next]?.focus();
  };

  const regionAt = (r: number, c: number) => (r < 0 || r >= size || c < 0 || c >= size ? -1 : puzzle.regions[r * size + c]);

  return (
    <div
      role="grid"
      aria-label={`${size} by ${size} board`}
      className="cg-board"
      data-hint={hint}
      style={{ "--n": size } as CSSProperties}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerCancel}
    >
      {Array.from({ length: size }, (_, r) => (
        <div role="row" key={r} className="cg-row">
          {Array.from({ length: size }, (_, c) => {
            const cell = r * size + c;
            const region = puzzle.regions[cell];
            const piece = puzzle.pieces[region];
            const mark = marks[cell];
            const shown = mark === EMPTY && out.has(cell) ? "auto" : mark === MARK ? "mark" : mark === PIECE ? "piece" : "empty";
            const label = `Row ${r + 1}, column ${c + 1}: ${
              mark === PIECE ? PIECE_NAME[piece] + (bad.has(cell) ? ", clashes" : "") : mark === MARK ? "crossed out" : "empty"
            }`;
            return (
              <div role="gridcell" key={c} className="cg-cell-wrap">
                <button
                  ref={(el) => {
                    cells.current[cell] = el;
                  }}
                  type="button"
                  data-cell={cell}
                  tabIndex={cell === focus ? 0 : -1}
                  aria-label={label}
                  className="cg-cell"
                  data-shown={shown}
                  data-bad={mark === PIECE && bad.has(cell) ? "" : undefined}
                  style={{
                    backgroundColor: REGION_COLORS[region],
                    ...edge("Right", c === size - 1, regionAt(r, c + 1) === region),
                    ...edge("Bottom", r === size - 1, regionAt(r + 1, c) === region),
                  }}
                  onClick={(event) => {
                    if (event.detail === 0) tap(cell);
                  }}
                  onKeyDown={(event) => onKeyDown(event, cell)}
                >
                  {puzzle.variant === "mix" && labelCells.has(cell) ? (
                    <span aria-hidden="true" className="cg-label">
                      {GLYPH[piece]}
                    </span>
                  ) : null}
                  <span aria-hidden="true" className="cg-glyph">
                    {mark === PIECE ? GLYPH[piece] : shown === "mark" || shown === "auto" ? "✕" : ""}
                  </span>
                </button>
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}
