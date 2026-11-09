"use client";

import type { ReactNode } from "react";
import HowToPlay, { type HowToPlayLook } from "@/components/HowToPlay";
import { ANSWER_MS, BUZZ_WINDOW_MS, CARDS, CHOICES, COUNTDOWN_MS, HAND_SIZE, LENGTHS, MAX_PLAYERS, MIN_PLAYERS, QUESTION_MS, RESULT_MS, TOPICS } from "@/lib/games/buzzerquiz/constants";
import { pointsFor } from "@/lib/games/buzzerquiz/game";
import { formatNumber, plural, texts } from "@/lib/i18n/text";
import { useText } from "@/lib/i18n/useLang";
import { useCardInfo } from "./PowerCards";
import { DISPLAY, FOCUS, PrimaryButton, TEXT } from "./ui";

/** Buzzer Quiz's look for the shared dialog: the violet surface, Bricolage headings, the buzzer-red Got it. */
const LOOK: HowToPlayLook = {
  iconClassName: `${DISPLAY} ${FOCUS} flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-full border-2 border-[var(--text-muted)] bg-[var(--surface)] text-[19px] font-extrabold text-[var(--text)]`,
  linkClassName: `${TEXT} ${FOCUS} cursor-pointer self-start border-0 bg-transparent p-0 text-[15px] font-bold text-[var(--points)] underline`,
  panelClassName: `${TEXT} bg-[var(--surface)] text-[var(--text)]`,
  headerClassName: "border-b-2 border-[var(--surface-2)]",
  titleClassName: `${DISPLAY} text-[22px] font-extrabold`,
  closeClassName: `${FOCUS} flex h-9 w-9 cursor-pointer items-center justify-center rounded-full border-0 bg-[var(--surface-2)] text-[20px] text-[var(--text)]`,
  DoneButton: PrimaryButton,
};

const seconds = (ms: number) => ms / 1000;
const LETTERS = ["A", "B", "C", "D"];
const [SHORTEST, LONGEST] = [LENGTHS[0], LENGTHS[LENGTHS.length - 1]];

/** The rules' words, in both languages (they hold markup, so they live here rather than in text.ts). */
const RULES = texts<{
  goalTitle: string;
  goal: ReactNode;
  playersTitle: string;
  players: ReactNode[];
  questionTitle: string;
  question: ReactNode[];
  scoringTitle: string;
  points: (n: number) => string;
  scoring: ReactNode[];
  timeTitle: string;
  time: ReactNode[];
  cardsTitle: string;
  cardsIntro: ReactNode;
  cardLine: (name: string, effect: string, freeze: boolean) => ReactNode;
  stealNote: string;
  optionsTitle: string;
  options: ReactNode[];
  tipsTitle: string;
  tips: ReactNode[];
}>({
  en: {
    goalTitle: "The goal",
    goal: (
      <>
        <b>Buzz first, pick the right answer, score the most points.</b> The fewer choices left when you get it right, the less it&apos;s worth.
      </>
    ),
    playersTitle: "Players",
    players: [
      <>
        {MIN_PLAYERS} to {MAX_PLAYERS} players, each on their own phone or computer.
      </>,
      <>
        <b>In a private room</b>, the host (who made the room) picks the language, the topics and how many questions, then starts.
      </>,
      <>
        <b>In matchmaking</b> there&apos;s no host: every topic, 10 questions, and the quiz starts by itself once at least {MIN_PLAYERS} players are in.
      </>,
    ],
    questionTitle: "A question",
    question: [
      <>
        A {seconds(COUNTDOWN_MS)}-second countdown, then the question and its {CHOICES} choices.
      </>,
      <>
        Know it? Tap <b>Buzz</b>. If several of you buzz within {BUZZ_WINDOW_MS / 1000} s of the first, the fastest reaction wins, so a slow connection doesn&apos;t cost you.
      </>,
      "The player who buzzed picks a choice. Nobody else can pick.",
      <>
        <b>Right:</b> they score and the question ends. <b>Wrong:</b> that choice is struck out for everyone, that player is out until the next question, and the others
        can buzz again.
      </>,
    ],
    scoringTitle: "Scoring",
    points: (n) => `${n} ${n === 1 ? "point" : "points"}`,
    scoring: [
      <>
        Right with all {CHOICES} choices left scores {pointsFor(CHOICES)}; each wrong guess before yours takes a point off.
      </>,
      "Nobody scores if time runs out, if everyone is out, or once only one choice is left.",
      "After the last question, the most points wins. Ties share the place.",
    ],
    timeTitle: "Time",
    time: [
      <>
        <b>{seconds(QUESTION_MS)} s</b> to buzz on each question. The clock stops while someone is picking.
      </>,
      <>
        <b>{seconds(ANSWER_MS)} s</b> to pick once you&apos;ve buzzed: run out and you&apos;re out until the next question (nothing is struck).
      </>,
      <>The answer stays up for {seconds(RESULT_MS)} s, then the next countdown.</>,
    ],
    cardsTitle: "Power cards (optional)",
    cardsIntro: (
      <>
        When the host turns <b>Power cards</b> on, everyone is dealt {HAND_SIZE} different ones. Play at most one per question, during the countdown or before you
        buzz; everyone sees who played what. Not in matchmaking.
      </>
    ),
    cardLine: (name, effect, freeze) => (
      <>
        <b className="text-[var(--text)]">{name}</b>: {effect}.{freeze ? " Play it during the countdown." : ""}
      </>
    ),
    stealNote: "Steal: each player who played it takes 1 point from whoever gets the question, while there are points to take.",
    optionsTitle: "Options",
    options: [
      <>
        <b>Language:</b> English or French questions.
      </>,
      <>
        <b>Topics:</b> any of the {TOPICS.length} (geography, cinema &amp; TV, science, sport, music, history).
      </>,
      <>
        <b>Length:</b> {LENGTHS.join(", ")} questions ({SHORTEST} is a quick round, {LONGEST} a long game).
      </>,
      <>
        <b>Power cards:</b> on or off (off by default).
      </>,
    ],
    tipsTitle: "Tips",
    tips: [
      "A wrong guess hands the others an easier question. Buzz when you know, not when you hope.",
      "Waiting is a gamble too: every strike lowers what the question is worth.",
      "Keep a thumb on the buzzer during the countdown.",
    ],
  },
  fr: {
    goalTitle: "Le but",
    goal: (
      <>
        <b>Buzze en premier, choisis la bonne réponse, marque le plus de points.</b> Moins il reste de choix quand tu trouves, moins ça rapporte.
      </>
    ),
    playersTitle: "Joueurs",
    players: [
      <>
        De {MIN_PLAYERS} à {MAX_PLAYERS} joueurs, chaque personne sur son propre téléphone ou ordinateur.
      </>,
      <>
        <b>Dans un salon privé</b>, l&apos;hôte (qui a créé le salon) choisit la langue des questions, les thèmes et le nombre de questions, puis lance la partie.
      </>,
      <>
        <b>En partie rapide</b>, pas d&apos;hôte&nbsp;: tous les thèmes, 10 questions, et le quiz commence tout seul dès qu&apos;au moins {MIN_PLAYERS} joueurs sont là.
      </>,
    ],
    questionTitle: "Une question",
    question: [
      <>
        Un compte à rebours de {seconds(COUNTDOWN_MS)} secondes, puis la question et ses {CHOICES} choix.
      </>,
      <>
        Tu sais&#x202F;? Appuie sur <b>Buzz</b>. Si plusieurs d&apos;entre vous buzzent moins de {formatNumber("fr", BUZZ_WINDOW_MS / 1000)} s après le premier buzz, le
        réflexe le plus rapide l&apos;emporte&nbsp;: une connexion lente ne te pénalise pas.
      </>,
      "La personne qui a buzzé choisit une réponse. Personne d'autre ne peut choisir.",
      <>
        <b>Bonne réponse&nbsp;:</b> des points, et la question s&apos;arrête. <b>Mauvaise réponse&nbsp;:</b> ce choix est barré pour tout le monde, la personne est hors
        jeu jusqu&apos;à la question suivante, et les autres peuvent buzzer à nouveau.
      </>,
    ],
    scoringTitle: "Les points",
    points: (n) => plural("fr", n, `${n} point`, `${n} points`),
    scoring: [
      <>
        Une bonne réponse avec les {CHOICES} choix encore là rapporte {pointsFor(CHOICES)} points&#x202F;; chaque erreur avant la tienne enlève un point.
      </>,
      "Personne ne marque si le temps est écoulé, si tout le monde est hors jeu, ou s'il ne reste qu'un choix.",
      "Après la dernière question, le plus de points l'emporte. En cas d'égalité, on partage la place.",
    ],
    timeTitle: "Le chrono",
    time: [
      <>
        <b>{seconds(QUESTION_MS)} s</b> pour buzzer à chaque question. Le chrono s&apos;arrête pendant que quelqu&apos;un choisit.
      </>,
      <>
        <b>{seconds(ANSWER_MS)} s</b> pour choisir une fois que tu as buzzé&nbsp;: trop tard, et tu es hors jeu jusqu&apos;à la question suivante (rien n&apos;est barré).
      </>,
      <>La réponse reste affichée {seconds(RESULT_MS)} s, puis vient le compte à rebours suivant.</>,
    ],
    cardsTitle: "Cartes pouvoir (facultatif)",
    cardsIntro: (
      <>
        Quand l&apos;hôte active les <b>cartes pouvoir</b>, chaque personne en reçoit {HAND_SIZE} différentes. Joue-en au plus une par question, pendant le compte à
        rebours ou avant de buzzer&#x202F;; tout le monde voit qui a joué quoi. Pas en partie rapide.
      </>
    ),
    // After a colon, French goes on in lower case.
    cardLine: (name, effect, freeze) => (
      <>
        <b className="text-[var(--text)]">{name}</b>&nbsp;: {effect.charAt(0).toLowerCase() + effect.slice(1)}.{freeze ? " Joue-la pendant le compte à rebours." : ""}
      </>
    ),
    stealNote: "Vol : chaque personne qui l'a jouée prend 1 point à qui trouve la réponse, tant qu'il reste des points à prendre.",
    optionsTitle: "Options",
    options: [
      <>
        <b>Langue&nbsp;:</b> questions en anglais ou en français.
      </>,
      <>
        <b>Thèmes&nbsp;:</b> au choix parmi les {TOPICS.length} (géographie, cinéma et télé, sciences, sport, musique, histoire).
      </>,
      <>
        <b>Durée&nbsp;:</b> {LENGTHS.join(", ")} questions ({SHORTEST} pour une petite partie, {LONGEST} pour une longue).
      </>,
      <>
        <b>Cartes pouvoir&nbsp;:</b> activées ou non (désactivées par défaut).
      </>,
    ],
    tipsTitle: "Conseils",
    tips: [
      "Une erreur offre aux autres une question plus facile. Buzze quand tu sais, pas quand tu espères.",
      "Attendre, c'est aussi un pari : chaque choix barré fait baisser la valeur de la question.",
      "Garde le pouce sur le buzzer pendant le compte à rebours.",
    ],
  },
});

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="grid gap-2">
      <h3 className={`${DISPLAY} m-0 text-[18px] font-extrabold`}>{title}</h3>
      {children}
    </section>
  );
}

const P = "m-0 text-[15px] leading-snug text-[var(--text-muted)] [&_b]:text-[var(--text)]";
const LIST = `${P} grid gap-1.5 pl-5 [&:is(ol)]:list-decimal [&:is(ul)]:list-disc`;

const items = (list: ReactNode[]) => list.map((item, i) => <li key={i}>{item}</li>);

/** Four choices, the first `struck` crossed out, and what a right answer is worth then. */
function ScoreLine({ struck }: { struck: number }) {
  const r = useText(RULES);
  const points = pointsFor(CHOICES - struck);
  return (
    <div className="flex items-center gap-2">
      {LETTERS.map((letter, i) => (
        <span
          key={letter}
          className={`${DISPLAY} flex h-8 w-8 items-center justify-center rounded-lg text-[15px] font-extrabold ${
            i < struck ? "bg-[var(--surface-dim)] text-[var(--text-struck)] line-through" : "bg-[var(--surface-2)] text-[var(--text)]"
          }`}
        >
          {letter}
        </span>
      ))}
      <span className={`${DISPLAY} ml-1 text-[16px] font-extrabold text-[var(--points)]`}>{r.points(points)}</span>
    </div>
  );
}

function RulesContent() {
  const r = useText(RULES);
  const cardInfo = useCardInfo();
  return (
    <div className="grid gap-5">
      <Section title={r.goalTitle}>
        <p className={P}>{r.goal}</p>
      </Section>

      <Section title={r.playersTitle}>
        <ul className={LIST}>{items(r.players)}</ul>
      </Section>

      <Section title={r.questionTitle}>
        <ol className={LIST}>{items(r.question)}</ol>
      </Section>

      <Section title={r.scoringTitle}>
        <div className="grid gap-2 rounded-xl bg-[var(--surface-dim)] p-3">
          <ScoreLine struck={0} />
          <ScoreLine struck={1} />
          <ScoreLine struck={2} />
        </div>
        <ul className={LIST}>{items(r.scoring)}</ul>
      </Section>

      <Section title={r.timeTitle}>
        <ul className={LIST}>{items(r.time)}</ul>
      </Section>

      <Section title={r.cardsTitle}>
        <p className={P}>{r.cardsIntro}</p>
        <ul className="m-0 grid list-none gap-2 p-0">
          {CARDS.map((card) => {
            const info = cardInfo(card);
            return (
              <li key={card} className="flex items-center gap-3 rounded-xl bg-[var(--surface-dim)] p-2.5">
                <span aria-hidden="true" className={`${DISPLAY} flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--points)] text-[14px] font-extrabold text-[var(--ink)]`}>
                  {info.glyph}
                </span>
                <span className="text-[15px] leading-snug text-[var(--text-muted)]">{r.cardLine(info.name, info.effect, card === "freeze")}</span>
              </li>
            );
          })}
        </ul>
        <p className={P}>{r.stealNote}</p>
      </Section>

      <Section title={r.optionsTitle}>
        <ul className={LIST}>{items(r.options)}</ul>
      </Section>

      <Section title={r.tipsTitle}>
        <ul className={LIST}>{items(r.tips)}</ul>
      </Section>
    </div>
  );
}

/**
 * Buzzer Quiz's How to play (docs/how-to-play.md, on the shared
 * components/HowToPlay.tsx): `variant` "icon" is the round ? in each screen's
 * title row, "link" the lobby's "How to play".
 */
export default function RulesButton({ variant = "icon" }: { variant?: "icon" | "link" }) {
  return (
    <HowToPlay look={LOOK} variant={variant}>
      <RulesContent />
    </HowToPlay>
  );
}
