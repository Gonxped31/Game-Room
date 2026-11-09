import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import type { CSSProperties, ReactNode } from "react";
import { ALL_GAMES, APP_TITLE, gameBySlug } from "@/lib/games/registry";
import type { Lang } from "@/lib/i18n/lang";
import type { Preview } from "./previews";
import { previewFor } from "./previews";

/**
 * The link-preview card images (docs/link-previews.md): 1200x630 PNGs, one
 * per page and language. Each game's card takes its colors (registry ink and
 * accentColor, its page's background) and its title face, with a motif of
 * its own drawn here. Everything that matters (the Partyfox wordmark, the
 * pill, the name, the line) sits in the middle 640px, so the square crops
 * some apps make for small thumbnails keep it; the motifs live at the edges.
 *
 * Rendered with next/og's ImageResponse (satori), which needs TTF/OTF data:
 * the faces are vendored subsets in lib/seo/fonts/ (OFL.txt), read from disk,
 * never fetched. Each path is a literal so Next's file tracing ships them.
 */

export const CARD_SIZE = { width: 1200, height: 630 };

type FontKey = "fredoka600" | "fredoka700" | "bagel" | "archivo" | "bigShoulders" | "bricolage" | "lilita" | "fraunces" | "overpass" | "rubik";

const FONTS: Record<FontKey, { name: string; weight: 400 | 600 | 700 | 800; load: () => Promise<Buffer> }> = {
  fredoka600: { name: "Fredoka", weight: 600, load: () => readFile(join(process.cwd(), "lib/seo/fonts/Fredoka-SemiBold.ttf")) },
  fredoka700: { name: "Fredoka", weight: 700, load: () => readFile(join(process.cwd(), "lib/seo/fonts/Fredoka-Bold.ttf")) },
  bagel: { name: "Bagel Fat One", weight: 400, load: () => readFile(join(process.cwd(), "lib/seo/fonts/BagelFatOne-Regular.ttf")) },
  archivo: { name: "Archivo", weight: 800, load: () => readFile(join(process.cwd(), "lib/seo/fonts/Archivo-ExtraBold.ttf")) },
  bigShoulders: { name: "Big Shoulders", weight: 800, load: () => readFile(join(process.cwd(), "lib/seo/fonts/BigShoulders-ExtraBold.ttf")) },
  bricolage: { name: "Bricolage Grotesque", weight: 800, load: () => readFile(join(process.cwd(), "lib/seo/fonts/BricolageGrotesque-ExtraBold.ttf")) },
  lilita: { name: "Lilita One", weight: 400, load: () => readFile(join(process.cwd(), "lib/seo/fonts/LilitaOne-Regular.ttf")) },
  fraunces: { name: "Fraunces", weight: 800, load: () => readFile(join(process.cwd(), "lib/seo/fonts/Fraunces-ExtraBold.ttf")) },
  overpass: { name: "Overpass", weight: 800, load: () => readFile(join(process.cwd(), "lib/seo/fonts/Overpass-ExtraBold.ttf")) },
  rubik: { name: "Rubik", weight: 800, load: () => readFile(join(process.cwd(), "lib/seo/fonts/Rubik-ExtraBold.ttf")) },
};

const fontCache = new Map<FontKey, Promise<Buffer>>();
const fontData = (key: FontKey) => {
  let data = fontCache.get(key);
  if (!data) {
    data = FONTS[key].load();
    fontCache.set(key, data);
  }
  return data;
};

/** A card's look: its background, text colors, pill, title face and edge motif. */
interface Theme {
  background: string;
  title: string;
  text: string;
  pill: string;
  pillText: string;
  font: FontKey;
  /** The name's size in px, so it fits the middle 640px (on one line or two). */
  titleSize: number;
  titleStyle?: CSSProperties;
  motif: () => ReactNode;
}

const box = (left: number, top: number, width: number, height: number, style: CSSProperties = {}): CSSProperties => ({ position: "absolute", left, top, width, height, display: "flex", ...style });

/** A full-card SVG layer for a motif's shapes. */
const Layer = ({ children }: { children: ReactNode }) => (
  <svg width={CARD_SIZE.width} height={CARD_SIZE.height} viewBox={`0 0 ${CARD_SIZE.width} ${CARD_SIZE.height}`} style={{ position: "absolute", left: 0, top: 0 }}>
    {children}
  </svg>
);

// --- Motifs: simple shapes evoking each game, kept to the edges -------------

function HubMotif() {
  // Confetti in every game's accent color.
  const colors = ALL_GAMES.map((g) => g.accentColor);
  const bits: [number, number, number, number][] = [
    [70, 90, 46, -12], [210, 40, 28, 18], [130, 250, 34, 30], [60, 430, 52, 8], [220, 520, 30, -20], [250, 340, 22, 40],
    [1090, 70, 44, 14], [960, 60, 26, -16], [1060, 250, 34, -28], [1120, 420, 50, 10], [950, 520, 32, 22], [990, 360, 22, -40],
  ];
  return (
    <>
      {bits.map(([x, y, s, tilt], i) => (
        <div key={i} style={box(x, y, s, s, { background: colors[i % colors.length], borderRadius: i % 3 ? s / 2 : s * 0.25, transform: `rotate(${tilt}deg)`, boxShadow: "0 4px 0 rgba(0,0,0,.18)" })} />
      ))}
    </>
  );
}

function BuzzerQuizMotif() {
  const badge = (letter: string, color: string, x: number, y: number, tilt: number) => (
    <div key={letter} style={box(x, y, 92, 92, { borderRadius: 46, background: color, alignItems: "center", justifyContent: "center", transform: `rotate(${tilt}deg)`, fontFamily: "Bricolage Grotesque", fontSize: 52, color: "#16113A" })}>
      {letter}
    </div>
  );
  return (
    <>
      <Layer>
        <circle cx="600" cy="-60" r="420" fill="#251E5C" />
        {/* A red buzzer at each lower corner. */}
        {[150, 1050].map((cx) => (
          <g key={cx}>
            <ellipse cx={cx} cy={548} rx={138} ry={40} fill="rgba(0,0,0,.4)" />
            <circle cx={cx} cy={488} r={104} fill="#5C0F0B" />
            <circle cx={cx} cy={472} r={104} fill="#9E1B14" />
            <circle cx={cx} cy={472} r={88} fill="#FF4B3E" />
          </g>
        ))}
      </Layer>
      {badge("A", "#FFC23D", 96, 92, -10)}
      {badge("B", "#46E0A0", 168, 236, 7)}
      {badge("C", "#59A8FF", 940, 236, -7)}
      {badge("D", "#FF7AC0", 1012, 92, 10)}
    </>
  );
}

function WordScrambleMotif() {
  const tile = (letter: string, x: number, y: number, tilt: number, placed = false) => (
    <div key={`${letter}${x}`} style={box(x, y, 104, 112, { transform: `rotate(${tilt}deg)` })}>
      <div style={box(0, 9, 104, 104, { borderRadius: 22, background: placed ? "#A8480A" : "#B98535" })} />
      <div style={box(0, 0, 104, 104, { borderRadius: 22, background: placed ? "#FF7A1A" : "#F2CF8D", alignItems: "center", justifyContent: "center", fontFamily: "Lilita One", fontSize: 64, color: "#2A1B12" })}>{letter}</div>
    </div>
  );
  const slot = (x: number, y: number) => <div key={`s${x}${y}`} style={box(x, y, 100, 100, { borderRadius: 22, border: "5px dashed #C9A26B" })} />;
  return (
    <>
      {tile("W", 70, 70, -8)}
      {tile("O", 170, 250, 6)}
      {tile("R", 60, 420, -4, true)}
      {slot(200, 470)}
      {tile("D", 1030, 70, 7)}
      {tile("S", 930, 250, -6)}
      {tile("A", 1040, 420, 5)}
      {slot(900, 470)}
    </>
  );
}

function LastHopMotif() {
  const wells = [90, 230, 370, 510, 650, 790, 930, 1070];
  const y = 560;
  const square = (cx: number, cy: number, s: number) => (
    <g key={`p${cx}`}>
      <rect x={cx - s} y={cy - s + 10} width={s * 2} height={s * 2} rx={s * 0.48} fill="#B4511E" />
      <rect x={cx - s} y={cy - s} width={s * 2} height={s * 2} rx={s * 0.48} fill="#FF8A4C" />
      <circle cx={cx - s * 0.35} cy={cy - s * 0.4} r={s * 0.3} fill="#fff" opacity={0.3} />
    </g>
  );
  const circle = (cx: number, cy: number, r: number) => (
    <g key={`c${cx}`}>
      <circle cx={cx} cy={cy + 10} r={r} fill="#1D8A70" />
      <circle cx={cx} cy={cy} r={r} fill="#43D6B5" />
      <circle cx={cx - r * 0.3} cy={cy - r * 0.35} r={r * 0.32} fill="#fff" opacity={0.3} />
    </g>
  );
  return (
    <Layer>
      <circle cx="600" cy="700" r="420" fill="#2B2247" />
      {wells.map((cx, i) => (
        <rect key={cx} x={cx - 44} y={y - 44} width={88} height={88} rx={26} fill="#140F26" stroke={i === 2 ? "#FFE066" : "#3D3266"} strokeWidth={4} strokeDasharray={i === 2 ? "10 8" : undefined} />
      ))}
      {square(90, y - 4, 32)}
      {circle(930, y - 4, 34)}
      {circle(1070, y - 4, 34)}
      {/* The tangerine piece mid-hop over a mint one, into the dashed well. */}
      {circle(230, y - 4, 34)}
      <path d={`M90 ${y - 60} Q160 ${y - 180} 370 ${y - 60}`} fill="none" stroke="#FFF6EA" strokeWidth={6} strokeDasharray="0 16" strokeLinecap="round" opacity={0.7} />
      {square(150, y - 170, 34)}
    </Layer>
  );
}

function NightHighwayMotif() {
  const stars: [number, number][] = [[60, 40], [180, 110], [300, 50], [420, 150], [140, 260], [880, 60], [1000, 140], [1120, 50], [1060, 280], [780, 120], [250, 340], [960, 360]];
  const lights = (x: number, y: number, w: number, opacity: number) => (
    <g opacity={opacity}>
      {[x, x + w - w * 0.22].map((lx) => (
        <g key={lx}>
          <circle cx={lx + w * 0.11} cy={y} r={w * 0.42} fill="url(#nh-glow)" />
          <rect x={lx} y={y - w * 0.05} width={w * 0.22} height={w * 0.1} rx={w * 0.03} fill="#ff6b7d" />
        </g>
      ))}
    </g>
  );
  return (
    <Layer>
      <defs>
        <linearGradient id="nh-road" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#1b2135" />
          <stop offset="1" stopColor="#0d0f15" />
        </linearGradient>
        <radialGradient id="nh-glow">
          <stop offset="0" stopColor="#ff2b45" stopOpacity="0.8" />
          <stop offset="1" stopColor="#ff2b45" stopOpacity="0" />
        </radialGradient>
      </defs>
      {stars.map(([cx, cy]) => (
        <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r="2.2" fill="#cfe0ff" opacity="0.7" />
      ))}
      {/* The skyline, then the road from the horizon to the bottom corners. */}
      <path d="M0 480V440h40v-30h50v40h40v-60h36v20h44v40h60v-26h50v56h660v-50h50v24h48v-56h36v36h44v-30h44v52h48v-20h50v54Z" fill="#060a16" />
      <polygon points="560,480 640,480 1260,630 -60,630" fill="url(#nh-road)" />
      <line x1="563" y1="480" x2="-40" y2="630" stroke="#cfae45" strokeWidth="4" opacity="0.8" />
      <line x1="637" y1="480" x2="1240" y2="630" stroke="#dcd9cf" strokeWidth="4" opacity="0.7" />
      <line x1="588" y1="480" x2="330" y2="630" stroke="#d6d3ca" strokeWidth="3" strokeDasharray="18 22" opacity="0.5" />
      <line x1="612" y1="480" x2="870" y2="630" stroke="#d6d3ca" strokeWidth="3" strokeDasharray="18 22" opacity="0.5" />
      {lights(170, 590, 150, 1)}
      {lights(900, 560, 90, 0.6)}
    </Layer>
  );
}

function SamePageMotif() {
  const sheet = (x: number, y: number, tilt: number, note: string) => (
    <div key={note} style={box(x, y, 250, 330, { transform: `rotate(${tilt}deg)` })}>
      <div style={box(0, 8, 250, 330, { borderRadius: 10, background: "rgba(29,34,64,.16)" })} />
      <div style={box(0, 0, 250, 330, { borderRadius: 10, background: "#FFFDF5", overflow: "hidden" })}>
        {[1, 2, 3, 4, 5, 6, 7].map((i) => (
          <div key={i} style={box(0, 40 * i + 14, 250, 3, { background: "#C9DDF7" })} />
        ))}
        <div style={box(50, 0, 3, 330, { background: "#FF6B6B" })} />
      </div>
      <div style={box(120, 60, 92, 92, { borderRadius: 6, background: "#FFE94A", alignItems: "center", justifyContent: "center", transform: "rotate(-6deg)", fontFamily: "Fredoka", fontWeight: 700, fontSize: 62, color: "#1D2240", boxShadow: "0 4px 0 rgba(29,34,64,.18)" })}>
        {note}
      </div>
    </div>
  );
  return (
    <>
      {sheet(-30, 170, -9, "1")}
      {sheet(980, 170, 8, "5")}
    </>
  );
}

function CoCounselMotif() {
  const card = (x: number, tilt: number, strip: string) => (
    <div key={x} style={box(x, 150, 220, 300, { transform: `rotate(${tilt}deg)`, flexDirection: "column", background: "#FFFFFF", borderRadius: 18, border: "4px solid #1C1F3D", overflow: "hidden" })}>
      <div style={{ display: "flex", height: 54, background: strip }}>
        <div style={{ display: "flex", width: 60, height: 40, marginLeft: 20, background: "#FFD23A" }} />
      </div>
      {[180, 140, 160].map((w, i) => (
        <div key={i} style={{ display: "flex", width: w, height: 16, borderRadius: 6, background: "#D7DAE8", marginLeft: 20, marginTop: i ? 18 : 34 }} />
      ))}
    </div>
  );
  return (
    <>
      {card(-20, -9, "#2447D8")}
      {card(1000, 9, "#C8372D")}
      <Layer>
        {/* The lens: two rings meeting on a yellow dot. */}
        <circle cx={572} cy={572} r={34} fill="none" stroke="#FFFFFF" strokeWidth={5} />
        <circle cx={628} cy={572} r={34} fill="none" stroke="#FFFFFF" strokeWidth={5} />
        <circle cx={600} cy={572} r={15} fill="#FFD23A" />
      </Layer>
    </>
  );
}

function RankFileMotif() {
  // A corner of a region board: pastel regions, ink borders, a few pieces (pawns).
  const regions = [0, 0, 1, 1, 0, 2, 2, 1, 3, 3, 2, 4, 3, 4, 4, 4];
  const colors = ["#F6C6B4", "#F9E0A0", "#C5E5B0", "#A9DCE3", "#C6C1F2"];
  const pieces = new Set([1, 7, 8, 14]);
  const cell = 70;
  const pawn = (cx: number, cy: number, s: number, fill: string) => (
    <g key={`${cx}-${cy}`}>
      <circle cx={cx} cy={cy - s * 0.42} r={s * 0.2} fill={fill} />
      <path d={`M${cx - s * 0.16} ${cy - s * 0.24} L${cx + s * 0.16} ${cy - s * 0.24} L${cx + s * 0.26} ${cy + s * 0.22} L${cx + s * 0.36} ${cy + s * 0.22} L${cx + s * 0.36} ${cy + s * 0.38} L${cx - s * 0.36} ${cy + s * 0.38} L${cx - s * 0.36} ${cy + s * 0.22} L${cx - s * 0.26} ${cy + s * 0.22} Z`} fill={fill} />
    </g>
  );
  return (
    <Layer>
      <circle cx={1080} cy={130} r={70} fill="#7FD1A6" />
      <circle cx={980} cy={500} r={46} fill="#F3BCD9" />
      {pawn(1080, 360, 190, "#16261D")}
      <g transform="translate(-40 150) rotate(-8 140 140)">
        <rect x={-6} y={-6} width={cell * 4 + 12} height={cell * 4 + 12} rx={10} fill="#16261D" />
        {regions.map((r, i) => (
          <rect key={i} x={(i % 4) * cell} y={Math.floor(i / 4) * cell} width={cell} height={cell} fill={colors[r]} />
        ))}
        {regions.map((r, i) => {
          const x = (i % 4) * cell;
          const y = Math.floor(i / 4) * cell;
          return (
            <g key={`l${i}`} stroke="#16261D" strokeWidth={5}>
              {i % 4 < 3 && regions[i + 1] !== r ? <line x1={x + cell} y1={y} x2={x + cell} y2={y + cell} /> : null}
              {i < 12 && regions[i + 4] !== r ? <line x1={x} y1={y + cell} x2={x + cell} y2={y + cell} /> : null}
            </g>
          );
        })}
        {[...pieces].map((i) => pawn((i % 4) * cell + cell / 2, Math.floor(i / 4) * cell + cell / 2 + 4, 60, "#16261D"))}
      </g>
    </Layer>
  );
}

function DetourMotif() {
  return (
    <Layer>
      <g strokeLinejoin="round" strokeLinecap="round">
        {/* Made-up countries, the route's end in ink, the way round in green. */}
        <path d="M-20 150 L90 110 L170 160 L150 280 L40 320 L-20 280 Z" fill="#1D2733" stroke="#fff" strokeWidth={5} />
        <path d="M170 160 L260 120 L300 220 L240 330 L150 280 Z" fill="#2E9C5E" stroke="#fff" strokeWidth={5} />
        <path d="M40 320 L150 280 L240 330 L210 450 L60 470 Z" fill="#2E9C5E" stroke="#fff" strokeWidth={5} />
        <path d="M60 470 L210 450 L230 560 L120 640 L-20 600 Z" fill="#9CC9A8" stroke="#fff" strokeWidth={5} />
        <path d="M100 210 C140 230 190 220 230 240 C260 260 220 330 160 390 C130 430 140 500 160 540" fill="none" stroke="#fff" strokeWidth={14} strokeDasharray="0 22" />
        <path d="M100 210 C140 230 190 220 230 240 C260 260 220 330 160 390 C130 430 140 500 160 540" fill="none" stroke="#1D2733" strokeWidth={8} strokeDasharray="0 22" />
        <circle cx={100} cy={210} r={12} fill="#fff" stroke="#1D2733" strokeWidth={5} />
        <path d="M940 120 L1060 80 L1150 140 L1120 260 L990 280 Z" fill="#2E9C5E" stroke="#fff" strokeWidth={5} />
        <path d="M990 280 L1120 260 L1220 330 L1180 460 L1010 450 Z" fill="#1D2733" stroke="#fff" strokeWidth={5} />
        <path d="M1010 450 L1180 460 L1230 600 L1040 650 L960 560 Z" fill="#9CC9A8" stroke="#fff" strokeWidth={5} />
        {/* A closed border. */}
        <path d="M990 280 L1120 260" fill="none" stroke="#D4574B" strokeWidth={10} />
        <path d="M1040 254 L1068 282 M1068 254 L1040 282" fill="none" stroke="#fff" strokeWidth={16} />
        <path d="M1040 254 L1068 282 M1068 254 L1040 282" fill="none" stroke="#D4574B" strokeWidth={8} />
        {/* The road sign. */}
        <rect x={930} y={520} width={220} height={64} rx={12} fill="#176B4B" stroke="#fff" strokeWidth={5} />
        <path d="M965 552 H1110 M1090 534 L1112 552 L1090 570" fill="none" stroke="#fff" strokeWidth={8} />
      </g>
    </Layer>
  );
}

const HUB_THEME: Theme = { background: "#0F7983", title: "#000000", text: "#FFFFFF", pill: "#FFFFFF", pillText: "#000000", font: "fredoka700", titleSize: 132, motif: HubMotif };

/** Each game's card look, by registry slug. A game without one gets a plain card in its registry colors. */
const THEMES: Record<string, Theme> = {
  buzzerquiz: { background: "#16113A", title: "#FFFFFF", text: "#D9D4FF", pill: "#FF4B3E", pillText: "#FFFFFF", font: "bricolage", titleSize: 120, titleStyle: { letterSpacing: -1 }, motif: BuzzerQuizMotif },
  wordscramble: { background: "#F6E2B8", title: "#2A1B12", text: "#5A4636", pill: "#FF7A1A", pillText: "#2A1B12", font: "lilita", titleSize: 128, motif: WordScrambleMotif },
  lasthop: { background: "#1E1733", title: "#FFF6EA", text: "#D5CCF0", pill: "#FF8A4C", pillText: "#1E1733", font: "rubik", titleSize: 128, titleStyle: { letterSpacing: -1 }, motif: LastHopMotif },
  nighthighway: {
    background: "linear-gradient(180deg, #03060f 0%, #0a1633 55%, #25386a 76%)",
    title: "#FFFFFF",
    text: "#CFE0FF",
    pill: "#FFD34D",
    pillText: "#14163A",
    font: "bigShoulders",
    titleSize: 112,
    titleStyle: { textTransform: "uppercase", letterSpacing: 2 },
    motif: NightHighwayMotif,
  },
  ftw: { background: "#B9A7FF", title: "#1D2240", text: "#2E3360", pill: "#FF8FC7", pillText: "#1D2240", font: "bagel", titleSize: 120, motif: SamePageMotif },
  cocounsel: { background: "linear-gradient(90deg, #2447D8 50%, #C8372D 50%)", title: "#FFFFFF", text: "#FFFFFF", pill: "#FFD23A", pillText: "#1C1F3D", font: "archivo", titleSize: 104, titleStyle: { letterSpacing: -2 }, motif: CoCounselMotif },
  regions: { background: "#F3EBDD", title: "#16261D", text: "#4B5A50", pill: "#7FD1A6", pillText: "#16261D", font: "fraunces", titleSize: 120, titleStyle: { letterSpacing: -1 }, motif: RankFileMotif },
  borderrun: { background: "#E4EEF0", title: "#1D2733", text: "#3F4B5A", pill: "#F5C04A", pillText: "#1D2733", font: "overpass", titleSize: 132, motif: DetourMotif },
};

function themeOf(slug: string | undefined): Theme {
  if (!slug) return HUB_THEME;
  const theme = THEMES[slug];
  if (theme) return theme;
  const game = gameBySlug(slug);
  return { background: "#FFFFFF", title: game?.ink ?? "#000000", text: game?.textSecondary ?? "#333333", pill: game?.accentColor ?? "#0F7983", pillText: game?.ink ?? "#000000", font: "fredoka700", titleSize: 120, motif: () => null };
}

/** Fredoka has no narrow no-break space (French "?", "!"): a plain no-break one stands in. */
const typeset = (text: string) => text.replace(/ /g, " ");

/** The card, as satori elements. */
function Card({ preview, theme }: { preview: Preview; theme: Theme }) {
  const hub = preview.kind === "hub";
  return (
    <div style={{ width: CARD_SIZE.width, height: CARD_SIZE.height, display: "flex", position: "relative", alignItems: "center", justifyContent: "center", background: theme.background, fontFamily: "Fredoka", overflow: "hidden" }}>
      {/* The motif, in its own full-card layer: satori places absolute children of a fragment in the flow. */}
      <div style={box(0, 0, CARD_SIZE.width, CARD_SIZE.height)}>{theme.motif()}</div>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", width: 660, paddingBottom: preview.slug === "lasthop" || preview.slug === "nighthighway" ? 90 : 0 }}>
        {hub ? null : (
          <div style={{ display: "flex", background: "#FFFFFF", color: "#000000", fontWeight: 700, fontSize: 38, lineHeight: 1, padding: "12px 24px", borderRadius: 12, transform: "rotate(-2deg)", boxShadow: "0 4px 10px rgba(0,0,0,.28)" }}>{APP_TITLE}</div>
        )}
        {preview.badge ? (
          <div style={{ display: "flex", marginTop: 30, background: theme.pill, color: theme.pillText, fontWeight: 700, fontSize: 32, lineHeight: 1, padding: "12px 26px", borderRadius: 40 }}>{typeset(preview.badge)}</div>
        ) : null}
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            textAlign: "center",
            marginTop: hub ? 0 : 22,
            fontFamily: FONTS[theme.font].name,
            fontWeight: FONTS[theme.font].weight,
            fontSize: theme.titleSize,
            lineHeight: 1,
            color: theme.title,
            ...(hub ? { background: "#FFFFFF", padding: "22px 44px", borderRadius: 28, transform: "rotate(-2deg)", boxShadow: "0 8px 20px rgba(0,0,0,.3)" } : {}),
            ...theme.titleStyle,
          }}
        >
          {hub ? APP_TITLE : (gameBySlug(preview.slug ?? "")?.title ?? preview.title)}
        </div>
        <div style={{ display: "flex", justifyContent: "center", textAlign: "center", marginTop: hub ? 44 : 26, fontWeight: 600, fontSize: hub ? 44 : 40, lineHeight: 1.2, color: theme.text, textWrap: "balance" }}>{typeset(preview.tagline)}</div>
      </div>
    </div>
  );
}

/** The card image of `route` (English route) in `lang`, as an ImageResponse (a PNG response). */
export async function renderCard(route: string, lang: Lang): Promise<ImageResponse> {
  const preview = previewFor(route, lang);
  const theme = themeOf(preview.slug);
  const keys = [...new Set<FontKey>(["fredoka600", "fredoka700", theme.font])];
  const fonts = await Promise.all(keys.map(async (key) => ({ name: FONTS[key].name, weight: FONTS[key].weight, style: "normal" as const, data: await fontData(key) })));
  return new ImageResponse(<Card preview={preview} theme={theme} />, { ...CARD_SIZE, fonts });
}
