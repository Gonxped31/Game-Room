"use client";

import type { ReactNode } from "react";
import HowToPlay, { type HowToPlayLook } from "@/components/HowToPlay";
import { ITEMS_PER_ROUND } from "@/lib/games/ftw/constants";
import { matchCount } from "@/lib/games/ftw/scoring";
import { useText } from "@/lib/i18n/useLang";
import { plural, texts } from "@/lib/i18n/text";
import { CheckIcon, DISPLAY, FOCUS, PrimaryButton, StickyNote, TEXT } from "./ui";

/** Same Page's look for the shared dialog: notebook paper, Bagel Fat One headings, the ink Got it. */
const LOOK: HowToPlayLook = {
  iconClassName: `${TEXT} ${FOCUS} flex h-[34px] w-[34px] shrink-0 cursor-pointer items-center justify-center rounded-full border-2 border-[var(--ink)] bg-white text-[17px] font-bold text-[var(--ink)]`,
  linkClassName: `${TEXT} ${FOCUS} cursor-pointer self-center border-0 bg-transparent p-0 text-[15px] font-bold text-[var(--ink)] underline`,
  panelClassName: `${TEXT} bg-[var(--paper)] text-[var(--ink)]`,
  headerClassName: "border-b-2 border-[var(--rule)]",
  titleClassName: `${DISPLAY} text-[24px]`,
  closeClassName: `${FOCUS} flex h-9 w-9 cursor-pointer items-center justify-center rounded-full border-2 border-[var(--ink)] bg-white text-[20px] text-[var(--ink)]`,
  DoneButton: PrimaryButton,
};

const N = ITEMS_PER_ROUND;

/**
 * The rules' words (docs/i18n.md). French names the roles by what they do
 * ("la personne qui classe / qui devine"), so nobody is gendered, and quotes
 * the buttons exactly as RoundBoard shows them (components/ftw/text.ts).
 */
const RULES = texts<{
  /** The worked example's five items. */
  items: string[];
  ranker: string;
  guesser: string;
  examplePoints: (score: number) => string;
  goal: string;
  goalText: ReactNode;
  players: string;
  playersList: ReactNode[];
  aRound: string;
  roundSteps: ReactNode[];
  roundHow: string;
  scoring: string;
  scoringList: ReactNode[];
  time: string;
  timeText: ReactNode;
  prompts: string;
  promptsList: ReactNode[];
  tips: string;
  tipsList: string[];
}>({
  en: {
    items: ["Pizza", "Tacos", "Sushi", "Curry", "Salad"],
    ranker: "Ranker",
    guesser: "Guesser",
    examplePoints: (score) => `${score} points for the guesser`,
    goal: "The goal",
    goalText: (
      <>
        <b>Read your partner&apos;s mind.</b> One of you ranks {N} things from best to worst; the other guesses that order. The closer the guess, the more points.
      </>
    ),
    players: "Players",
    playersList: [
      "Two players, each on their own phone or computer. Share the room link with your partner.",
      <>
        Each round, one of you is the <b>ranker</b> and the other the <b>guesser</b>. You swap every round.
      </>,
    ],
    aRound: "A round",
    roundSteps: [
      <>A prompt and {N} items appear, like &ldquo;Best pizza toppings&rdquo;.</>,
      <>
        <b>The ranker</b> puts a sticky note on each item, 1 (best) to {N} (worst), then taps <b>Lock my ranking</b>. The guesser can&apos;t see it.
      </>,
      <>
        <b>The guesser</b> does the same, trying to match the ranker, then taps <b>Lock my guess</b>.
      </>,
      "Both orders are revealed side by side, and the round is scored. Then tap Next round.",
    ],
    roundHow: "Tap a note, then an item (or drag it). Tap a placed note to take it back, or to swap it with another.",
    scoring: "Scoring",
    scoringList: [
      <>
        <b>The guesser scores a point for every item with the same note as the ranker&apos;s</b>: 0 to {N}.
      </>,
      `You can't score ${N - 1}: with ${N - 1} notes matching, the last one matches too.`,
      "Points add up across rounds, and you take turns guessing, so it stays even. Play as many rounds as you like.",
    ],
    time: "Time",
    timeText: (
      <>
        <b>No clock.</b> Play live, or take your turn whenever you like: the room keeps your place, and your partner sees when you&apos;ve locked in.
      </>
    ),
    prompts: "Prompts",
    promptsList: [
      <>
        <b>The ranker picks the topics</b> the prompts come from (any topic by default).
      </>,
      "The ranker also picks the prompts' language: English or French.",
      <>
        Before ranking, the ranker can <b>Shuffle prompt</b> for another one, or write their own prompt and {N} items.
      </>,
      "A prompt doesn't come back until you've seen every one in your topics.",
    ],
    tips: "Tips",
    tipsList: [
      "Ranking: be yourself. A ranking your partner can predict scores more than a clever one.",
      "Guessing: think about what your partner loves, not what you'd pick.",
      `The ends are easiest: nail the 1 and the ${N} first.`,
    ],
  },
  fr: {
    items: ["Pizza", "Tacos", "Sushis", "Curry", "Salade"],
    ranker: "Classe",
    guesser: "Devine",
    examplePoints: (score) => plural("fr", score, `${score} point pour qui devine`, `${score} points pour qui devine`),
    goal: "Le but",
    goalText: (
      <>
        <b>Lis dans les pensées de l&apos;autre.</b> Une personne classe {N} choses, de la meilleure à la pire&#8239;; l&apos;autre devine cet ordre. Plus on vise juste, plus on
        marque de points.
      </>
    ),
    players: "Joueurs",
    playersList: [
      "On joue à deux, chaque personne sur son téléphone ou son ordinateur. Partage le lien du salon avec l'autre.",
      <>
        À chaque manche, une personne <b>classe</b> et l&apos;autre <b>devine</b>. Vous échangez les rôles à chaque manche.
      </>,
    ],
    aRound: "Une manche",
    roundSteps: [
      <>Un sujet et {N} éléments apparaissent, comme «&nbsp;Meilleures garnitures de pizza&nbsp;».</>,
      <>
        <b>La personne qui classe</b> colle une note sur chaque élément, de 1 (le meilleur) à {N} (le pire), puis touche <b>Valider mon classement</b>. L&apos;autre ne voit
        rien.
      </>,
      <>
        <b>La personne qui devine</b> fait pareil en essayant de retrouver le même ordre, puis touche <b>Valider ma réponse</b>.
      </>,
      "Les deux ordres s'affichent côte à côte, et on compte les points. Touche ensuite Manche suivante.",
    ],
    roundHow: "Touche une note, puis un élément (ou fais-la glisser). Touche une note posée pour la reprendre, ou pour l'échanger avec une autre.",
    scoring: "Les points",
    scoringList: [
      <>
        <b>La personne qui devine marque un point pour chaque élément qui a la même note que dans le classement</b>&nbsp;: de 0 à {N}.
      </>,
      `Impossible de marquer ${N - 1} : si ${N - 1} notes correspondent, la dernière aussi.`,
      "Les points s'additionnent d'une manche à l'autre, et vous devinez à tour de rôle, donc c'est équitable. Jouez autant de manches que vous voulez.",
    ],
    time: "Le temps",
    timeText: (
      <>
        <b>Pas de chrono.</b> Jouez en direct, ou prends ton tour quand ça te va&nbsp;: le salon garde ta place, et l&apos;autre voit quand tu as validé.
      </>
    ),
    prompts: "Les sujets",
    promptsList: [
      <>
        <b>La personne qui classe choisit les thèmes</b> d&apos;où viennent les sujets (tous les thèmes par défaut).
      </>,
      "Elle choisit aussi la langue des sujets : anglais ou français.",
      <>
        Avant de classer, elle peut toucher <b>Changer de sujet</b> pour en avoir un autre, ou écrire son propre sujet et ses {N} éléments.
      </>,
      "Un sujet ne revient pas tant que vous n'avez pas vu tous ceux de vos thèmes.",
    ],
    tips: "Astuces",
    tipsList: [
      "Pour classer : sois toi-même. Un classement que l'autre peut prévoir rapporte plus qu'un classement astucieux.",
      "Pour deviner : pense à ce que l'autre adore, pas à ce que tu choisirais.",
      `Les extrêmes sont les plus faciles : trouve d'abord le 1 et le ${N}.`,
    ],
  },
});

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="grid gap-2">
      <h3 className={`${DISPLAY} m-0 text-[20px]`}>{title}</h3>
      {children}
    </section>
  );
}

const P = "m-0 text-[15px] leading-snug text-[var(--muted)] [&_b]:text-[var(--ink)]";
const LIST = `${P} grid gap-1.5 pl-5 [&:is(ol)]:list-decimal [&:is(ul)]:list-disc`;

/** The worked example: the same five items, as the ranker and the guesser numbered them. */
const RANKED = [1, 2, 3, 4, 5];
const GUESSED = [1, 3, 2, 4, 5];

function Example() {
  const t = useText(RULES);
  const score = matchCount(
    RANKED.map((n) => t.items[n - 1]),
    GUESSED.map((n) => t.items[n - 1]),
  );
  return (
    <div aria-hidden="true" className="grid gap-2 rounded-xl border-2 border-[var(--rule)] bg-white p-3">
      <div className="grid grid-cols-[auto_repeat(5,minmax(0,1fr))] items-center gap-x-2 gap-y-1.5 text-center text-[13px] font-bold">
        <span />
        {t.items.map((item) => (
          <span key={item} className="truncate">
            {item}
          </span>
        ))}
        <span className="text-left">{t.ranker}</span>
        {RANKED.map((n, i) => (
          <span key={i} className="flex justify-center">
            <StickyNote n={n} size={30} />
          </span>
        ))}
        <span className="text-left">{t.guesser}</span>
        {GUESSED.map((n, i) => (
          <span key={i} className="flex justify-center">
            <StickyNote n={n} size={30} />
          </span>
        ))}
        <span />
        {GUESSED.map((n, i) => (
          <span key={i} className={`flex justify-center ${n === RANKED[i] ? "text-[var(--match-ink)]" : "text-[var(--miss)]"}`}>
            {n === RANKED[i] ? <CheckIcon size={18} /> : "✕"}
          </span>
        ))}
      </div>
      <p className={`${DISPLAY} m-0 text-center text-[17px]`}>{t.examplePoints(score)}</p>
    </div>
  );
}

const items = (list: ReactNode[]) => list.map((item, i) => <li key={i}>{item}</li>);

function RulesContent() {
  const t = useText(RULES);
  return (
    <div className="grid gap-5">
      <Section title={t.goal}>
        <p className={P}>{t.goalText}</p>
      </Section>

      <Section title={t.players}>
        <ul className={LIST}>{items(t.playersList)}</ul>
      </Section>

      <Section title={t.aRound}>
        <ol className={LIST}>{items(t.roundSteps)}</ol>
        <p className={P}>{t.roundHow}</p>
      </Section>

      <Section title={t.scoring}>
        <Example />
        <ul className={LIST}>{items(t.scoringList)}</ul>
      </Section>

      <Section title={t.time}>
        <p className={P}>{t.timeText}</p>
      </Section>

      <Section title={t.prompts}>
        <ul className={LIST}>{items(t.promptsList)}</ul>
      </Section>

      <Section title={t.tips}>
        <ul className={LIST}>{items(t.tipsList)}</ul>
      </Section>
    </div>
  );
}

/**
 * Same Page's How to play (docs/how-to-play.md, on the shared
 * components/HowToPlay.tsx): `variant` "icon" is the round ? in the game's
 * header (on every screen), "link" the waiting screen's "How to play".
 */
export default function RulesButton({ variant = "icon" }: { variant?: "icon" | "link" }) {
  return (
    <HowToPlay look={LOOK} variant={variant}>
      <RulesContent />
    </HowToPlay>
  );
}
