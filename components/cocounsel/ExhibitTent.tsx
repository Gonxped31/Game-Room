import { COLOR } from "@/lib/games/cocounsel/theme";

/** The small yellow trapezoid numbering a card in hand, e.g. "1" / "2" / "3". */
export default function ExhibitTent({ n }: { n: number }) {
  return (
    <div
      aria-hidden="true"
      className="flex h-9 w-11 shrink-0 items-center justify-center font-[family-name:var(--font-archivo-narrow)] text-2xl font-bold"
      style={{ backgroundColor: COLOR.yellow, color: COLOR.ink, clipPath: "polygon(14% 0, 86% 0, 100% 100%, 0 100%)" }}
    >
      {n}
    </div>
  );
}
