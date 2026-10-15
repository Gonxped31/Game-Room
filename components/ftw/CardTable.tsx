import type { PointerEvent as ReactPointerEvent } from "react";
import CardSlot from "./CardSlot";
import { CardBack } from "./CardFace";

export type CellState =
  | { kind: "empty" }
  | {
      kind: "card";
      n?: number;
      up: boolean;
      delay?: number;
      badge?: "ok" | "no";
      badgeDelay?: number;
    };

export interface TableRow {
  id: string;
  label: string;
  /** Outlines the topic card once both rankings are revealed and this item matched. */
  matched: boolean;
  master: CellState;
  guesser: CellState;
}

interface CardTableProps {
  prompt: string;
  headLeft: string;
  headRight: string;
  rows: TableRow[];
  /** Omit to make the whole master column non-interactive for this viewer right now. */
  onTapMaster?: (id: string) => void;
  /** Omit to make the whole guesser column non-interactive for this viewer right now. */
  onTapGuesser?: (id: string) => void;
  /** Starts a drag-to-move/-swap gesture for an already-placed master-column card. Omit to disable (e.g. not this viewer's turn to place). */
  onDragMaster?: (id: string, n: number, e: ReactPointerEvent<HTMLButtonElement>) => void;
  /** Same as onDragMaster, for the guesser column. */
  onDragGuesser?: (id: string, n: number, e: ReactPointerEvent<HTMLButtonElement>) => void;
}

function describeCell(cell: CellState): string {
  if (cell.kind === "empty") return "empty";
  const state = cell.up ? `number ${cell.n ?? "unknown"}` : "face down";
  if (cell.badge) return `${state}, ${cell.badge === "ok" ? "matched" : "did not match"}`;
  return state;
}

/** Binds a drag-start handler to this cell's own id/number, or undefined if there's no card here to drag (or dragging is disabled for this column right now). */
function dragHandlerFor(cell: CellState, id: string, onDrag?: (id: string, n: number, e: ReactPointerEvent<HTMLButtonElement>) => void) {
  if (!onDrag || cell.kind !== "card" || cell.n == null) return undefined;
  const n = cell.n;
  return (e: ReactPointerEvent<HTMLButtonElement>) => onDrag(id, n, e);
}

function cellProps(
  cell: CellState,
  back: CardBack,
  ariaLabel: string,
  dropId: string,
  onClick?: () => void,
  onDragStart?: (e: ReactPointerEvent<HTMLButtonElement>) => void,
) {
  const common = { back, ariaLabel, onClick, dropId };
  if (cell.kind === "empty") return { empty: true as const, ...common };
  return { empty: false as const, n: cell.n, up: cell.up, delay: cell.delay, badge: cell.badge, badgeDelay: cell.badgeDelay, onDragStart, ...common };
}

export default function CardTable({ prompt, headLeft, headRight, rows, onTapMaster, onTapGuesser, onDragMaster, onDragGuesser }: CardTableProps) {
  return (
    <div>
      <div className="mb-1.5 grid grid-cols-[min(15vw,68px)_1fr_min(15vw,68px)] items-center gap-2 text-center text-[13px] font-semibold leading-tight">
        <span>{headLeft}</span>
        <span className="text-[15px]">{prompt}</span>
        <span>{headRight}</span>
      </div>
      {rows.map((row) => (
        <div key={row.id} className="mb-2 grid grid-cols-[min(15vw,68px)_1fr_min(15vw,68px)] items-center gap-2">
          <CardSlot
            {...cellProps(
              row.master,
              "m",
              `${headLeft}, ${row.label}: ${describeCell(row.master)}`,
              row.id,
              onTapMaster && (() => onTapMaster(row.id)),
              dragHandlerFor(row.master, row.id, onDragMaster),
            )}
          />
          <div
            className={
              "grid min-h-[calc(min(15vw,68px)*1.4)] place-items-center rounded-[9px] bg-white p-2 text-center font-bold uppercase text-black shadow-[0_2px_0_rgba(0,0,0,.25),0_4px_10px_rgba(0,0,0,.25)] transition-[outline-color] duration-300" +
              (row.matched ? " outline outline-4 outline-[#B6FF3B]" : " outline outline-4 outline-transparent")
            }
            style={{ fontSize: "15px" }}
          >
            {row.label}
          </div>
          <CardSlot
            {...cellProps(
              row.guesser,
              "g",
              `${headRight}, ${row.label}: ${describeCell(row.guesser)}`,
              row.id,
              onTapGuesser && (() => onTapGuesser(row.id)),
              dragHandlerFor(row.guesser, row.id, onDragGuesser),
            )}
          />
        </div>
      ))}
    </div>
  );
}
