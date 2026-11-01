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
/** The worked example: a 5-letter word. */
const WORD = "TIGER";
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
const LIST = `${P} grid gap-1.5 pl-5`;

/** The scrambled tiles, and the answer with one hint letter placed. */
function Board() {
  return (
    <div aria-hidden="true" className="grid justify-items-center gap-4 rounded-2xl bg-[var(--board)] px-3 pt-4 pb-5">
      <div className="flex gap-1.5">
        {SCRAMBLED.map((letter, i) => (
          <Tile key={i} letter={letter} look="wood" size={38} tilt={i % 2 ? 3 : -3} />
        ))}
      </div>
      <div className="flex gap-1.5">
        <Tile letter={WORD[0]} look="team" team="A" size={38} hintMark />
        {WORD.slice(1)
          .split("")
          .map((_, i) => (
            <Slot key={i} size={38} />
          ))}
      </div>
    </div>
  );
}

function RulesContent() {
  return (
    <div className="grid gap-5">
      <Section title="The goal">
        <p className={P}>
          <b>Two teams take turns unscrambling a word against the clock.</b> The team with the most points at the end wins.
        </p>
      </Section>

      <Section title="Teams">
        <ul className={LIST}>
          <li>
            2 to {MAX_PLAYERS} players in two even teams (1 v 1 up to 4 v 4). Pick your team in the lobby.
          </li>
          <li>
            <b>In a private room</b>, the host (who made the room) sets the language and the length, then starts once the teams are even.
          </li>
          <li>
            <b>In matchmaking</b> there&apos;s no host: the default settings, teams evened out for you, and the game starts by itself.
          </li>
        </ul>
      </Section>

      <Section title="A turn">
        <Board />
        <ol className={LIST}>
          <li>
            Your team gets {MIN_WORD} to {MAX_WORD} scrambled letters and <b>{seconds(TURN_MS)} seconds</b>. The other team watches.
          </li>
          <li>
            Anyone on your team can answer, each on their own device: tap the letters in order (or drag them into the slots; on a keyboard, type them), then{" "}
            <b>Confirm</b>. Wrong guesses cost nothing: try again.
          </li>
          <li>
            Stuck? <b>Hint</b> places the next letter for you, for 1 point. No hint once only {MIN_LETTERS_LEFT} letters are left to find.
          </li>
        </ol>
      </Section>

      <Section title="Scoring">
        <ul className={LIST}>
          <li>
            <b>A word is worth its letters, minus 1 per hint:</b> {WORD} scores {worth(WORD, 0)}, or {worth(WORD, 1)} with one hint.
          </li>
          <li>
            <b>Steals:</b> if time runs out, the other team has {seconds(STEAL_OFFER_MS)} s to tap <b>Steal!</b>. The first to tap gets {seconds(STEAL_MS)} s and one try,
            for half the word&apos;s worth, rounded up ({worth(WORD, 1)} → {stealValue(WORD, 1)}). Right, they win it; wrong or too slow, they lose it, so a score can go
            below zero.
          </li>
          <li>A team&apos;s second word each round has the same length as the first team&apos;s, so the game stays fair.</li>
        </ul>
      </Section>

      <Section title="Time">
        <ul className={LIST}>
          <li>
            {seconds(START_LEAD_MS)} s to get ready, then <b>{seconds(TURN_MS)} s</b> a turn.
          </li>
          <li>
            Steals: {seconds(STEAL_OFFER_MS)} s to claim, {seconds(STEAL_MS)} s to answer.
          </li>
        </ul>
      </Section>

      <Section title="Game length">
        <ul className={LIST}>
          <li>
            <b>Turns:</b> {TURNS_PER_TEAM.min} to {TURNS_PER_TEAM.max} words per team ({TURNS_PER_TEAM.default} by default). Most points after the last word wins.
          </li>
          <li>
            <b>Target:</b> first to {TARGETS.join(", ")} points. Both teams always get the same number of turns, and it stops after {TARGET_TURN_CAP} each.
          </li>
          <li>A tie is a draw. Words come in English or French.</li>
        </ul>
      </Section>

      <Section title="Tips">
        <ul className={LIST}>
          <li>Split up: one teammate tries endings (-ING, -ER), another the first letter.</li>
          <li>A hint early on is cheap insurance against a steal.</li>
          <li>Watching team: work it out too, and be first to Steal.</li>
        </ul>
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
