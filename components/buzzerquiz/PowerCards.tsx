"use client";

import type { SeatId } from "@/lib/session/types";
import { type Card, FREEZE_MS } from "@/lib/games/buzzerquiz/constants";
import { DISPLAY, FOCUS, seatColor, TEXT } from "./ui";

/**
 * Power cards (constants.ts `CARDS`; the host's switch): the player's hand,
 * played one per question during the countdown or before buzzing, and the
 * row that shows everyone who played what on this question.
 */
export const CARD_INFO: Record<Card, { name: string; effect: string; glyph: string }> = {
  freeze: { name: "Freeze", effect: `The others can't buzz for ${FREEZE_MS / 1000} s`, glyph: "❄" },
  double: { name: "Double", effect: "Right answer: double points", glyph: "×2" },
  fifty: { name: "50/50", effect: "Two wrong answers vanish for you", glyph: "½" },
  steal: { name: "Steal", effect: "Someone else right: take 1 point", glyph: "+1" },
  shield: { name: "Shield", effect: "Wrong: you can buzz again", glyph: "◆" },
};

/**
 * This player's cards: a button each. `canPlay` is false once they've played
 * one this question, buzzed or been locked out; Freeze only works during the
 * countdown (`freezeOk`).
 */
export function PowerHand({ hand, canPlay, freezeOk, onPlay }: { hand: Card[]; canPlay: boolean; freezeOk: boolean; onPlay: (card: Card) => void }) {
  if (!hand.length) return <p className={`${TEXT} m-0 text-center text-[14px] text-[var(--text-muted)]`}>No power cards left.</p>;
  return (
    <section aria-label="Your power cards" className="flex w-full max-w-[560px] flex-col gap-2">
      <h2 className={`${TEXT} m-0 text-center text-[13px] font-bold uppercase tracking-[0.07em] text-[var(--text-muted)]`}>
        {canPlay ? "Play a power card" : "Your power cards"}
      </h2>
      <ul className="m-0 grid list-none grid-cols-3 gap-2 p-0">
        {hand.map((card) => {
          const info = CARD_INFO[card];
          const enabled = canPlay && (card !== "freeze" || freezeOk);
          return (
            <li key={card}>
              <button
                type="button"
                disabled={!enabled}
                onClick={() => onPlay(card)}
                aria-label={`Play ${info.name}: ${info.effect}`}
                className={`${FOCUS} flex h-full w-full cursor-pointer flex-col items-center gap-1 rounded-2xl border-2 border-[var(--points)] bg-[var(--surface)] px-2 py-2.5 text-center text-[var(--text)] transition-transform duration-75 enabled:active:translate-y-1 disabled:cursor-not-allowed disabled:border-[var(--disabled-ring)] disabled:opacity-60 motion-reduce:transition-none`}
              >
                <span aria-hidden="true" className={`${DISPLAY} flex h-8 w-8 items-center justify-center rounded-full bg-[var(--points)] text-[15px] font-extrabold text-[var(--ink)]`}>
                  {info.glyph}
                </span>
                <span className={`${DISPLAY} text-[15px] font-extrabold leading-tight`}>{info.name}</span>
                <span className={`${TEXT} text-[12px] leading-snug text-[var(--text-muted)]`}>{info.effect}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/** Who played what on this question, for everyone to see. */
export function PlayedRow({ played, players, names, me }: { played: Partial<Record<SeatId, Card>>; players: SeatId[]; names: Partial<Record<SeatId, string>>; me: SeatId | null }) {
  const plays = players.filter((seat) => played[seat]);
  if (!plays.length) return null;
  return (
    <ul aria-label="Power cards played" className="m-0 flex list-none flex-wrap justify-center gap-2 p-0">
      {plays.map((seat) => {
        const info = CARD_INFO[played[seat]!];
        return (
          <li key={seat} className={`${TEXT} flex items-center gap-1.5 rounded-full bg-[var(--surface)] py-1 pr-3 pl-1 text-[14px] font-bold`}>
            <span aria-hidden="true" className="flex h-6 min-w-6 items-center justify-center rounded-full px-1 text-[12px] font-extrabold text-[var(--ink)]" style={{ background: seatColor(seat) }}>
              {info.glyph}
            </span>
            {seat === me ? "You" : (names[seat] ?? "Someone")} played {info.name}
          </li>
        );
      })}
    </ul>
  );
}
