"use client";

import type { ButtonHTMLAttributes, ReactNode } from "react";
import HowToPlay, { type HowToPlayLook } from "@/components/HowToPlay";
import { MAX_SIZE, MIN_SIZE, type Piece } from "@/lib/games/regions/constants";
import { COUNTDOWN_MS, DNF_EXTRA_MS, MAX_ROUNDS, PLAYERS, RESULTS_MS, ROUND_COUNTS } from "@/lib/games/race/race";
import { ROUND_MS } from "@/lib/games/regions/race";
import { GLYPH, PIECE_NAME } from "@/lib/games/regions/theme";
import { texts } from "@/lib/i18n/text";
import { useLang } from "@/lib/i18n/useLang";

/** "Got it": the game's green primary button, full width. */
function DoneButton({ className = "", ...rest }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return <button type="button" className={`cg-button cg-button-primary w-full ${className}`} {...rest} />;
}

const FOCUS = "focus-visible:outline-[3px] focus-visible:outline-offset-2 focus-visible:outline-[var(--cg-ink)]";

/**
 * Rank & File's look for the shared dialog: the cream card, Fraunces
 * headings, the mint Got it. Its classes are Tailwind utilities, which the
 * offline download doesn't compile: so How to play is only ever placed by
 * the site's pages (Stage's `rules`, the race shell), never inside the
 * exported Stage itself.
 */
const LOOK: HowToPlayLook = {
  iconClassName: `${FOCUS} ml-auto flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-xl border-2 border-[var(--cg-ink)] bg-[var(--cg-card)] text-[20px] font-bold text-[var(--cg-ink)] shadow-[0_3px_0_var(--cg-ink)]`,
  linkClassName: `${FOCUS} cursor-pointer self-start border-0 bg-transparent p-0 text-[15px] font-bold text-[var(--cg-ink)] underline`,
  panelClassName: "bg-[var(--cg-card)] text-[var(--cg-ink)] font-[family-name:var(--font-dm-sans)]",
  headerClassName: "border-b-2 border-[var(--cg-paper)]",
  titleClassName: "font-[family-name:var(--font-fraunces)] text-[24px] font-extrabold",
  closeClassName: `${FOCUS} flex h-9 w-9 cursor-pointer items-center justify-center rounded-xl border-2 border-[var(--cg-ink)] bg-[var(--cg-card)] text-[20px] text-[var(--cg-ink)]`,
  DoneButton,
};

const seconds = (ms: number) => ms / 1000;

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="grid gap-2">
      <h3 className="m-0 font-[family-name:var(--font-fraunces)] text-[19px] font-extrabold">{title}</h3>
      {children}
    </section>
  );
}

const P = "m-0 text-[15px] leading-snug text-[var(--cg-ink-soft)] [&_b]:text-[var(--cg-ink)]";
const LIST = `${P} grid gap-1.5 pl-5 [&:is(ol)]:list-decimal [&:is(ul)]:list-disc`;

/** The squares a piece in the middle of a 5×5 board attacks, besides its row and column (which every puzzle rules out anyway). */
function attacked(piece: Piece, r: number, c: number): boolean {
  const dr = Math.abs(r - 2);
  const dc = Math.abs(c - 2);
  if (dr === 0 && dc === 0) return false;
  if (piece === "king") return dr <= 1 && dc <= 1;
  if (piece === "knight") return (dr === 1 && dc === 2) || (dr === 2 && dc === 1);
  if (piece === "bishop" || piece === "queen") return dr === dc;
  return false;
}

/** A 5×5 board: the piece in the middle, its row and column shaded, and a dot on every other square it attacks. */
function PieceBoard({ piece, label }: { piece: Piece; label: string }) {
  const cell = 18;
  return (
    <figure className="m-0 grid justify-items-center gap-1">
      <svg aria-hidden="true" viewBox={`0 0 ${cell * 5} ${cell * 5}`} className="h-[90px] w-[90px]">
        {Array.from({ length: 25 }, (_, i) => {
          const r = Math.floor(i / 5);
          const c = i % 5;
          const line = r === 2 || c === 2;
          return (
            <g key={i}>
              <rect x={c * cell} y={r * cell} width={cell} height={cell} fill={line ? "#d9ecdf" : (r + c) % 2 ? "#f3ebdd" : "#fffaf0"} stroke="#d8ccb6" strokeWidth={0.6} />
              {attacked(piece, r, c) ? <circle cx={c * cell + cell / 2} cy={r * cell + cell / 2} r={3.6} fill="#c62828" /> : null}
            </g>
          );
        })}
        <text x={2.5 * cell} y={2.5 * cell + 6} textAnchor="middle" fontSize={16} fill="#16261d">
          {GLYPH[piece]}
        </text>
      </svg>
      <figcaption className="text-[13px] font-bold">{label}</figcaption>
    </figure>
  );
}

interface RulesText {
  goal: string;
  goalBody: ReactNode;
  ways: string;
  waysItems: ReactNode[];
  placing: string;
  placingItems: ReactNode[];
  pieces: string;
  piecesItems: ReactNode[];
  racing: string;
  racingItems: ReactNode[];
  time: string;
  timeItems: ReactNode[];
  tips: string;
  tipsItems: string[];
}

const SIZES = `${MIN_SIZE}×${MIN_SIZE}`;
const MAX = `${MAX_SIZE}×${MAX_SIZE}`;

/** How to play's words, in both languages (piece names from theme.ts's PIECE_NAME). */
const RULES = texts<RulesText>({
  en: {
    goal: "The goal",
    goalBody: (
      <>
        <b>Place one piece in every row, every column and every colour</b>, so that no piece attacks another by its chess moves. Fill the board without a clash and
        it&apos;s solved.
      </>
    ),
    ways: "Ways to play",
    waysItems: [
      <>
        <b>Daily puzzle</b>: the same grid for everyone today, one try, your time on the day&apos;s leaderboard. A new one at midnight (Toronto time).
      </>,
      <>
        <b>Endless</b>: pick a piece and a size ({SIZES} to {MAX}), then Start. Your best time for each is kept on this device.
      </>,
      <>
        <b>With others</b> (from the hub): everyone gets the same puzzles at the same time, in Challenge or Survival (below).
      </>,
    ],
    placing: "Placing pieces",
    placingItems: [
      <>
        <b>Tap a square</b> once for a ✕ (your note: no piece here), twice for a piece, a third time to clear it.
      </>,
      "Drag from an empty square to put a ✕ on every square you cross. On a keyboard: the arrows move, Enter or Space taps.",
      "Pieces that clash turn red. Undo takes back your last tap, Clear empties the board.",
      <>
        <b>Auto ✕</b> shows a faint ✕ for a few seconds on every square your pieces already rule out. Then it rests for 30 seconds.
      </>,
    ],
    pieces: "The pieces",
    piecesItems: [
      "Every piece already rules out its row and column (shaded). The dots are what it adds.",
      <>
        <b>{GLYPH.rook} Rook</b>: nothing more, the easy level. <b>{GLYPH.king} King</b>: no two touching, not even at a corner. <b>{GLYPH.knight} Knight</b>: no
        two a knight&apos;s move apart. <b>{GLYPH.queen} Queen</b>: no two on the same diagonal, however far.
      </>,
      <>
        <b>✦ Mix</b>: each colour shows its own piece (rook, king, knight or {GLYPH.bishop} bishop). The piece you place there must not attack another, nor be
        attacked.
      </>,
    ],
    racing: "Racing others",
    racingItems: [
      <>
        <b>Challenge</b>, {PLAYERS.challenge.min} to {PLAYERS.challenge.max} players: {ROUND_COUNTS.join(" or ")} puzzles, and the lowest total time wins. An unfinished
        puzzle counts as the slowest finish plus {seconds(DNF_EXTRA_MS)} s.
      </>,
      <>
        <b>Survival</b>, {PLAYERS.survival.min} to {PLAYERS.survival.max} players: after each puzzle the slowest are out (two while more than 4 are left, then one),
        until one is left. At most {MAX_ROUNDS} puzzles.
      </>,
      `The host picks the mode and the pieces: one kind all game, or a new one each puzzle. The grid grows as you go, up to ${MAX}. Matchmaking starts by itself.`,
      "While you play, you see how many pieces the others have placed, never where.",
    ],
    time: "Time",
    timeItems: [
      "Solo: the clock runs from Start until you solve it.",
      `Races: a ${seconds(COUNTDOWN_MS)}-second countdown, then ${seconds(ROUND_MS) / 60} minutes per puzzle, and ${seconds(RESULTS_MS)} seconds of results in between.`,
    ],
    tips: "Tips",
    tipsItems: [
      "Start with the smallest colour: it has the fewest places to go.",
      "Placed a piece? ✕ its row, column and colour, and every square it attacks.",
      "If two colours fit only in the same two rows, no other colour can use those rows.",
    ],
  },
  fr: {
    goal: "Le but",
    goalBody: (
      <>
        <b>Place une pièce dans chaque ligne, chaque colonne et chaque couleur</b>, sans qu&apos;aucune pièce n&apos;en attaque une autre selon ses déplacements aux
        échecs. Remplis la grille sans aucun conflit, et c&apos;est résolu.
      </>
    ),
    ways: "Façons de jouer",
    waysItems: [
      <>
        <b>Défi du jour</b>{"\u00a0"}: la même grille pour tout le monde aujourd&apos;hui, un seul essai, et ton temps au classement du jour. Un nouveau à minuit
        (heure de Toronto).
      </>,
      <>
        <b>Infini</b>{"\u00a0"}: choisis une pièce et une taille (de {SIZES} à {MAX}), puis appuie sur Commencer. Ton record pour chaque combinaison reste sur cet
        appareil.
      </>,
      <>
        <b>À plusieurs</b> (depuis l&apos;accueil){"\u00a0"}: tout le monde reçoit les mêmes grilles au même moment, en Défi ou en Survie (plus bas).
      </>,
    ],
    placing: "Placer les pièces",
    placingItems: [
      <>
        <b>Touche une case</b> une fois pour un ✕ (ta note{"\u00a0"}: pas de pièce ici), deux fois pour une pièce, une troisième fois pour la vider.
      </>,
      "Glisse depuis une case vide pour mettre un ✕ sur chaque case traversée. Au clavier\u00a0: les flèches pour te déplacer, Entrée ou Espace pour toucher.",
      "Les pièces en conflit passent au rouge. Annuler reprend ton dernier coup, Effacer vide la grille.",
      <>
        <b>Auto ✕</b> montre pendant quelques secondes un ✕ pâle sur chaque case que tes pièces excluent déjà. Ensuite, il se repose 30 secondes.
      </>,
    ],
    pieces: "Les pièces",
    piecesItems: [
      "Chaque pièce exclut déjà sa ligne et sa colonne (teintées). Les points montrent ce qu'elle ajoute.",
      <>
        <b>{GLYPH.rook} Tour</b>{"\u00a0"}: rien de plus, le niveau facile. <b>{GLYPH.king} Roi</b>{"\u00a0"}: jamais deux qui se touchent, même par un coin.{" "}
        <b>{GLYPH.knight} Cavalier</b>{"\u00a0"}: jamais deux à un saut de cavalier l&apos;un de l&apos;autre. <b>{GLYPH.queen} Dame</b>{"\u00a0"}: jamais deux sur la
        même diagonale, même de loin.
      </>,
      <>
        <b>✦ Mélange</b>{"\u00a0"}: chaque couleur montre sa propre pièce (tour, roi, cavalier ou {GLYPH.bishop} fou). La pièce que tu y places ne doit en attaquer
        aucune autre, ni être attaquée.
      </>,
    ],
    racing: "Course à plusieurs",
    racingItems: [
      <>
        <b>Défi</b>, de {PLAYERS.challenge.min} à {PLAYERS.challenge.max} joueurs{"\u00a0"}: {ROUND_COUNTS.join(" ou ")} grilles, et le plus petit temps total gagne. Une
        grille pas finie compte comme le temps le plus lent, plus {seconds(DNF_EXTRA_MS)}{"\u00a0"}s.
      </>,
      <>
        <b>Survie</b>, de {PLAYERS.survival.min} à {PLAYERS.survival.max} joueurs{"\u00a0"}: après chaque grille, les plus lents sont éliminés (deux tant qu&apos;il en
        reste plus de 4, puis un), jusqu&apos;à ce qu&apos;il n&apos;en reste qu&apos;un. {MAX_ROUNDS} grilles au plus.
      </>,
      `L'hôte choisit le mode et les pièces\u00a0: une seule sorte toute la partie, ou une nouvelle à chaque grille. La grille grandit au fil de la partie, jusqu'à ${MAX}. En partie rapide, la course démarre toute seule.`,
      "Pendant la partie, tu vois combien de pièces les autres ont posées, jamais où.",
    ],
    time: "Le chrono",
    timeItems: [
      "Solo\u00a0: le chrono tourne du moment où tu appuies sur Commencer jusqu'à ce que la grille soit résolue.",
      `Courses\u00a0: un compte à rebours de ${seconds(COUNTDOWN_MS)}\u00a0secondes, puis ${seconds(ROUND_MS) / 60}\u00a0minutes par grille, et ${seconds(RESULTS_MS)}\u00a0secondes de résultats entre deux.`,
    ],
    tips: "Astuces",
    tipsItems: [
      "Commence par la plus petite couleur\u00a0: c'est elle qui a le moins de places possibles.",
      "Une pièce posée\u202f? Mets un ✕ sur sa ligne, sa colonne, sa couleur et chaque case qu'elle attaque.",
      "Si deux couleurs ne tiennent que dans les deux mêmes lignes, aucune autre couleur ne peut utiliser ces lignes.",
    ],
  },
});

function Items({ items }: { items: ReactNode[] }) {
  return (
    <ul className={LIST}>
      {items.map((item, i) => (
        <li key={i}>{item}</li>
      ))}
    </ul>
  );
}

function RulesContent() {
  const lang = useLang();
  const t = RULES[lang];
  const name = PIECE_NAME[lang];
  return (
    <div className="grid gap-5">
      <Section title={t.goal}>
        <p className={P}>{t.goalBody}</p>
      </Section>

      <Section title={t.ways}>
        <Items items={t.waysItems} />
      </Section>

      <Section title={t.placing}>
        <Items items={t.placingItems} />
      </Section>

      <Section title={t.pieces}>
        <div className="grid grid-cols-2 gap-3 rounded-xl bg-[var(--cg-paper)] p-3 min-[520px]:grid-cols-4">
          <PieceBoard piece="king" label={name.king} />
          <PieceBoard piece="knight" label={name.knight} />
          <PieceBoard piece="queen" label={name.queen} />
          <PieceBoard piece="bishop" label={name.bishop} />
        </div>
        <Items items={t.piecesItems} />
      </Section>

      <Section title={t.racing}>
        <Items items={t.racingItems} />
      </Section>

      <Section title={t.time}>
        <Items items={t.timeItems} />
      </Section>

      <Section title={t.tips}>
        <Items items={t.tipsItems} />
      </Section>
    </div>
  );
}

/**
 * Rank & File's How to play (docs/how-to-play.md, on the shared
 * components/HowToPlay.tsx): `variant` "icon" is the ? at the right of the
 * header (solo page and race rooms), "link" the race lobby's "How to play".
 */
export default function RulesButton({ variant = "icon" }: { variant?: "icon" | "link" }) {
  return (
    <HowToPlay look={LOOK} variant={variant}>
      <RulesContent />
    </HowToPlay>
  );
}
