"use client";

import { type CSSProperties, useMemo, useState } from "react";
import type { Role } from "@/lib/session/types";
import { type Board as BoardData, type Colour, legalMoves } from "@/lib/games/lasthop/board";
import type { Pawn } from "@/lib/games/lasthop/constants";
import { PawnShape } from "./pawns";
import { FOCUS, seatColor, seatShade } from "./ui";

interface BoardProps {
  board: BoardData;
  /** Who plays each colour this round: their pieces wear their colour and pawn. */
  seatOf: (colour: Colour) => Role;
  pawnOf: (seat: Role) => Pawn;
  /**
   * Turn the board half a turn, so the viewer's own pieces start at the
   * bottom (or right) and move up (or left). True for whoever plays A.
   */
  rotated: boolean;
  /** The viewer's colour while it's their move; null otherwise (nothing to select). */
  moving: Colour | null;
  last?: { from: number; to: number };
  /** Changes with every move, so the hop animation replays. */
  moveKey: number;
  onMove: (from: number, to: number) => void;
  /** Read out with every piece and square. */
  nameOf: (seat: Role) => string;
}

/**
 * The board: a Track (one row: a column of wells on phones, a row from
 * 640px) or a Grid. A tap on one of your pieces that can move shows where it
 * can go; a tap there moves it. Pieces that can't move on your turn are dimmed.
 */
export default function Board({ board, seatOf, pawnOf, rotated, moving, last, moveKey, onMove, nameOf }: BoardProps) {
  const [selected, setSelected] = useState<{ cell: number; key: number } | null>(null);
  const moves = useMemo(() => (moving ? legalMoves(board, moving) : []), [board, moving]);
  // A selection belongs to the move it was made in; any move clears it.
  const pick = selected && selected.key === moveKey && moves.some((m) => m.from === selected.cell) ? selected.cell : null;
  const targets = new Map(moves.filter((m) => m.from === pick).map((m) => [m.to, m]));
  const movable = new Set(moves.map((m) => m.from));

  const track = board.h === 1;
  const n = board.cells.length;
  const order = Array.from({ length: n }, (_, i) => (rotated ? n - 1 - i : i));
  // Display coordinates: the rotation turns index i into n - 1 - i.
  const xy = (i: number) => {
    const d = rotated ? n - 1 - i : i;
    return { x: d % board.w, y: Math.floor(d / board.w) };
  };

  const click = (cell: number) => {
    const move = targets.get(cell);
    if (pick != null && move) {
      setSelected(null);
      onMove(move.from, move.to);
    } else if (movable.has(cell)) setSelected(pick === cell ? null : { cell, key: moveKey });
    else setSelected(null);
  };

  const describe = (cell: number) => {
    const { x, y } = xy(cell);
    const where = track ? `Square ${x + 1}` : `Row ${y + 1}, column ${x + 1}`;
    const c = board.cells[cell];
    if (c === ".") return targets.has(cell) ? `${where}: move here` : `${where}: empty`;
    const owner = nameOf(seatOf(c as Colour));
    const mine = moving === c;
    const state = !mine ? "" : pick === cell ? ", selected" : movable.has(cell) ? ", can move" : ", can't move";
    return `${where}: ${owner}'s piece${state}`;
  };

  const style = { "--w": board.w } as CSSProperties;
  return (
    <div role="group" aria-label={track ? "The track" : "The grid"} className={`lh-board ${track ? "lh-track" : "lh-grid"} ${rotated ? "lh-rot" : ""}`} style={style}>
      {order.map((cell) => {
        const c = board.cells[cell];
        const piece = c === "A" || c === "B" ? (c as Colour) : null;
        const seat = piece ? seatOf(piece) : null;
        const isTarget = targets.has(cell);
        const isPick = pick === cell;
        const canMove = movable.has(cell);
        const dim = moving != null && piece === moving && !canMove;
        const interactive = isTarget || canMove;
        // The piece that just landed hops in from where it was.
        let hop: CSSProperties | undefined;
        if (piece && last && last.to === cell) {
          const from = xy(last.from);
          const to = xy(last.to);
          hop = track
            ? ({ "--d": from.x - to.x } as CSSProperties)
            : ({ "--dx": from.x - to.x, "--dy": from.y - to.y } as CSSProperties);
        }
        // Forward is toward higher indices for A: on screen, that flips with the rotation.
        const forward = piece ? (piece === "A") !== rotated : false;
        return (
          <button
            key={cell}
            type="button"
            onClick={() => click(cell)}
            disabled={!interactive && pick == null}
            aria-label={describe(cell)}
            aria-pressed={canMove ? isPick : undefined}
            className={`lh-well ${isTarget ? "lh-target" : ""} ${last?.from === cell && !piece ? "lh-left" : ""} ${interactive ? "cursor-pointer" : "cursor-default"} ${FOCUS}`}
          >
            {piece && seat ? (
              <span
                key={hop ? moveKey : undefined}
                className={`lh-piece ${hop ? "lh-hop" : ""} ${isPick ? "lh-picked" : ""} ${canMove && !isPick ? "lh-movable" : ""} ${dim ? "lh-dim" : ""}`}
                style={hop}
              >
                <PawnShape pawn={pawnOf(seat)} fill={seatColor(seat)} shade={seatShade(seat)} className="lh-body" />
                <svg aria-hidden="true" viewBox="0 0 24 24" className={`lh-chev ${forward ? "lh-fwd" : "lh-back"}`}>
                  <path d="M9 6l6 6-6 6" fill="none" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </span>
            ) : isTarget ? (
              <span aria-hidden="true" className="lh-dot" />
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
