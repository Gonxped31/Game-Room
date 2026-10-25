import { useId, type JSX, type ReactNode } from "react";
import { COLOR } from "@/lib/games/cocounsel/theme";

/**
 * The hub cards' art (references/game-room/game-room-ui-spec.md, "Art
 * panels"), drawn in code (no image files). Each game has a 280x168 panel for
 * the desktop card and a 92x92 mini for the compact mobile card. Decorative:
 * the card's own text names the game.
 */

/** SVG ids must be unique per instance: desktop and mobile cards are both in the DOM. */
function useSvgId(name: string) {
  return `${name}-${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;
}

function Svg({ w, h, children }: { w: number; h: number; children: ReactNode }) {
  return (
    <svg aria-hidden="true" className="block h-full w-full" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="xMidYMid slice">
      {children}
    </svg>
  );
}

// --- Buzzer Quiz -------------------------------------------------------------

const BQ_BADGES = [
  { letter: "A", color: "#FFC23D", x: 38, y: 50, tilt: -10 },
  { letter: "B", color: "#46E0A0", x: 62, y: 118, tilt: 6 },
  { letter: "C", color: "#59A8FF", x: 218, y: 118, tilt: -6 },
  { letter: "D", color: "#FF7AC0", x: 242, y: 50, tilt: 10 },
];

/** A red buzzer: an 8px dark ring and a hard drop shadow, on a dark ellipse. */
function Buzzer({ cx, cy, d }: { cx: number; cy: number; d: number }) {
  const r = d / 2;
  const scale = d / 108;
  return (
    <g>
      <ellipse cx={cx} cy={cy + r * 0.78} rx={r * 1.25} ry={r * 0.36} fill="rgba(0,0,0,.4)" />
      <circle cx={cx} cy={cy + 8 * scale} r={r} fill="#5C0F0B" />
      <circle cx={cx} cy={cy} r={r} fill="#9E1B14" />
      <circle cx={cx} cy={cy} r={r - 8 * scale} fill="#FF4B3E" />
    </g>
  );
}

function BuzzerQuizArt({ mini }: { mini?: boolean }) {
  if (mini) {
    return (
      <Svg w={92} h={92}>
        <rect width="92" height="92" fill="#16113A" />
        <circle cx="46" cy="10" r="56" fill="#251E5C" />
        <Buzzer cx={46} cy={44} d={54} />
      </Svg>
    );
  }
  return (
    <Svg w={280} h={168}>
      <rect width="280" height="168" fill="#16113A" />
      <circle cx="140" cy="0" r="140" fill="#251E5C" />
      {BQ_BADGES.map((b) => (
        <g key={b.letter} transform={`translate(${b.x} ${b.y}) rotate(${b.tilt})`}>
          <circle r="19" fill={b.color} />
          <text y="7.5" textAnchor="middle" fontFamily="var(--font-bricolage), sans-serif" fontWeight="800" fontSize="21" fill="#16113A">
            {b.letter}
          </text>
        </g>
      ))}
      <Buzzer cx={140} cy={84} d={108} />
    </Svg>
  );
}

// --- Word Scramble -----------------------------------------------------------

/** A wood letter tile (or the orange placed one) with its hard bottom edge. */
function Tile({ x, y, size, letter, tilt = 0, placed }: { x: number; y: number; size: number; letter: string; tilt?: number; placed?: boolean }) {
  const edge = Math.round(size / 11);
  return (
    <g transform={`rotate(${tilt} ${x + size / 2} ${y + size / 2})`}>
      <rect x={x} y={y + edge} width={size} height={size} rx={size * 0.2} fill={placed ? "#A8480A" : "#B98535"} />
      <rect x={x} y={y} width={size} height={size} rx={size * 0.2} fill={placed ? "#FF7A1A" : "#F2CF8D"} />
      <text x={x + size / 2} y={y + size * 0.72} textAnchor="middle" fontFamily="var(--font-lilita), sans-serif" fontSize={size * 0.6} fill="#2A1B12">
        {letter}
      </text>
    </g>
  );
}

function Slot({ x, y, size }: { x: number; y: number; size: number }) {
  return <rect x={x + 1.5} y={y + 1.5} width={size - 3} height={size - 3} rx={size * 0.2} fill="none" stroke="#C9A26B" strokeWidth="3" strokeDasharray="6 5" />;
}

function WordScrambleArt({ mini }: { mini?: boolean }) {
  if (mini) {
    const size = 24;
    const left = (92 - (3 * size + 2 * 4)) / 2;
    return (
      <Svg w={92} h={92}>
        <rect width="92" height="92" fill="#F6E2B8" />
        {["W", "O", "R"].map((letter, i) => (
          <Tile key={letter} x={left + i * (size + 4)} y={16} size={size} letter={letter} tilt={i % 2 ? 6 : -6} />
        ))}
        <Tile x={left} y={54} size={size} letter="W" placed />
        <Slot x={left + size + 4} y={54} size={size} />
        <Slot x={left + 2 * (size + 4)} y={54} size={size} />
      </Svg>
    );
  }
  const step = 52;
  return (
    <Svg w={280} h={168}>
      <rect width="280" height="168" fill="#F6E2B8" />
      {["R", "E", "G", "T", "I"].map((letter, i) => (
        <Tile key={letter} x={14 + i * step} y={26} size={44} letter={letter} tilt={i % 2 ? 5 : -5} />
      ))}
      <Tile x={17} y={100} size={38} letter="T" placed />
      {[1, 2, 3, 4].map((i) => (
        <Slot key={i} x={17 + i * step} y={100} size={38} />
      ))}
    </Svg>
  );
}

// --- Night Highway -----------------------------------------------------------

/** Two taillights, with their glow and their reflection streaking down the wet road. */
function Taillights({ x, y, w, opacity = 1, glow, streak }: { x: number; y: number; w: number; opacity?: number; glow: string; streak: string }) {
  const lamp = w * 0.22;
  return (
    <g opacity={opacity}>
      {[x, x + w - lamp].map((lx) => (
        <g key={lx}>
          <rect x={lx - lamp * 0.6} y={y + lamp * 0.2} width={lamp * 2.2} height={w * 0.9} fill={`url(#${streak})`} />
          <circle cx={lx + lamp / 2} cy={y + lamp * 0.2} r={lamp * 1.8} fill={`url(#${glow})`} />
          <rect x={lx} y={y} width={lamp} height={lamp * 0.45} rx={lamp * 0.12} fill="#ff6b7d" />
        </g>
      ))}
    </g>
  );
}

const WINDOWS: [number, number][] = [
  [18, 92], [26, 86], [44, 98], [58, 80], [64, 94], [88, 90], [104, 84], [118, 96],
  [222, 88], [236, 94], [252, 82], [270, 92], [286, 86], [300, 98], [318, 90],
];

/**
 * The midnight freeway from behind the wheel: skyline, lane lines running to
 * the horizon, and two cars' taillights glowing on the wet asphalt, the far
 * pair fainter like the race's ghost car. One 340x200 drawing for every size:
 * `slice` crops it to the 168px panel, the 92px mini and the 40px list tile.
 * (The game's own art, kept instead of the v2 spec's placeholder road.)
 */
function NightHighwayArt() {
  const sky = useSvgId("nh-sky");
  const road = useSvgId("nh-road");
  const glow = useSvgId("nh-glow");
  const streak = useSvgId("nh-streak");
  return (
    <Svg w={340} h={200}>
      <defs>
        <linearGradient id={sky} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#03060f" />
          <stop offset="0.45" stopColor="#0a1633" />
          <stop offset="0.56" stopColor="#25386a" />
        </linearGradient>
        <linearGradient id={road} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#1b2135" />
          <stop offset="1" stopColor="#0d0f15" />
        </linearGradient>
        <radialGradient id={glow}>
          <stop offset="0" stopColor="#ff2b45" stopOpacity="0.75" />
          <stop offset="1" stopColor="#ff2b45" stopOpacity="0" />
        </radialGradient>
        <linearGradient id={streak} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ff2b45" stopOpacity="0.5" />
          <stop offset="1" stopColor="#ff2b45" stopOpacity="0" />
        </linearGradient>
      </defs>
      <rect width="340" height="200" fill={`url(#${sky})`} />
      {[[30, 18], [96, 34], [150, 12], [214, 26], [282, 14], [318, 40], [62, 52]].map(([cx, cy]) => (
        <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r="0.9" fill="#cfe0ff" opacity="0.7" />
      ))}
      {/* Skyline. */}
      <path
        d="M0 112V96h12v-8h16v14h12V84h10v-6h12v34h14V92h18v-6h10v26h20v-8h14v8h46v-6h18v-16h12v10h16V76h14v12h10v-8h16v20h12v-10h18v22h14V94h10v18Z"
        fill="#060a16"
      />
      {WINDOWS.map(([x, y]) => (
        <rect key={`${x}-${y}`} x={x} y={y} width="2" height="2" fill={x % 3 ? "#ffcf8a" : "#cfe0ff"} opacity="0.75" />
      ))}
      {/* The road, running to a vanishing point on the horizon. */}
      <polygon points="152,112 188,112 352,200 -12,200" fill={`url(#${road})`} />
      <line x1="153" y1="112" x2="-6" y2="200" stroke="#cfae45" strokeWidth="1.6" opacity="0.8" />
      <line x1="187" y1="112" x2="346" y2="200" stroke="#dcd9cf" strokeWidth="1.6" opacity="0.7" />
      {[161, 170, 179].map((top, i) => (
        <line key={top} x1={top} y1="112" x2={[78, 170, 262][i]} y2="200" stroke="#d6d3ca" strokeWidth="1.4" strokeDasharray="7 9" opacity="0.5" />
      ))}
      {/* The far car (the ghost), then the near one. */}
      <Taillights x={182} y={128} w={14} opacity={0.6} glow={glow} streak={streak} />
      <Taillights x={108} y={160} w={34} glow={glow} streak={streak} />
    </Svg>
  );
}

// --- Same Page ---------------------------------------------------------------

/** A lined notebook sheet with a red margin and a yellow "1" note, centered on (cx, cy). */
function NotebookSheet({ cx, cy, w, h, tilt }: { cx: number; cy: number; w: number; h: number; tilt: number }) {
  const x = cx - w / 2;
  const y = cy - h / 2;
  const rule = h / 8;
  const note = w * 0.36;
  return (
    <g transform={`rotate(${tilt} ${cx} ${cy})`}>
      <rect x={x} y={y + 3} width={w} height={h} rx={4} fill="rgba(29,34,64,.16)" />
      <rect x={x} y={y} width={w} height={h} rx={4} fill="#FFFDF5" />
      {Array.from({ length: 6 }, (_, i) => (
        <rect key={i} x={x} y={y + rule * (i + 2)} width={w} height={1.5} fill="#C9DDF7" />
      ))}
      <rect x={x + w * 0.2} y={y} width={1.5} height={h} fill="#FF6B6B" />
      <g transform={`rotate(${-tilt * 0.6 - 3} ${x + w * 0.62} ${y + h * 0.3})`}>
        <rect x={x + w * 0.62 - note / 2} y={y + h * 0.3 - note / 2 + 2} width={note} height={note} rx={2} fill="rgba(29,34,64,.18)" />
        <rect x={x + w * 0.62 - note / 2} y={y + h * 0.3 - note / 2} width={note} height={note} rx={2} fill="#FFE94A" />
        <text x={x + w * 0.62} y={y + h * 0.3 + note * 0.3} textAnchor="middle" fontFamily="var(--font-kalam), cursive" fontWeight="700" fontSize={note * 0.66} fill="#1D2240">
          1
        </text>
      </g>
    </g>
  );
}

function SamePageArt({ mini }: { mini?: boolean }) {
  if (mini) {
    return (
      <Svg w={92} h={92}>
        <rect width="92" height="92" fill="#B9A7FF" />
        <NotebookSheet cx={46} cy={48} w={56} h={68} tilt={-6} />
      </Svg>
    );
  }
  return (
    <Svg w={280} h={168}>
      <rect width="280" height="168" fill="#B9A7FF" />
      <NotebookSheet cx={84} cy={86} w={112} h={136} tilt={-7} />
      <NotebookSheet cx={196} cy={86} w={112} h={136} tilt={6} />
      <circle cx="140" cy="88" r="22" fill="#1D2240" />
      <text x="140" y="97" textAnchor="middle" fontFamily="var(--font-dm-sans), sans-serif" fontWeight="700" fontSize="26" fill="#FFFFFF">
        =
      </text>
    </Svg>
  );
}

// --- Co-Counsel --------------------------------------------------------------

const CC_INK = "#1C1F3D";

function ClaimCard({ cx, y, w, h, tilt, strip }: { cx: number; y: number; w: number; h: number; tilt: number; strip: string }) {
  const x = cx - w / 2;
  const stripH = h * 0.17;
  return (
    <g transform={`rotate(${tilt} ${cx} ${y + h / 2})`}>
      <rect x={x} y={y} width={w} height={h} rx={8} fill="#FFFFFF" stroke={CC_INK} strokeWidth={2} />
      <path d={`M${x + 1} ${y + stripH} V ${y + 8} Q ${x + 1} ${y + 1} ${x + 8} ${y + 1} H ${x + w - 8} Q ${x + w - 1} ${y + 1} ${x + w - 1} ${y + 8} V ${y + stripH} Z`} fill={strip} />
      <path d={`M${x + 8} ${y + 3} H ${x + 26} L ${x + 29} ${y + stripH - 1} H ${x + 5} Z`} fill={COLOR.yellow} />
      <rect x={x + w * 0.1} y={y + stripH + h * 0.14} width={w * 0.8} height={h * 0.05} rx={2} fill="#D7DAE8" />
      <rect x={x + w * 0.1} y={y + stripH + h * 0.25} width={w * 0.65} height={h * 0.05} rx={2} fill="#D7DAE8" />
    </g>
  );
}

/** The yellow "lens": two overlapping white rings with a yellow dot where they meet. */
function Lens({ cx, cy, d }: { cx: number; cy: number; d: number }) {
  const r = d / 2 - 1;
  const off = d * 0.3;
  return (
    <g>
      <circle cx={cx - off} cy={cy} r={r} fill="none" stroke="#FFFFFF" strokeWidth={2} />
      <circle cx={cx + off} cy={cy} r={r} fill="none" stroke="#FFFFFF" strokeWidth={2} />
      <circle cx={cx} cy={cy} r={d * 0.22} fill={COLOR.yellow} />
    </g>
  );
}

function CoCounselArt({ mini }: { mini?: boolean }) {
  const w = mini ? 92 : 280;
  const h = mini ? 92 : 168;
  return (
    <Svg w={w} h={h}>
      <rect width={w / 2} height={h} fill={COLOR.investigator} />
      <rect x={w / 2} width={w / 2} height={h} fill={COLOR.defendant} />
      {mini ? (
        <Lens cx={46} cy={46} d={40} />
      ) : (
        <>
          <ClaimCard cx={98} y={16} w={74} h={102} tilt={-7} strip={COLOR.investigator} />
          <ClaimCard cx={182} y={16} w={74} h={102} tilt={7} strip={COLOR.defendant} />
          <Lens cx={140} cy={140} d={36} />
        </>
      )}
    </Svg>
  );
}

// --- Lookup ------------------------------------------------------------------

const ART: Record<string, (props: { mini?: boolean }) => JSX.Element> = {
  buzzerquiz: BuzzerQuizArt,
  wordscramble: WordScrambleArt,
  nighthighway: NightHighwayArt,
  ftw: SamePageArt,
  cocounsel: CoCounselArt,
};

/** A game's art panel (`mini`: the compact card's 92px square), or nothing for a game without art yet. */
export default function GameArt({ slug, mini }: { slug: string; mini?: boolean }) {
  const Art = ART[slug];
  return Art ? <Art mini={mini} /> : null;
}
