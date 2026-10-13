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
  onTapMaster?: (id: string) => void;
  onTapGuesser?: (id: string) => void;
}

function cellProps(cell: CellState, back: CardBack, ariaLabel: string, onClick?: () => void) {
  if (cell.kind === "empty") {
    return { empty: true as const, back, ariaLabel, onClick };
  }
  return {
    empty: false as const,
    back,
    n: cell.n,
    up: cell.up,
    delay: cell.delay,
    badge: cell.badge,
    badgeDelay: cell.badgeDelay,
    ariaLabel,
    onClick,
  };
}

export default function CardTable({
  prompt,
  headLeft,
  headRight,
  rows,
  onTapMaster,
  onTapGuesser,
}: CardTableProps) {
  return (
    <div>
      <div className="mb-2 grid grid-cols-[min(17vw,76px)_1fr_min(17vw,76px)] items-center gap-2.5 text-center text-[13px] font-semibold leading-tight">
        <span>{headLeft}</span>
        <span className="text-[15px]">{prompt}</span>
        <span>{headRight}</span>
      </div>
      {rows.map((row) => (
        <div
          key={row.id}
          className="mb-3 grid grid-cols-[min(17vw,76px)_1fr_min(17vw,76px)] items-center gap-2.5"
        >
          <CardSlot
            {...cellProps(row.master, "m", `${row.label}, your ranking slot`, () =>
              onTapMaster?.(row.id),
            )}
          />
          <div
            className={
              "grid min-h-[calc(min(17vw,76px)*1.5)] place-items-center rounded-[9px] bg-white p-2 text-center font-bold uppercase text-black shadow-[0_2px_0_rgba(0,0,0,.25),0_4px_10px_rgba(0,0,0,.25)] transition-[outline-color] duration-300" +
              (row.matched ? " outline outline-4 outline-[#B6FF3B]" : " outline outline-4 outline-transparent")
            }
            style={{ fontSize: "15px" }}
          >
            {row.label}
          </div>
          <CardSlot
            {...cellProps(row.guesser, "g", `${row.label}, guess slot`, () =>
              onTapGuesser?.(row.id),
            )}
          />
        </div>
      ))}
    </div>
  );
}
