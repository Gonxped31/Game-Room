import { NUMBER_GRADIENTS } from "@/lib/games/ftw/constants";

const FELT = "#128A94";

/** Horizontal offset from panel center, rotation, and distance from the panel's bottom - one entry per card, center card last-but-one in reading order but positioned at offset 0. */
const DESKTOP_CARDS = [
  { offset: -92, rotate: -16, bottom: 26 },
  { offset: -46, rotate: -8, bottom: 34 },
  { offset: 0, rotate: 0, bottom: 38 },
  { offset: 46, rotate: 8, bottom: 34 },
  { offset: 92, rotate: 16, bottom: 26 },
] as const;

const MOBILE_CARDS = [
  { offset: -56, rotate: -16, bottom: 10 },
  { offset: -28, rotate: -8, bottom: 15 },
  { offset: 0, rotate: 0, bottom: 17 },
  { offset: 28, rotate: 8, bottom: 15 },
  { offset: 56, rotate: 16, bottom: 10 },
] as const;

function FanCard({ n, offset, rotate, bottom, width, height, fontSize }: { n: number; offset: number; rotate: number; bottom: number; width: number; height: number; fontSize: number }) {
  const [from, to] = NUMBER_GRADIENTS[n - 1];
  return (
    <div
      className="absolute rounded-[8px] border bg-white"
      style={{
        width,
        height,
        left: `calc(50% + ${offset}px - ${width / 2}px)`,
        bottom,
        borderColor: "#D6D6D6",
        boxShadow: "0 2px 0 rgba(0,0,0,.25), 0 4px 10px rgba(0,0,0,.25)",
        transform: `rotate(${rotate}deg)`,
        transformOrigin: "bottom center",
      }}
    >
      <span
        className="absolute inset-0 flex items-center justify-center font-[family-name:var(--font-fredoka)] font-bold"
        style={{
          fontSize,
          backgroundImage: `linear-gradient(to bottom, ${from}, ${to})`,
          WebkitBackgroundClip: "text",
          backgroundClip: "text",
          color: "transparent",
        }}
      >
        {n}
      </span>
    </div>
  );
}

/** First to Worst's picker-card art: a fanned hand of the five number cards, per references/game-room/game-room-ui-spec.md's "Art: First to Worst". */
export default function FtwArt() {
  return (
    <div aria-hidden="true" className="relative h-full w-full overflow-hidden" style={{ backgroundColor: FELT }}>
      <div className="absolute inset-0 hidden min-[760px]:block">
        {DESKTOP_CARDS.map((c, i) => (
          <FanCard key={i} n={i + 1} offset={c.offset} rotate={c.rotate} bottom={c.bottom} width={80} height={112} fontSize={56} />
        ))}
      </div>
      <div className="absolute inset-0 min-[760px]:hidden">
        {MOBILE_CARDS.map((c, i) => (
          <FanCard key={i} n={i + 1} offset={c.offset} rotate={c.rotate} bottom={c.bottom} width={48} height={68} fontSize={34} />
        ))}
      </div>
    </div>
  );
}
