/**
 * Word Scramble's hub-card art, drawn in code like the other games' (no image
 * files): five wood tiles "R E G T I", alternately tilted, over five answer
 * slots, the first holding an orange "T"
 * (references/scramble/word-scramble-visual-spec.md, "In the Game Room").
 * Everything sits in the middle band, so the phone card's shorter panel shows
 * all of it.
 */
const LETTERS = ["R", "E", "G", "T", "I"];
const SIZE = 38;
const GAP = 10;
const LEFT = (340 - (LETTERS.length * SIZE + (LETTERS.length - 1) * GAP)) / 2;

export default function WordScrambleArt() {
  return (
    <svg aria-hidden="true" className="block h-full w-full" viewBox="0 0 340 200" preserveAspectRatio="xMidYMid slice">
      <rect width="340" height="200" fill="#F6E2B8" />
      {LETTERS.map((letter, i) => {
        const x = LEFT + i * (SIZE + GAP);
        return (
          <g key={letter} transform={`rotate(${i % 2 ? 5 : -5} ${x + SIZE / 2} ${70})`}>
            <rect x={x} y={51 + 5} width={SIZE} height={SIZE} rx="8" fill="#B98535" />
            <rect x={x} y={51} width={SIZE} height={SIZE} rx="8" fill="#F2CF8D" />
            <text x={x + SIZE / 2} y={51 + 28} textAnchor="middle" fontFamily="var(--font-lilita), sans-serif" fontSize="24" fill="#2A1B12">
              {letter}
            </text>
          </g>
        );
      })}
      {LETTERS.map((_, i) => {
        const x = LEFT + i * (SIZE + GAP);
        if (i === 0) {
          return (
            <g key={i}>
              <rect x={x} y={109 + 5} width={SIZE} height={SIZE} rx="8" fill="#A8480A" />
              <rect x={x} y={109} width={SIZE} height={SIZE} rx="8" fill="#FF7A1A" />
              <text x={x + SIZE / 2} y={109 + 28} textAnchor="middle" fontFamily="var(--font-lilita), sans-serif" fontSize="24" fill="#2A1B12">
                T
              </text>
            </g>
          );
        }
        return <rect key={i} x={x + 1.5} y={110.5} width={SIZE - 3} height={SIZE - 3} rx="8" fill="none" stroke="#C9A26B" strokeWidth="3" strokeDasharray="6 5" />;
      })}
    </svg>
  );
}
