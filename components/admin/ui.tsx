import type { ReactNode } from "react";

/** The dashboard's building blocks: a white card, a number tile, a right-aligned table cell. */

export function StatTile({ label, value, note }: { label: string; value: string; note: string }) {
  return (
    <section className="flex flex-col gap-1 rounded-2xl bg-white p-4 shadow-[0_4px_0_rgba(0,0,0,.25)]">
      <h2 className="m-0 text-sm font-semibold text-black/60">{label}</h2>
      <p className="m-0 text-2xl font-bold whitespace-nowrap text-black min-[760px]:text-3xl">{value}</p>
      <p className="m-0 text-xs text-black/60">{note}</p>
    </section>
  );
}

export function Panel({ title, children }: { title?: string; children: ReactNode }) {
  return (
    <section className="rounded-2xl bg-white p-4 shadow-[0_4px_0_rgba(0,0,0,.25)] min-[760px]:p-5">
      {title && <h2 className="m-0 mb-2 text-lg font-bold">{title}</h2>}
      {children}
    </section>
  );
}

export function Num({ children, head, className = "" }: { children: ReactNode; head?: boolean; className?: string }) {
  const Cell = head ? "th" : "td";
  return <Cell className={`py-2 pl-3 text-right tabular-nums ${head ? "font-semibold" : ""} ${className}`}>{children}</Cell>;
}
