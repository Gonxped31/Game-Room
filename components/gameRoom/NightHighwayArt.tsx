/** Two taillights, with their glow and their reflection streaking down the wet road. */
function Taillights({ x, y, w, opacity = 1 }: { x: number; y: number; w: number; opacity?: number }) {
  const lamp = w * 0.22;
  return (
    <g opacity={opacity}>
      {[x, x + w - lamp].map((lx) => (
        <g key={lx}>
          <rect x={lx - lamp * 0.6} y={y + lamp * 0.2} width={lamp * 2.2} height={w * 0.9} fill="url(#nh-art-streak)" />
          <circle cx={lx + lamp / 2} cy={y + lamp * 0.2} r={lamp * 1.8} fill="url(#nh-art-glow)" />
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
 * Night Highway's hub-card art, drawn in code like the other games' (no
 * image files): the midnight freeway from behind the wheel - skyline,
 * lane lines running to the horizon, and two cars' taillights glowing on the
 * wet asphalt, the far pair fainter like the race's ghost car. Scales with
 * `slice`, so the same drawing crops right at both panel heights.
 */
export default function NightHighwayArt() {
  return (
    <svg aria-hidden="true" className="block h-full w-full" viewBox="0 0 340 200" preserveAspectRatio="xMidYMid slice">
      <defs>
        <linearGradient id="nh-art-sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#03060f" />
          <stop offset="0.45" stopColor="#0a1633" />
          <stop offset="0.56" stopColor="#25386a" />
        </linearGradient>
        <linearGradient id="nh-art-road" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#1b2135" />
          <stop offset="1" stopColor="#0d0f15" />
        </linearGradient>
        <radialGradient id="nh-art-glow">
          <stop offset="0" stopColor="#ff2b45" stopOpacity="0.75" />
          <stop offset="1" stopColor="#ff2b45" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="nh-art-streak" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ff2b45" stopOpacity="0.5" />
          <stop offset="1" stopColor="#ff2b45" stopOpacity="0" />
        </linearGradient>
      </defs>
      <rect width="340" height="200" fill="url(#nh-art-sky)" />
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
      <polygon points="152,112 188,112 352,200 -12,200" fill="url(#nh-art-road)" />
      <line x1="153" y1="112" x2="-6" y2="200" stroke="#cfae45" strokeWidth="1.6" opacity="0.8" />
      <line x1="187" y1="112" x2="346" y2="200" stroke="#dcd9cf" strokeWidth="1.6" opacity="0.7" />
      {[161, 170, 179].map((top, i) => (
        <line key={top} x1={top} y1="112" x2={[78, 170, 262][i]} y2="200" stroke="#d6d3ca" strokeWidth="1.4" strokeDasharray="7 9" opacity="0.5" />
      ))}
      {/* The far car (the ghost), then the near one. */}
      <Taillights x={182} y={128} w={14} opacity={0.6} />
      <Taillights x={108} y={160} w={34} />
    </svg>
  );
}
