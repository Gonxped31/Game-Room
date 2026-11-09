"use client";

import type { ButtonHTMLAttributes, ReactNode } from "react";
import HowToPlay, { type HowToPlayLook } from "@/components/HowToPlay";
import { AREA_NAME } from "@/lib/games/borderrun/areas";
import { AREAS, PENALTY_MS } from "@/lib/games/borderrun/constants";
import { ROUND_MS } from "@/lib/games/borderrun/race";
import { COUNTDOWN_MS, DNF_EXTRA_MS, MAX_ROUNDS, PLAYERS, RESULTS_MS, ROUND_COUNTS } from "@/lib/games/race/race";
import type { Lang } from "@/lib/i18n/lang";
import { texts } from "@/lib/i18n/text";
import { useLang } from "@/lib/i18n/useLang";
import { NBSP, NNBSP } from "./text";

const FOCUS = "focus-visible:outline-[3px] focus-visible:outline-offset-2 focus-visible:outline-[var(--br-ink)]";

/** "Got it": the road-sign yellow button, full width. */
function DoneButton({ className = "", ...rest }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      className={`${FOCUS} h-12 w-full cursor-pointer rounded-xl border-2 border-[var(--br-ink)] bg-[var(--br-accent)] text-[17px] font-bold text-[var(--br-ink)] shadow-[0_3px_0_var(--br-ink)] active:translate-y-[3px] active:shadow-none ${className}`}
      {...rest}
    />
  );
}

/**
 * Detour's look for the shared dialog: the warm card, the green road-sign
 * title, the yellow Got it. Its classes are Tailwind utilities, which the
 * offline download doesn't compile: so How to play is only ever placed by
 * the site's pages (Stage's `rules`, the race shell), never inside the
 * exported Stage itself.
 */
const LOOK: HowToPlayLook = {
  iconClassName: `${FOCUS} flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-xl border-2 border-[var(--br-ink)] bg-[var(--br-card)] text-[20px] font-bold text-[var(--br-ink)] shadow-[0_3px_0_var(--br-ink)]`,
  linkClassName: `${FOCUS} cursor-pointer self-start border-0 bg-transparent p-0 text-[15px] font-bold text-[var(--br-ink)] underline`,
  panelClassName: "bg-[var(--br-card)] text-[var(--br-ink)]",
  headerClassName: "bg-[var(--br-sign)] text-white",
  titleClassName: "text-[22px] font-extrabold tracking-[0.02em]",
  closeClassName: `flex h-9 w-9 cursor-pointer items-center justify-center rounded-xl border-2 border-white bg-transparent text-[20px] text-white focus-visible:outline-[3px] focus-visible:outline-offset-2 focus-visible:outline-white`,
  DoneButton,
};

const seconds = (ms: number) => ms / 1000;

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="grid gap-2">
      <h3 className="m-0 text-[18px] font-extrabold">{title}</h3>
      {children}
    </section>
  );
}

const P = "m-0 text-[15px] leading-snug text-[var(--br-ink-soft)] [&_b]:text-[var(--br-ink)]";
const LIST = `${P} grid gap-1.5 pl-5 [&:is(ol)]:list-decimal [&:is(ul)]:list-disc`;

const GREEN = { color: "var(--br-best)" };
const YELLOW = { color: "var(--br-close)" };
const RED = { color: "var(--br-off)" };

/** The numbers the rules quote, from the constants, so a rules change can't leave them stale. */
const N = {
  penalty: seconds(PENALTY_MS),
  dnf: seconds(DNF_EXTRA_MS),
  countdown: seconds(COUNTDOWN_MS),
  minutes: seconds(ROUND_MS) / 60,
  results: seconds(RESULTS_MS),
  challenge: PLAYERS.challenge,
  survival: PLAYERS.survival,
  maxRounds: MAX_ROUNDS,
};

/**
 * How to play in each language. Values are JSX (bold words and coloured
 * ones sit inside sentences), so they live here rather than in text.ts.
 * Keep the two in step: same sections, same facts.
 */
const RULES = texts({
  en: {
    title: "How to play",
    start: "Start",
    end: "End",
    goal: "The goal",
    goalText: (
      <>
        <b>Link two countries by land.</b> Name the countries in between until your guesses join the start to the end, through open borders only. Fast and with few guesses
        is best.
      </>
    ),
    ways: "Ways to play",
    waysList: [
      <>
        <b>Daily route</b>: the same route for everyone today, one try, your time on the day&apos;s leaderboard. A new one at midnight (Toronto time).
      </>,
      <>
        <b>Endless</b>: pick a map, then Start. New route keeps the map; Show a route gives up and draws one.
      </>,
      <>
        <b>With others</b> (from the hub): everyone gets the same routes at the same time, in Challenge or Survival (below).
      </>,
    ],
    route: "A route",
    routeList: [
      <>
        You get a start and an end country, and one or two <b>closed borders</b> (red): you can&apos;t cross them, so go around.
      </>,
      <>
        <b>Type a country</b> and pick it from the list, in English or French. The route is done once your guesses link start to end, any way round.
      </>,
      <>
        Each guess is coloured: <b style={GREEN}>green</b> is on a shortest route, <b style={YELLOW}>yellow</b> on one at most two countries longer,{" "}
        <b style={RED}>red</b> is off the way.
      </>,
      <>Names it can&apos;t take (unknown, not on this map, the start or end, a repeat) cost nothing.</>,
    ],
    scoring: "Scoring",
    scoringList: [
      <>
        The <b>par</b> is how many countries the shortest open route has in between.
      </>,
      <>
        <b>Your score is your time, plus {N.penalty} seconds for every guess past the par.</b> Lower is better.
      </>,
    ],
    racing: "Racing others",
    racingList: [
      <>
        <b>Challenge</b>, {N.challenge.min} to {N.challenge.max} players: {ROUND_COUNTS.join(" or ")} routes, and the lowest total wins. An unfinished route counts as the
        slowest finish plus {N.dnf} s.
      </>,
      <>
        <b>Survival</b>, {N.survival.min} to {N.survival.max} players: after each route the slowest are out (two while more than 4 are left, then one), until one is left. At
        most {N.maxRounds} routes.
      </>,
      <>The host picks the mode and the map: one, or a different one each route. Routes get longer as you go. Matchmaking starts by itself.</>,
      <>While you play, you see how far the others have got, never which countries.</>,
    ],
    time: "Time",
    timeList: [
      <>Solo: the clock runs from Start until the route is linked.</>,
      <>
        Races: a {N.countdown}-second countdown, then {N.minutes} minutes per route, and {N.results} seconds of results in between.
      </>,
    ],
    maps: "Maps and names",
    mapsList: (maps: string) => [
      <>Maps: {maps}. The daily route changes map through the week.</>,
      <>Country names show in the page&apos;s language (EN / FR at the top), but you can always type either language, accents or not.</>,
    ],
    tips: "Tips",
    tipsList: [
      <>Look at the closed border first: the way around it is the whole puzzle.</>,
      <>A yellow guess still links. Don&apos;t chase the perfect route if the clock is running.</>,
      <>Islands never link by land.</>,
    ],
  },
  fr: {
    title: "Comment jouer",
    start: "Départ",
    end: "Arrivée",
    goal: "Le but",
    goalText: (
      <>
        <b>Relier deux pays par la terre.</b> Nomme les pays entre les deux jusqu&apos;à ce que tes essais relient le départ à l&apos;arrivée, par des frontières ouvertes
        seulement. Le mieux{NBSP}: aller vite, en peu d&apos;essais.
      </>
    ),
    ways: "Façons de jouer",
    waysList: [
      <>
        <b>Défi du jour</b>
        {NBSP}: le même parcours pour tout le monde aujourd&apos;hui, une seule tentative, ton temps au classement du jour. Un nouveau à minuit (heure de Toronto).
      </>,
      <>
        <b>Infini</b>
        {NBSP}: choisis une carte, puis Commencer. Nouveau parcours garde la carte{NNBSP}; Voir un parcours abandonne et en montre un.
      </>,
      <>
        <b>À plusieurs</b> (depuis l&apos;accueil){NBSP}: tout le monde a les mêmes parcours en même temps, en Défi ou en Survie (plus bas).
      </>,
    ],
    route: "Un parcours",
    routeList: [
      <>
        Tu as un pays de départ, un pays d&apos;arrivée, et une ou deux <b>frontières fermées</b> (en rouge){NBSP}: impossible de les traverser, alors contourne-les.
      </>,
      <>
        <b>Tape un pays</b> et choisis-le dans la liste, en français ou en anglais. Le parcours est fini dès que tes essais relient le départ à l&apos;arrivée, dans
        n&apos;importe quel sens.
      </>,
      <>
        Chaque essai a sa couleur{NBSP}: <b style={GREEN}>vert</b>, il est sur un plus court chemin{NNBSP}; <b style={YELLOW}>jaune</b>, sur un chemin d&apos;au plus deux
        pays de plus{NNBSP}; <b style={RED}>rouge</b>, il est hors parcours.
      </>,
      <>Les noms refusés (inconnus, absents de cette carte, le départ ou l&apos;arrivée, déjà essayés) ne coûtent rien.</>,
    ],
    scoring: "Le score",
    scoringList: [
      <>
        Le <b>par</b>, c&apos;est le nombre de pays entre les deux sur le plus court chemin ouvert.
      </>,
      <>
        <b>Ton score, c&apos;est ton temps, plus {N.penalty} secondes par essai au-delà du par.</b> Le plus bas l&apos;emporte.
      </>,
    ],
    racing: "À plusieurs",
    racingList: [
      <>
        <b>Défi</b>, de {N.challenge.min} à {N.challenge.max} joueurs{NBSP}: {ROUND_COUNTS.join(" ou ")} parcours, et le plus petit total gagne. Un parcours pas terminé
        compte comme le temps le plus lent, plus {N.dnf} s.
      </>,
      <>
        <b>Survie</b>, de {N.survival.min} à {N.survival.max} joueurs{NBSP}: après chaque parcours, les plus lents sont éliminés (deux tant qu&apos;il en reste plus de 4,
        puis un), jusqu&apos;à ce qu&apos;il n&apos;en reste qu&apos;un. {N.maxRounds} parcours au plus.
      </>,
      <>
        L&apos;hôte choisit le mode et la carte{NBSP}: une seule, ou une différente à chaque parcours. Les parcours s&apos;allongent au fil de la partie. En partie rapide,
        ça démarre tout seul.
      </>,
      <>Pendant la course, tu vois où en sont les autres, jamais par quels pays ils passent.</>,
    ],
    time: "Le temps",
    timeList: [
      <>En solo{NBSP}: le chrono tourne de Commencer jusqu&apos;à ce que le parcours soit relié.</>,
      <>
        En course{NBSP}: un compte à rebours de {N.countdown} secondes, puis {N.minutes} minutes par parcours, et {N.results} secondes de résultats entre deux.
      </>,
    ],
    maps: "Cartes et noms",
    mapsList: (maps) => [
      <>
        Cartes{NBSP}: {maps}. La carte du défi du jour change au fil de la semaine.
      </>,
      <>
        Les noms des pays s&apos;affichent dans la langue de la page (EN / FR en haut), mais tu peux toujours les taper dans l&apos;une ou l&apos;autre, avec ou sans
        accents.
      </>,
    ],
    tips: "Astuces",
    tipsList: [
      <>Regarde d&apos;abord la frontière fermée{NBSP}: tout le casse-tête, c&apos;est de la contourner.</>,
      <>Un essai jaune relie quand même. Ne cherche pas le parcours parfait quand le chrono tourne.</>,
      <>Une île ne se relie jamais par la terre.</>,
    ],
  },
});

/** A start and an end, a closed border between them, and a route around it: the guesses graded by colour. Boxes widen for a longer word ("Arrivée"). */
function RoutePicture({ start, end }: { start: string; end: string }) {
  const box = (x: number, y: number, fill: string, label: string, ink = "#fff") => {
    const width = Math.max(52, label.length * 8 + 8);
    return (
      <g>
        <rect x={x - width / 2} y={y - 15} width={width} height={30} rx={8} fill={fill} />
        <text x={x} y={y + 5} textAnchor="middle" fontSize={13} fontWeight={800} fill={ink}>
          {label}
        </text>
      </g>
    );
  };
  return (
    <svg aria-hidden="true" viewBox="0 0 300 130" className="mx-auto block h-[130px] w-full max-w-[320px]">
      <path d="M48 40 H252" stroke="var(--br-off)" strokeWidth={3} strokeDasharray="6 5" />
      <path d="M138 30 l16 20 m0 -20 l-16 20" stroke="var(--br-off)" strokeWidth={3.5} strokeLinecap="round" />
      <path d="M48 40 Q60 100 110 100 H190 Q240 100 252 40" stroke="var(--br-ink-soft)" strokeWidth={2.5} fill="none" />
      {box(44, 40, "var(--br-sign)", start)}
      {box(256, 40, "var(--br-sign)", end)}
      {box(110, 100, "var(--br-best)", "A")}
      {box(190, 100, "var(--br-best)", "B")}
      {box(150, 70, "var(--br-close)", "C", "var(--br-ink)")}
      {box(270, 105, "var(--br-off)", "D")}
    </svg>
  );
}

function Items({ items }: { items: ReactNode[] }) {
  return (
    <ul className={LIST}>
      {items.map((item, i) => (
        <li key={i}>{item}</li>
      ))}
    </ul>
  );
}

function RulesContent({ lang }: { lang: Lang }) {
  const r = RULES[lang];
  return (
    <div className="grid gap-5">
      <Section title={r.goal}>
        <p className={P}>{r.goalText}</p>
      </Section>

      <Section title={r.ways}>
        <Items items={r.waysList} />
      </Section>

      <Section title={r.route}>
        <RoutePicture start={r.start} end={r.end} />
        <Items items={r.routeList} />
      </Section>

      <Section title={r.scoring}>
        <Items items={r.scoringList} />
      </Section>

      <Section title={r.racing}>
        <Items items={r.racingList} />
      </Section>

      <Section title={r.time}>
        <Items items={r.timeList} />
      </Section>

      <Section title={r.maps}>
        {/* Joined with commas, not "and": one map is "Europe and Asia". */}
        <Items items={r.mapsList(AREAS.map((area) => AREA_NAME[area][lang]).join(", "))} />
      </Section>

      <Section title={r.tips}>
        <Items items={r.tipsList} />
      </Section>
    </div>
  );
}

/**
 * Detour's How to play (docs/how-to-play.md, on the shared
 * components/HowToPlay.tsx), in the page's language: `variant` "icon" is the
 * ? at the right of the header (solo page and race rooms), "link" the race
 * lobby's "How to play".
 */
export default function RulesButton({ variant = "icon" }: { variant?: "icon" | "link" }) {
  const lang = useLang();
  const title = RULES[lang].title;
  return (
    <HowToPlay look={LOOK} variant={variant} title={title} label={title}>
      <RulesContent lang={lang} />
    </HowToPlay>
  );
}
