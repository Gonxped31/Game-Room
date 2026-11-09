"use client";

import type { Team } from "@/lib/games/wordscramble/teams";
import { useText } from "@/lib/i18n/useLang";
import {
  BulbIcon,
  CheckIcon,
  ChunkyButton,
  DISPLAY,
  EyeIcon,
  FOCUS,
  LABEL,
  LockIcon,
  ScorePill,
  Slot,
  teamColor,
  teamText,
  TEXT,
  Tile,
  TimerRing,
} from "./ui";
import { SCREEN } from "./Screens";
import TileBoard from "./TileBoard";
import RulesButton from "./Rules";
import { COPY } from "./text";

/** Everything a turn shows, derived by the page from the game state and the clock. */
export interface TurnView {
  /** "stealOffer": time ran out, the other team may tap Steal. "stealing": one of them is trying. */
  phase: "turn" | "stealOffer" | "stealing" | "result";
  team: Team;
  /** This device's player is on the playing team. */
  playing: boolean;
  /** This device's player's team (spectators: undefined). */
  myTeam?: Team;
  teamNames: string[];
  turnLabel: string;
  scores: Record<Team, number>;
  /** The scrambled letters, in order. */
  scrambled: string[];
  /** The answer's letters (uppercase, no accents). */
  answer: string[];
  /** The real spelling, for the reveal. */
  word: string;
  hints: number;
  worth: number;
  canHint: boolean;
  guesses: { name: string; text: string }[];
  typing: string[];
  found?: { name: string; seconds: number; points: number };
  /** The clock of the current phase: the turn, the steal offer, or the steal. */
  seconds: number;
  fraction: number;
  nextTeam: Team;
  nextSeconds: number;
  /** "+4 Team A · 5 letters − 1 hint". */
  pointsLine?: string;
  /** What a steal wins or loses. */
  stealValue: number;
  /** Who is stealing (phase "stealing"), and whether it's this device's player. */
  stealerName?: string;
  isStealer: boolean;
  /** How the steal went, on the result: its player and the points won (+) or lost (-). */
  stolen?: { name: string; points: number };
}

export default function TurnScreen({ view, onGuess, onHint, onTyping, onSteal }: {
  view: TurnView;
  /** Returns whether the guess was right. */
  onGuess: (text: string) => boolean;
  onHint: () => void;
  onTyping: () => void;
  onSteal: () => void;
}) {
  const t = useText(COPY);
  const { team, playing, phase } = view;
  const thief = view.nextTeam; // the team that may steal
  const done = phase === "result";
  const right = done && view.found != null;
  const stolenRight = done && view.stolen != null && view.stolen.points > 0;
  const canClaim = phase === "stealOffer" && view.myTeam === thief;
  const arranging = (phase === "turn" && playing) || (phase === "stealing" && view.isStealer);

  // Which scrambled tiles the hints have already used (35% opacity in the row).
  const placed = view.answer.slice(0, view.hints);
  const used = new Set<number>();
  for (const letter of placed) {
    const i = view.scrambled.findIndex((l, j) => l === letter && !used.has(j));
    if (i >= 0) used.add(i);
  }

  // Phones: 56 px tiles, shrunk so an 8-letter word still fits one row at 375 px (343 px of content).
  const phoneTile = Math.min(56, Math.floor((340 - (view.answer.length - 1) * 6) / view.answer.length));

  const tiles = (size: number) => {
    if (right || stolenRight) {
      return view.answer.map((l, i) => <Tile key={i} letter={l} look="right" size={size} lift={i % 2 ? -4 : 2} />);
    }
    if (done) {
      return view.answer.map((l, i) => <Tile key={i} letter={l} look={i < view.hints ? "team" : "revealed"} team={team} size={size} />);
    }
    return view.answer.map((l, i) => (i < view.hints ? <Tile key={i} letter={l} look="team" team={team} size={size} hintMark={size < 70} /> : <Slot key={i} size={size} />));
  };

  const board = (size: number) => (
    <div className="flex flex-col items-center gap-5">
      {!done ? (
        <div role="img" aria-label={t.scrambledAria(view.scrambled)} className={`flex justify-center ${size < 70 ? "gap-1.5" : "gap-2"}`}>
          {view.scrambled.map((l, i) => (
            <Tile key={i} letter={l} look={used.has(i) ? "used" : "wood"} size={size} tilt={((i * 37) % 11) - 5} />
          ))}
        </div>
      ) : null}
      <div role="img" aria-label={done ? t.wordWas(view.word) : t.answerAria(placed, view.answer.length - view.hints)} className={`flex justify-center ${size < 70 ? "gap-1.5" : "gap-2"}`}>
        {tiles(size)}
      </div>
    </div>
  );

  const stakes = t.stakes(view.stealValue);
  // The result says what happened; a "Your team's turn" banner above it would only confuse.
  let banner = null;
  if (done) {
    banner = null;
  } else if (phase === "stealOffer") {
    banner = canClaim ? (
      <div role="status" className="flex flex-col gap-3 rounded-[18px] border-[3px] border-[var(--ink)] px-4 py-3 min-[600px]:flex-row min-[600px]:items-center" style={{ background: teamColor(thief), color: teamText(thief) }}>
        <div className="flex-1">
          <p className={`${DISPLAY} m-0 text-[24px] min-[900px]:text-[30px]`}>{t.stealIt}</p>
          <p className={`${TEXT} m-0 text-[15px] font-extrabold`}>{t.oneTry(stakes)}</p>
        </div>
        <ChunkyButton white className="min-h-14 px-6 text-[20px]" onClick={onSteal}>
          {t.stealButton}
        </ChunkyButton>
      </div>
    ) : (
      <div role="status" className="flex items-center gap-2.5 rounded-[18px] border-[3px] bg-white px-4 py-2.5" style={{ borderColor: teamColor(thief) }}>
        <span className={`${DISPLAY} flex-1 text-[20px] min-[900px]:text-[26px]`}>{t.canSteal(thief)}</span>
      </div>
    );
  } else if (phase === "stealing") {
    banner = (
      <div role="status" className="flex items-center justify-between gap-3 rounded-[18px] border-[3px] border-[var(--ink)] px-4 py-2.5" style={{ background: teamColor(thief), color: teamText(thief) }}>
        <span className={`${DISPLAY} text-[22px] min-[900px]:text-[28px]`}>{view.isStealer ? t.youreStealing : t.isStealing(view.stealerName ?? "")}</span>
        <span className={`${TEXT} text-[14px] font-extrabold`}>{stakes}</span>
      </div>
    );
  } else if (playing) {
    banner = (
      <div className="flex items-center justify-between gap-3 rounded-[18px] border-[3px] border-[var(--ink)] px-4 py-2.5" style={{ background: teamColor(team), color: teamText(team) }}>
        <span className={`${DISPLAY} text-[22px] min-[900px]:text-[28px]`}>{t.yourTeamsTurn}</span>
        <span className={`${TEXT} truncate text-[14px] font-extrabold`}>{view.teamNames.join(" · ")}</span>
      </div>
    );
  } else {
    banner = (
      <div className="flex items-center gap-2.5 rounded-[18px] border-[3px] bg-white px-4 py-2.5" style={{ borderColor: teamColor(team) }}>
        <span style={{ color: teamColor(team) }}>
          <EyeIcon />
        </span>
        <span className={`${DISPLAY} flex-1 text-[20px] min-[900px]:text-[26px]`}>{t.teamPlaying(team)}</span>
        {view.myTeam ? <span className={`${TEXT} text-[14px] font-extrabold text-[var(--muted)]`}>{view.myTeam === view.nextTeam ? t.youreNext : ""}</span> : null}
      </div>
    );
  }

  const worth =
    phase === "turn" ? (
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className={`${DISPLAY} m-0 text-[24px] min-[900px]:text-[26px]`}>{t.worthPoints(view.worth)}</p>
          <p className={`${TEXT} m-0 text-[14px] font-bold text-[var(--muted)]`}>
            {t.lettersHints(view.answer.length, view.hints)}
          </p>
        </div>
        {playing ? (
          <button
            type="button"
            onClick={onHint}
            disabled={!view.canHint}
            className={`${TEXT} ${FOCUS} flex h-12 cursor-pointer items-center gap-1.5 rounded-xl border-2 border-[var(--ink)] bg-white px-3.5 text-[16px] font-extrabold shadow-[0_4px_0_var(--ink)] active:translate-y-1 active:shadow-none disabled:cursor-not-allowed disabled:opacity-45 disabled:shadow-none`}
          >
            <BulbIcon /> {t.hint} <span className="text-[var(--wrong)]">−1</span>
          </button>
        ) : null}
      </div>
    ) : (
      <p className={`${DISPLAY} m-0 text-[24px] min-[900px]:text-[26px]`}>{t.stealFor(view.stealValue)}</p>
    );

  const locked = (
    <p className={`${TEXT} m-0 flex min-h-14 items-center justify-center gap-2 rounded-2xl border-[3px] border-dashed border-[var(--slot)] px-3 text-center text-[15px] font-bold text-[var(--muted)]`}>
      <LockIcon /> {view.myTeam ? t.guessOnTurn(view.myTeam) : t.watchingLocked}
    </p>
  );

  const feed = (
    <section className="flex flex-col gap-2 rounded-[20px] border-2 border-[var(--line)] bg-white p-3.5">
      <h2 className={LABEL}>{playing ? t.teamGuesses : t.teamsGuesses(team)}</h2>
      <ul aria-live="polite" className="m-0 flex list-none flex-col gap-1.5 p-0">
        {view.guesses.map((g, i) => (
          <li key={i} className={`${TEXT} flex items-center gap-2 text-[15px] font-bold`}>
            <span className="w-16 shrink-0 truncate text-[var(--muted)]">{g.name}</span>
            <span className={`${DISPLAY} flex-1 truncate text-[18px] tracking-[0.08em] line-through decoration-[var(--wrong)] decoration-2`}>{g.text}</span>
            <span className="text-[13px] text-[var(--wrong)]">{t.notIt}</span>
          </li>
        ))}
        {view.found ? (
          <li className={`${TEXT} flex items-center gap-2 rounded-xl bg-[var(--right-tint)] px-2 py-1.5 text-[15px] font-bold text-[var(--right-ink)]`}>
            <CheckIcon />
            <span className="w-16 shrink-0 truncate">{view.found.name}</span>
            <span className={`${DISPLAY} flex-1 text-[18px] tracking-[0.08em]`}>{view.answer.join("")}</span>
          </li>
        ) : null}
        {phase === "turn" && view.typing.length ? <li className={`${TEXT} text-[14px] italic text-[var(--muted)]`}>{t.arranging(view.typing)}</li> : null}
        {!view.guesses.length && !view.found && !(phase === "turn" && view.typing.length) ? <li className={`${TEXT} text-[14px] text-[var(--muted)]`}>{t.noGuesses}</li> : null}
      </ul>
      <p className={`${TEXT} m-0 hidden text-[13px] text-[var(--muted)] min-[900px]:block`}>{t.wrongCostsNothing}</p>
    </section>
  );

  let result = null;
  if (done) {
    const s = view.stolen;
    const title = right ? t.gotIt : s ? (s.points > 0 ? t.stolen : t.stealMissed) : t.timesUp;
    const word = view.word.toUpperCase();
    const line = right ? t.foundBy(view.found!.name, view.found!.seconds) : s ? (s.points > 0 ? t.stole(s.name, word) : t.missed(s.name, word)) : t.wordWas(word);
    const points = right ? view.pointsLine : s ? t.stealPoints(`${s.points > 0 ? "+" : "−"}${Math.abs(s.points)}`, thief) : t.noPoints(team);
    result = (
      <div role="status" className="flex flex-col items-center gap-2 text-center">
        <p className={`${DISPLAY} m-0 text-[34px] min-[900px]:text-[48px]`} style={{ color: s && s.points < 0 ? "var(--wrong)" : undefined }}>
          {title}
        </p>
        <p className={`${TEXT} m-0 text-[16px] font-bold text-[var(--muted)]`}>{line}</p>
        <p className={`${TEXT} m-0 rounded-2xl border-[3px] border-[var(--ink)] bg-white px-4 py-2 text-[17px] font-extrabold`}>{points}</p>
        <p className={`${DISPLAY} m-0 rounded-full px-4 py-2 text-[18px]`} style={{ background: teamColor(view.nextTeam), color: teamText(view.nextTeam) }}>
          {t.playsNext(view.nextTeam)}
        </p>
      </div>
    );
  }

  const clockTeam = phase === "turn" ? team : thief;
  return (
    <div className={SCREEN}>
      <div className="mx-auto flex max-w-[1100px] flex-col gap-3 min-[900px]:gap-5">
        <header className="flex items-center gap-2">
          <ScorePill team="A" score={view.scores.A} glow={(right && team === "A") || (stolenRight && thief === "A")} />
          <span className={`${TEXT} flex-1 text-center text-[14px] font-extrabold text-[var(--muted)]`}>{view.turnLabel}</span>
          <ScorePill team="B" score={view.scores.B} glow={(right && team === "B") || (stolenRight && thief === "B")} />
          {!done ? <TimerRing seconds={view.seconds} fraction={view.fraction} team={clockTeam} size={46} label={t.secondsLeft(view.seconds)} /> : null}
          <RulesButton />
        </header>
        {banner}
        <div className="flex flex-col gap-4 min-[900px]:grid min-[900px]:grid-cols-[1fr_minmax(260px,340px)] min-[900px]:items-start min-[900px]:gap-6">
          <main className="flex flex-col gap-4 min-[900px]:rounded-[26px] min-[900px]:bg-[var(--board)] min-[900px]:p-8">
            {arranging ? (
              <TileBoard
                key={`${phase}:${view.scrambled.join("")}:${view.hints}`}
                scrambled={view.scrambled}
                answer={view.answer}
                hints={view.hints}
                team={phase === "stealing" ? thief : team}
                phoneTile={phoneTile}
                onConfirm={onGuess}
                onArrange={onTyping}
              />
            ) : (
              <>
                <div className="min-[900px]:hidden">{board(phoneTile)}</div>
                <div className="hidden min-[900px]:block">{board(76)}</div>
              </>
            )}
            {result}
            {!done ? (
              <div className="mx-auto flex w-full max-w-[560px] flex-col gap-3">
                {worth}
                {arranging || phase !== "turn" ? null : locked}
              </div>
            ) : null}
          </main>
          {feed}
        </div>
      </div>
    </div>
  );
}
