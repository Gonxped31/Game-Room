"use client";

import type { ReactNode } from "react";
import HowToPlay, { type HowToPlayLook } from "@/components/HowToPlay";
import { ITEMS_PER_ROUND } from "@/lib/games/ftw/constants";
import { matchCount } from "@/lib/games/ftw/scoring";
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

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="grid gap-2">
      <h3 className={`${DISPLAY} m-0 text-[20px]`}>{title}</h3>
      {children}
    </section>
  );
}

const P = "m-0 text-[15px] leading-snug text-[var(--muted)] [&_b]:text-[var(--ink)]";
const LIST = `${P} grid gap-1.5 pl-5`;

/** The worked example: the same five items, as the ranker and the guesser numbered them. */
const ITEMS = ["Pizza", "Tacos", "Sushi", "Curry", "Salad"];
const RANKED = [1, 2, 3, 4, 5];
const GUESSED = [1, 3, 2, 4, 5];

function Example() {
  const score = matchCount(
    RANKED.map((n) => ITEMS[n - 1]),
    GUESSED.map((n) => ITEMS[n - 1]),
  );
  return (
    <div aria-hidden="true" className="grid gap-2 rounded-xl border-2 border-[var(--rule)] bg-white p-3">
      <div className="grid grid-cols-[auto_repeat(5,minmax(0,1fr))] items-center gap-x-2 gap-y-1.5 text-center text-[13px] font-bold">
        <span />
        {ITEMS.map((item) => (
          <span key={item} className="truncate">
            {item}
          </span>
        ))}
        <span className="text-left">Ranker</span>
        {RANKED.map((n, i) => (
          <span key={i} className="flex justify-center">
            <StickyNote n={n} size={30} />
          </span>
        ))}
        <span className="text-left">Guesser</span>
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
      <p className={`${DISPLAY} m-0 text-center text-[17px]`}>{score} points for the guesser</p>
    </div>
  );
}

function RulesContent() {
  return (
    <div className="grid gap-5">
      <Section title="The goal">
        <p className={P}>
          <b>Read your partner&apos;s mind.</b> One of you ranks {ITEMS_PER_ROUND} things from best to worst; the other guesses that order. The closer the guess, the more
          points.
        </p>
      </Section>

      <Section title="Players">
        <ul className={LIST}>
          <li>Two players, each on their own phone or computer. Share the room link with your partner.</li>
          <li>
            Each round, one of you is the <b>ranker</b> and the other the <b>guesser</b>. You swap every round.
          </li>
        </ul>
      </Section>

      <Section title="A round">
        <ol className={LIST}>
          <li>
            A prompt and {ITEMS_PER_ROUND} items appear, like &ldquo;Best pizza toppings&rdquo;.
          </li>
          <li>
            <b>The ranker</b> puts a sticky note on each item, 1 (best) to {ITEMS_PER_ROUND} (worst), then taps <b>Lock my ranking</b>. The guesser can&apos;t see it.
          </li>
          <li>
            <b>The guesser</b> does the same, trying to match the ranker, then taps <b>Lock my guess</b>.
          </li>
          <li>Both orders are revealed side by side, and the round is scored. Then tap Next round.</li>
        </ol>
        <p className={P}>Tap a note, then an item (or drag it). Tap a placed note to take it back, or to swap it with another.</p>
      </Section>

      <Section title="Scoring">
        <Example />
        <ul className={LIST}>
          <li>
            <b>The guesser scores a point for every item with the same note as the ranker&apos;s</b>: 0 to {ITEMS_PER_ROUND}.
          </li>
          <li>
            You can&apos;t score {ITEMS_PER_ROUND - 1}: with {ITEMS_PER_ROUND - 1} notes matching, the last one matches too.
          </li>
          <li>Points add up across rounds, and you take turns guessing, so it stays even. Play as many rounds as you like.</li>
        </ul>
      </Section>

      <Section title="Time">
        <p className={P}>
          <b>No clock.</b> Play live, or take your turn whenever you like: the room keeps your place, and your partner sees when you&apos;ve locked in.
        </p>
      </Section>

      <Section title="Prompts">
        <ul className={LIST}>
          <li>
            <b>The ranker picks the topics</b> the prompts come from (any topic by default).
          </li>
          <li>
            Before ranking, the ranker can <b>Shuffle prompt</b> for another one, or write their own prompt and {ITEMS_PER_ROUND} items.
          </li>
          <li>A prompt doesn&apos;t come back until you&apos;ve seen every one in your topics.</li>
        </ul>
      </Section>

      <Section title="Tips">
        <ul className={LIST}>
          <li>Ranking: be yourself. A ranking your partner can predict scores more than a clever one.</li>
          <li>Guessing: think about what your partner loves, not what you&apos;d pick.</li>
          <li>The ends are easiest: nail the 1 and the {ITEMS_PER_ROUND} first.</li>
        </ul>
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
