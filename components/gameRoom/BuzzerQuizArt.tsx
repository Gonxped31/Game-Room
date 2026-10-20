/**
 * Buzzer Quiz's hub-card art, drawn in code like the other games' (no image
 * files): the dark stage under a spotlight, the red buzzer in the middle, and
 * the four answer letters A-D in the player colors, slightly tilted
 * (references/buzzer-quiz/buzzer-quiz-visual-spec.md, "In the Game Room").
 */
const BADGES = [
  { letter: "A", color: "#FFC23D", x: 52, y: 96, tilt: -10 },
  { letter: "B", color: "#46E0A0", x: 104, y: 76, tilt: 6 },
  { letter: "C", color: "#59A8FF", x: 236, y: 76, tilt: -6 },
  { letter: "D", color: "#FF7AC0", x: 288, y: 96, tilt: 10 },
];

export default function BuzzerQuizArt() {
  return (
    <svg aria-hidden="true" className="block h-full w-full" viewBox="0 0 340 200" preserveAspectRatio="xMidYMid slice">
      <defs>
        <radialGradient id="bq-art-spot" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#31297A" />
          <stop offset="1" stopColor="#251E5C" />
        </radialGradient>
      </defs>
      <rect width="340" height="200" fill="#16113A" />
      <circle cx="170" cy="104" r="96" fill="url(#bq-art-spot)" />
      {BADGES.map((b) => (
        <g key={b.letter} transform={`translate(${b.x} ${b.y}) rotate(${b.tilt})`}>
          <circle r="19" fill={b.color} />
          <text y="7.5" textAnchor="middle" fontFamily="var(--font-bricolage), sans-serif" fontWeight="800" fontSize="21" fill="#16113A">
            {b.letter}
          </text>
        </g>
      ))}
      {/* The buzzer, kept in the middle band so the phone card's shorter panel shows all of it. */}
      <circle cx="170" cy="104" r="52" fill="rgba(255,75,62,.16)" />
      <circle cx="170" cy="111" r="44" fill="#5C0F0B" />
      <circle cx="170" cy="104" r="44" fill="#9E1B14" />
      <circle cx="170" cy="104" r="36" fill="#FF4B3E" />
      <text x="170" y="113" textAnchor="middle" fontFamily="var(--font-bricolage), sans-serif" fontWeight="800" fontSize="24" fill="#FFFFFF">
        BUZZ
      </text>
    </svg>
  );
}
