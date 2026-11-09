"use client";

import type { SeatId } from "@/lib/session/types";
import type { Card } from "@/lib/games/buzzerquiz/constants";
import { useText } from "@/lib/i18n/useLang";
import { DISPLAY, FOCUS, seatColor, TEXT } from "./ui";
import { WORDS } from "./text";

/**
 * Power cards (constants.ts `CARDS`; the host's switch): the player's hand,
 * played one per question during the countdown or before buzzing, and the
 * row that shows everyone who played what on this question.
 */
export const CARD_GLYPHS: Record<Card, string> = { freeze: "❄", double: "×2", fifty: "½", steal: "+1", shield: "◆" };

/** A card's name, effect (in the page's language, text.ts `cards`) and glyph. */
export function useCardInfo(): (card: Card) => { name: string; effect: string; glyph: string } {
  const cards = useText(WORDS).cards;
  return (card) => ({ ...cards[card], glyph: CARD_GLYPHS[card] });
}

/**
 * This player's cards: a button each. `canPlay` is false once they've played
 * one this question, buzzed or been locked out; Freeze only works during the
 * countdown (`freezeOk`).
 */
export function PowerHand({ hand, canPlay, freezeOk, onPlay }: { hand: Card[]; canPlay: boolean; freezeOk: boolean; onPlay: (card: Card) => void }) {
  const t = useText(WORDS);
  const cardInfo = useCardInfo();
  if (!hand.length) return <p className={`${TEXT} m-0 text-center text-[14px] text-[var(--text-muted)]`}>{t.noCardsLeft}</p>;
  return (
    <section aria-label={t.yourCards} className="flex w-full max-w-[560px] flex-col gap-2">
      <h2 className={`${TEXT} m-0 text-center text-[13px] font-bold uppercase tracking-[0.07em] text-[var(--text-muted)]`}>
        {canPlay ? t.playACard : t.yourCards}
      </h2>
      <ul className="m-0 grid list-none grid-cols-3 gap-2 p-0">
        {hand.map((card) => {
          const info = cardInfo(card);
          const enabled = canPlay && (card !== "freeze" || freezeOk);
          return (
            <li key={card}>
              <button
                type="button"
                disabled={!enabled}
                onClick={() => onPlay(card)}
                aria-label={t.playCardLabel(info.name, info.effect)}
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
  const t = useText(WORDS);
  const cardInfo = useCardInfo();
  const plays = players.filter((seat) => played[seat]);
  if (!plays.length) return null;
  return (
    <ul aria-label={t.cardsPlayed} className="m-0 flex list-none flex-wrap justify-center gap-2 p-0">
      {plays.map((seat) => {
        const info = cardInfo(played[seat]!);
        return (
          <li key={seat} className={`${TEXT} flex items-center gap-1.5 rounded-full bg-[var(--surface)] py-1 pr-3 pl-1 text-[14px] font-bold`}>
            <span aria-hidden="true" className="flex h-6 min-w-6 items-center justify-center rounded-full px-1 text-[12px] font-extrabold text-[var(--ink)]" style={{ background: seatColor(seat) }}>
              {info.glyph}
            </span>
            {t.playedCard(seat === me ? null : (names[seat] ?? t.someone), info.name)}
          </li>
        );
      })}
    </ul>
  );
}
