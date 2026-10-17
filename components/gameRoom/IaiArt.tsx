/**
 * Iaï's hub-card art, drawn in code like the other games' (no image files):
 * ink on rice paper - a red sun, layered blue mountains, swaying pampas grass,
 * a lone samurai silhouette mid-draw, and the 居合 seal. Scales with `slice`,
 * so the same drawing crops right at both panel heights.
 */
export default function IaiArt() {
  return (
    <svg aria-hidden="true" className="block h-full w-full" viewBox="0 0 340 200" preserveAspectRatio="xMidYMid slice">
      <defs>
        <linearGradient id="iai-art-paper" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#efe6d0" />
          <stop offset="1" stopColor="#e2d7bd" />
        </linearGradient>
        <radialGradient id="iai-art-sun">
          <stop offset="0" stopColor="#c42a33" />
          <stop offset="0.85" stopColor="#b21e26" />
          <stop offset="1" stopColor="#b21e26" stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect width="340" height="200" fill="url(#iai-art-paper)" />
      <circle cx="236" cy="66" r="34" fill="url(#iai-art-sun)" />
      {/* Mountains, far to near. */}
      <path d="M0 132 L48 96 L86 118 L134 78 L178 112 L224 88 L268 116 L306 94 L340 110 V200 H0Z" fill="#3a4d97" opacity="0.22" />
      <path d="M0 150 L36 128 L80 140 L120 116 L168 142 L214 124 L262 146 L304 128 L340 140 V200 H0Z" fill="#2a3b7c" opacity="0.35" />
      {/* Ground. */}
      <path d="M0 168 Q170 158 340 168 V200 H0Z" fill="#1d2550" opacity="0.55" />
      {/* Pampas grass. */}
      {[18, 30, 44, 290, 304, 318, 330].map((x, i) => (
        <path key={x} d={`M${x} 200 Q${x - 4} ${176 - (i % 3) * 6} ${x + 8} ${150 - (i % 3) * 8}`} stroke="#14183a" strokeWidth="1.6" fill="none" opacity="0.7" />
      ))}
      {/* The samurai, mid-draw: a lean ink silhouette. */}
      <g transform="translate(150 168)" fill="#0c0d1c">
        <path d="M-14 0 L-6 -38 L-18 -44 L-10 -78 L4 -86 L14 -78 L16 -46 L8 -40 L18 0 L10 0 L4 -30 L-2 -30 L-6 0Z" />
        {/* Kabuto helmet with its crescent crest. */}
        <path d="M-6 -86 Q4 -100 14 -86 Z" />
        <path d="M-12 -98 Q4 -88 20 -98" stroke="#c9a24f" strokeWidth="2" fill="none" />
        {/* The blade, leaving the scabbard. */}
        <path d="M12 -66 L78 -92" stroke="#0c0d1c" strokeWidth="3" strokeLinecap="round" />
        <path d="M14 -67 L76 -91" stroke="#e8eefc" strokeWidth="1" strokeLinecap="round" />
      </g>
      {/* An ink slash across the scene. */}
      <path d="M96 128 Q170 96 250 112" stroke="#0c0d1c" strokeWidth="3" fill="none" opacity="0.5" strokeLinecap="round" />
      {/* The seal. */}
      <g transform="translate(300 28) rotate(4)">
        <rect x="-15" y="-18" width="30" height="36" rx="3" fill="#b21e26" />
        <text x="0" y="-2" textAnchor="middle" fontSize="12" fill="#fff6ea" fontFamily="serif">居</text>
        <text x="0" y="12" textAnchor="middle" fontSize="12" fill="#fff6ea" fontFamily="serif">合</text>
      </g>
    </svg>
  );
}
