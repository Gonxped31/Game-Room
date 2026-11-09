"use client";

import type { ButtonHTMLAttributes, ReactNode } from "react";
import HowToPlay, { type HowToPlayLook } from "@/components/HowToPlay";
import {
  MAX_PLAYERS,
  MAX_WORD,
  MIN_LETTERS_LEFT,
  MIN_WORD,
  START_LEAD_MS,
  STEAL_MS,
  STEAL_OFFER_MS,
  TARGET_TURN_CAP,
  TARGETS,
  TURN_MS,
  TURNS_PER_TEAM,
} from "@/lib/games/wordscramble/constants";
import { stealValue, worth } from "@/lib/games/wordscramble/game";
import type { Lang } from "@/lib/i18n/lang";
import { texts } from "@/lib/i18n/text";
import { useLang } from "@/lib/i18n/useLang";
import { ChunkyButton, DISPLAY, FOCUS, Slot, TEXT, Tile } from "./ui";

/** "Got it": the chunky Team A button, full width. */
function DoneButton({ className = "", ...rest }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return <ChunkyButton className={`w-full ${className}`} {...rest} />;
}

/** Word Scramble's look for the shared dialog: the cream table, Lilita headings, the chunky orange Got it. */
const LOOK: HowToPlayLook = {
  iconClassName: `${DISPLAY} ${FOCUS} flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-full border-[3px] border-[var(--ink)] bg-white text-[20px] text-[var(--ink)]`,
  linkClassName: `${TEXT} ${FOCUS} cursor-pointer self-start border-0 bg-transparent p-0 text-[16px] font-extrabold text-[var(--team-b)] underline`,
  panelClassName: `${TEXT} bg-[var(--table)] text-[var(--ink)]`,
  headerClassName: "border-b-[3px] border-[var(--line)]",
  titleClassName: `${DISPLAY} text-[26px]`,
  closeClassName: `${FOCUS} flex h-9 w-9 cursor-pointer items-center justify-center rounded-full border-2 border-[var(--ink)] bg-white text-[20px] text-[var(--ink)]`,
  DoneButton,
};

const seconds = (ms: number) => ms / 1000;
/** The worked example: a 5-letter word, with the same five letters in both languages. */
const EXAMPLE: Record<Lang, string> = { en: "TIGER", fr: "TIGRE" };
const SCRAMBLED = ["R", "E", "G", "T", "I"];

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="grid gap-2">
      <h3 className={`${DISPLAY} m-0 text-[22px]`}>{title}</h3>
      {children}
    </section>
  );
}

const P = "m-0 text-[16px] font-semibold leading-snug text-[var(--muted)] [&_b]:text-[var(--ink)]";
const LIST = `${P} grid gap-1.5 pl-5 [&:is(ol)]:list-decimal [&:is(ul)]:list-disc`;

/** The scrambled tiles, and the answer with one hint letter placed. */
function Board({ word }: { word: string }) {
  return (
    <div aria-hidden="true" className="grid justify-items-center gap-4 rounded-2xl bg-[var(--board)] px-3 pt-4 pb-5">
      <div className="flex gap-1.5">
        {SCRAMBLED.map((letter, i) => (
          <Tile key={i} letter={letter} look="wood" size={38} tilt={i % 2 ? 3 : -3} />
        ))}
      </div>
      <div className="flex gap-1.5">
        <Tile letter={word[0]} look="team" team="A" size={38} hintMark />
        {word
          .slice(1)
          .split("")
          .map((_, i) => (
            <Slot key={i} size={38} />
          ))}
      </div>
    </div>
  );
}

/** One section of the rules: its title and its paragraph or list items. */
interface Part {
  title: string;
  items: ReactNode[];
}

/** The rules in each language, section by section. */
interface Rules {
  goal: { title: string; body: ReactNode };
  teams: Part;
  turn: Part;
  scoring: Part;
  time: Part;
  length: Part;
  tips: Part;
}

const RULES = texts<Rules>({
  en: {
    goal: {
      title: "The goal",
      body: (
        <>
          <b>Two teams take turns unscrambling a word against the clock.</b> The team with the most points at the end wins.
        </>
      ),
    },
    teams: {
      title: "Teams",
      items: [
        <>2 to {MAX_PLAYERS} players in two even teams (1 v 1 up to 4 v 4). Pick your team in the lobby.</>,
        <>
          <b>In a private room</b>, the host (who made the room) sets the language and the length, then starts once the teams are even.
        </>,
        <>
          <b>In matchmaking</b> there&apos;s no host: the default settings, teams evened out for you, and the game starts by itself.
        </>,
      ],
    },
    turn: {
      title: "A turn",
      items: [
        <>
          Your team gets {MIN_WORD} to {MAX_WORD} scrambled letters and <b>{seconds(TURN_MS)} seconds</b>. The other team watches.
        </>,
        <>
          Anyone on your team can answer, each on their own device: tap the letters in order (or drag them into the slots; on a keyboard, type them), then <b>Confirm</b>.
          Wrong guesses cost nothing: try again.
        </>,
        <>
          Stuck? <b>Hint</b> places the next letter for you, for 1 point. No hint once only {MIN_LETTERS_LEFT} letters are left to find.
        </>,
      ],
    },
    scoring: {
      title: "Scoring",
      items: [
        <>
          <b>A word is worth its letters, minus 1 per hint:</b> {EXAMPLE.en} scores {worth(EXAMPLE.en, 0)}, or {worth(EXAMPLE.en, 1)} with one hint.
        </>,
        <>
          <b>Steals:</b> if time runs out, the other team has {seconds(STEAL_OFFER_MS)} s to tap <b>Steal!</b>. The first to tap gets {seconds(STEAL_MS)} s and one try, for
          half the word&apos;s worth, rounded up ({worth(EXAMPLE.en, 1)} → {stealValue(EXAMPLE.en, 1)}). Right, they win it; wrong or too slow, they lose it, so a score can
          go below zero.
        </>,
        <>A team&apos;s second word each round has the same length as the first team&apos;s, so the game stays fair.</>,
      ],
    },
    time: {
      title: "Time",
      items: [
        <>
          {seconds(START_LEAD_MS)} s to get ready, then <b>{seconds(TURN_MS)} s</b> a turn.
        </>,
        <>
          Steals: {seconds(STEAL_OFFER_MS)} s to claim, {seconds(STEAL_MS)} s to answer.
        </>,
      ],
    },
    length: {
      title: "Game length",
      items: [
        <>
          <b>Turns:</b> {TURNS_PER_TEAM.min} to {TURNS_PER_TEAM.max} words per team ({TURNS_PER_TEAM.default} by default). Most points after the last word wins.
        </>,
        <>
          <b>Target:</b> first to {TARGETS.join(", ")} points. Both teams always get the same number of turns, and it stops after {TARGET_TURN_CAP} each.
        </>,
        <>A tie is a draw. Words come in English or French.</>,
      ],
    },
    tips: {
      title: "Tips",
      items: [
        <>Split up: one teammate tries endings (-ING, -ER), another the first letter.</>,
        <>A hint early on is cheap insurance against a steal.</>,
        <>Watching team: work it out too, and be first to Steal.</>,
      ],
    },
  },
  fr: {
    goal: {
      title: "Le but",
      body: (
        <>
          <b>Deux équipes remettent tour à tour les lettres d&apos;un mot dans l&apos;ordre, contre la montre.</b> L&apos;équipe qui a le plus de points à la fin gagne.
        </>
      ),
    },
    teams: {
      title: "Les équipes",
      items: [
        <>
          De 2 à {MAX_PLAYERS} joueurs en deux équipes égales (de 1 contre 1 à 4 contre 4). Choisis ton équipe dans la salle d&apos;attente.
        </>,
        <>
          <b>Dans un salon privé</b>, l&apos;hôte (qui a créé le salon) choisit la langue des mots et la durée, puis lance la partie quand les équipes sont égales.
        </>,
        <>
          <b>En partie rapide</b>, pas d&apos;hôte&nbsp;: les réglages par défaut, des équipes équilibrées pour toi, et la partie démarre toute seule.
        </>,
      ],
    },
    turn: {
      title: "Un tour",
      items: [
        <>
          Ton équipe reçoit de {MIN_WORD} à {MAX_WORD} lettres mélangées et <b>{seconds(TURN_MS)} secondes</b>. L&apos;autre équipe regarde.
        </>,
        <>
          Dans ton équipe, tout le monde peut répondre, chaque personne sur son appareil&nbsp;: touche les lettres dans l&apos;ordre (ou glisse-les dans les cases&#x202F;; au
          clavier, tape-les), puis <b>Valider</b>. Les mauvaises réponses ne coûtent rien&nbsp;: réessaie.
        </>,
        <>
          Tu bloques&#x202F;? <b>Indice</b> place la lettre suivante pour toi, contre 1 point. Plus d&apos;indice quand il ne reste que {MIN_LETTERS_LEFT} lettres à trouver.
        </>,
      ],
    },
    scoring: {
      title: "Les points",
      items: [
        <>
          <b>Un mot vaut son nombre de lettres, moins 1 par indice&nbsp;:</b> {EXAMPLE.fr} rapporte {worth(EXAMPLE.fr, 0)} points, ou {worth(EXAMPLE.fr, 1)} avec un indice.
        </>,
        <>
          <b>Les vols&nbsp;:</b> si le temps est écoulé, l&apos;autre équipe a {seconds(STEAL_OFFER_MS)} s pour toucher <b>Voler&#x202F;!</b> La première personne qui le touche a{" "}
          {seconds(STEAL_MS)} s et un seul essai, pour la moitié de la valeur du mot, arrondie au-dessus ({worth(EXAMPLE.fr, 1)} → {stealValue(EXAMPLE.fr, 1)}). Bonne réponse,
          l&apos;équipe gagne ces points&#x202F;; mauvaise réponse ou temps écoulé, elle les perd. Un score peut donc passer sous zéro.
        </>,
        <>Dans chaque manche, le mot de la deuxième équipe a la même longueur que celui de la première&nbsp;: la partie reste équitable.</>,
      ],
    },
    time: {
      title: "Le chrono",
      items: [
        <>
          {seconds(START_LEAD_MS)} s pour se préparer, puis <b>{seconds(TURN_MS)} s</b> par tour.
        </>,
        <>
          Vols&nbsp;: {seconds(STEAL_OFFER_MS)} s pour se lancer, {seconds(STEAL_MS)} s pour répondre.
        </>,
      ],
    },
    length: {
      title: "Durée de la partie",
      items: [
        <>
          <b>Tours&nbsp;:</b> de {TURNS_PER_TEAM.min} à {TURNS_PER_TEAM.max} mots par équipe ({TURNS_PER_TEAM.default} par défaut). L&apos;équipe qui a le plus de points après
          le dernier mot gagne.
        </>,
        <>
          <b>Score cible&nbsp;:</b> la première équipe à {TARGETS.slice(0, -1).join(", ")} ou {TARGETS.at(-1)} points. Les deux équipes jouent toujours autant de tours, et la
          partie s&apos;arrête après {TARGET_TURN_CAP} chacune.
        </>,
        <>En cas d&apos;égalité, personne ne gagne. Les mots sont en anglais ou en français.</>,
      ],
    },
    tips: {
      title: "Astuces",
      items: [
        <>Partage le travail&nbsp;: l&apos;un essaie les terminaisons (-TION, -EUR), l&apos;autre cherche la première lettre.</>,
        <>Un indice tôt dans le tour, c&apos;est une assurance pas chère contre un vol.</>,
        <>Quand ton équipe regarde&nbsp;: cherche aussi, et touche Voler avant tout le monde.</>,
      ],
    },
  },
});

function Items({ items, ordered = false }: { items: ReactNode[]; ordered?: boolean }) {
  const List = ordered ? "ol" : "ul";
  return (
    <List className={LIST}>
      {items.map((item, i) => (
        <li key={i}>{item}</li>
      ))}
    </List>
  );
}

function RulesContent() {
  const lang = useLang();
  const r = RULES[lang];
  return (
    <div className="grid gap-5">
      <Section title={r.goal.title}>
        <p className={P}>{r.goal.body}</p>
      </Section>

      <Section title={r.teams.title}>
        <Items items={r.teams.items} />
      </Section>

      <Section title={r.turn.title}>
        <Board word={EXAMPLE[lang]} />
        <Items items={r.turn.items} ordered />
      </Section>

      <Section title={r.scoring.title}>
        <Items items={r.scoring.items} />
      </Section>

      <Section title={r.time.title}>
        <Items items={r.time.items} />
      </Section>

      <Section title={r.length.title}>
        <Items items={r.length.items} />
      </Section>

      <Section title={r.tips.title}>
        <Items items={r.tips.items} />
      </Section>
    </div>
  );
}

/**
 * Word Scramble's How to play (docs/how-to-play.md, on the shared
 * components/HowToPlay.tsx): `variant` "icon" is the round ? in each screen's
 * top row, "link" the lobby's "How to play".
 */
export default function RulesButton({ variant = "icon" }: { variant?: "icon" | "link" }) {
  return (
    <HowToPlay look={LOOK} variant={variant}>
      <RulesContent />
    </HowToPlay>
  );
}
