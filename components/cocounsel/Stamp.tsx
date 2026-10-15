import { COLOR } from "@/lib/games/cocounsel/theme";

export type StampColor = "green" | "amber" | "ink";

interface StampProps {
  children: string;
  color: StampColor;
  /** -6 to 4 degrees per the visual spec. */
  rotate?: number;
  className?: string;
}

const HEX: Record<StampColor, string> = { green: COLOR.green, amber: COLOR.amber, ink: COLOR.ink };

/**
 * A rubber stamp, e.g. "WORKING THEORY" / "DOESN'T FIT" / "DOESN'T HOLD UP" /
 * "NOT GUILTY". Rotation is a static wrapper transform (not part of the
 * landing animation) so it composes cleanly with `.stamp-land`'s
 * scale/opacity keyframe instead of both fighting over `transform`.
 */
export default function Stamp({ children, color, rotate = -4, className = "" }: StampProps) {
  const hex = HEX[color];
  return (
    <div className={`inline-block ${className}`} style={{ transform: `rotate(${rotate}deg)` }}>
      <div
        className="stamp-land select-none rounded-[6px] border-[5px] px-4 py-2 text-center font-[family-name:var(--font-archivo-narrow)] text-[clamp(28px,8vw,48px)] font-bold uppercase leading-[1.1] tracking-[0.03em]"
        style={{ color: hex, borderColor: hex, outline: `2px solid ${hex}`, outlineOffset: "4px", backgroundColor: COLOR.paper }}
      >
        {children}
      </div>
    </div>
  );
}
