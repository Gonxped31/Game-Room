"use client";

import type { ButtonHTMLAttributes, ReactNode } from "react";
import HowToPlay, { type HowToPlayLook } from "@/components/HowToPlay";
import { AREA_NAME } from "@/lib/games/borderrun/areas";
import { AREAS, PENALTY_MS } from "@/lib/games/borderrun/constants";
import { ROUND_MS } from "@/lib/games/borderrun/race";
import { COUNTDOWN_MS, DNF_EXTRA_MS, MAX_ROUNDS, PLAYERS, RESULTS_MS, ROUND_COUNTS } from "@/lib/games/race/race";

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
 * Border Run's look for the shared dialog: the warm card, the green road-sign
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

/** A start and an end, a closed border between them, and a route around it: the guesses graded by colour. */
function RoutePicture() {
  const box = (x: number, y: number, fill: string, label: string, ink = "#fff") => (
    <g>
      <rect x={x - 26} y={y - 15} width={52} height={30} rx={8} fill={fill} />
      <text x={x} y={y + 5} textAnchor="middle" fontSize={13} fontWeight={800} fill={ink}>
        {label}
      </text>
    </g>
  );
  return (
    <svg aria-hidden="true" viewBox="0 0 300 130" className="mx-auto block h-[130px] w-full max-w-[320px]">
      <path d="M48 40 H252" stroke="var(--br-off)" strokeWidth={3} strokeDasharray="6 5" />
      <path d="M138 30 l16 20 m0 -20 l-16 20" stroke="var(--br-off)" strokeWidth={3.5} strokeLinecap="round" />
      <path d="M48 40 Q60 100 110 100 H190 Q240 100 252 40" stroke="var(--br-ink-soft)" strokeWidth={2.5} fill="none" />
      {box(44, 40, "var(--br-sign)", "Start")}
      {box(256, 40, "var(--br-sign)", "End")}
      {box(110, 100, "var(--br-best)", "A")}
      {box(190, 100, "var(--br-best)", "B")}
      {box(150, 70, "var(--br-close)", "C", "var(--br-ink)")}
      {box(270, 105, "var(--br-off)", "D")}
    </svg>
  );
}

function RulesContent() {
  return (
    <div className="grid gap-5">
      <Section title="The goal">
        <p className={P}>
          <b>Link two countries by land.</b> Name the countries in between until your guesses join the start to the end, through open borders only. Fast and with few
          guesses is best.
        </p>
      </Section>

      <Section title="Ways to play">
        <ul className={LIST}>
          <li>
            <b>Daily route</b>: the same route for everyone today, one try, your time on the day&apos;s leaderboard. A new one at midnight (Toronto time).
          </li>
          <li>
            <b>Endless</b>: pick a map, then Start. New route keeps the map; Show a route gives up and draws one.
          </li>
          <li>
            <b>With others</b> (from the hub): everyone gets the same routes at the same time, in Challenge or Survival (below).
          </li>
        </ul>
      </Section>

      <Section title="A route">
        <RoutePicture />
        <ul className={LIST}>
          <li>
            You get a start and an end country, and one or two <b>closed borders</b> (red): you can&apos;t cross them, so go around.
          </li>
          <li>
            <b>Type a country</b> and pick it from the list, in English or French. The route is done once your guesses link start to end, any way round.
          </li>
          <li>
            Each guess is coloured: <b style={{ color: "var(--br-best)" }}>green</b> is on a shortest route, <b style={{ color: "var(--br-close)" }}>yellow</b> on one at most
            two countries longer, <b style={{ color: "var(--br-off)" }}>red</b> is off the way.
          </li>
          <li>Names it can&apos;t take (unknown, not on this map, the start or end, a repeat) cost nothing.</li>
        </ul>
      </Section>

      <Section title="Scoring">
        <ul className={LIST}>
          <li>
            The <b>par</b> is how many countries the shortest open route has in between.
          </li>
          <li>
            <b>Your score is your time, plus {seconds(PENALTY_MS)} seconds for every guess past the par.</b> Lower is better.
          </li>
        </ul>
      </Section>

      <Section title="Racing others">
        <ul className={LIST}>
          <li>
            <b>Challenge</b>, {PLAYERS.challenge.min} to {PLAYERS.challenge.max} players: {ROUND_COUNTS.join(" or ")} routes, and the lowest total wins. An unfinished
            route counts as the slowest finish plus {seconds(DNF_EXTRA_MS)} s.
          </li>
          <li>
            <b>Survival</b>, {PLAYERS.survival.min} to {PLAYERS.survival.max} players: after each route the slowest are out (two while more than 4 are left, then one),
            until one is left. At most {MAX_ROUNDS} routes.
          </li>
          <li>
            The host picks the mode and the map: one, or a different one each route. Routes get longer as you go. Matchmaking starts by itself.
          </li>
          <li>While you play, you see how far the others have got, never which countries.</li>
        </ul>
      </Section>

      <Section title="Time">
        <ul className={LIST}>
          <li>Solo: the clock runs from Start until the route is linked.</li>
          <li>
            Races: a {seconds(COUNTDOWN_MS)}-second countdown, then {seconds(ROUND_MS) / 60} minutes per route, and {seconds(RESULTS_MS)} seconds of results in between.
          </li>
        </ul>
      </Section>

      <Section title="Maps and names">
        <ul className={LIST}>
          <li>Maps: {AREAS.map((area) => AREA_NAME[area].en).join(", ")}. The daily route changes map through the week.</li>
          <li>The EN / FR switch only changes how names show: you can always type either language, accents or not.</li>
        </ul>
      </Section>

      <Section title="Tips">
        <ul className={LIST}>
          <li>Look at the closed border first: the way around it is the whole puzzle.</li>
          <li>A yellow guess still links. Don&apos;t chase the perfect route if the clock is running.</li>
          <li>Islands never link by land.</li>
        </ul>
      </Section>
    </div>
  );
}

/**
 * Border Run's How to play (docs/how-to-play.md, on the shared
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
