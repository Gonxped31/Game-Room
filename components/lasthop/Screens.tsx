"use client";

import { type ReactNode, useState } from "react";
import type { Role } from "@/lib/session/types";
import { ROOM_TEXT } from "@/lib/session/shared/roomActions";
import { useLang, useText } from "@/lib/i18n/useLang";
import LocalLink from "@/components/LocalLink";
import RoomDialog, { type RoomDialogProps } from "@/components/RoomDialog";
import { CLOCKS, MODES, type Mode, type Pawn, PAWNS } from "@/lib/games/lasthop/constants";
import { otherMode, type RoundResult, type Vote } from "@/lib/games/lasthop/game";
import { PawnShape } from "./pawns";
import { TEXT } from "./text";
import { FOCUS, FONT, formatClock, PieceMark, PrimaryButton, SecondaryButton, seatColor } from "./ui";

/** The page frame's title row: the wordmark, the match so far, and the How to play button (`rules`). */
export function Header({ round, score, rules }: { round?: number; score?: ReactNode; rules?: ReactNode }) {
  const t = useText(TEXT);
  return (
    <header className="flex items-center justify-between gap-3">
      <p className={`${FONT} m-0 text-[22px] font-extrabold tracking-[-0.01em] min-[640px]:text-[28px]`}>
        Last <span className="text-[var(--p1)]">H</span>
        <span className="text-[var(--p2)]">o</span>p
      </p>
      <div className="flex items-center gap-3">
        {round ? (
          <p className="m-0 text-right text-[14px] font-medium text-[var(--muted)]">
            {t.round(round)}
            {score ? <> · {score}</> : null}
          </p>
        ) : null}
        {rules}
      </div>
    </header>
  );
}

export function Message({ text, alert, home }: { text: string; alert?: boolean; home?: boolean }) {
  const t = useText(TEXT);
  return (
    <div className="rounded-2xl bg-[var(--surface)] px-4 py-3.5">
      <p role={alert ? "alert" : undefined} className="m-0 font-medium">
        {text}
      </p>
      {home ? (
        <LocalLink href="/" className="mt-2 inline-block font-bold text-[var(--p1)] underline">
          {t.allGames}
        </LocalLink>
      ) : null}
    </div>
  );
}

/** A player's strip: color, name, the moves they have, and their chess clock. */
export function PlayerBar({
  seat,
  pawn,
  name,
  isMe,
  clockMs,
  running,
  moves,
  online,
  wins,
}: {
  seat: Role;
  name: string;
  isMe: boolean;
  clockMs: number;
  running: boolean;
  /** How many legal moves they have right now. */
  moves: number;
  online: boolean;
  wins: number;
  pawn: Pawn;
}) {
  const lang = useLang();
  const t = TEXT[lang];
  const low = running && clockMs < 10_000;
  const clock = formatClock(clockMs, lang);
  return (
    <div
      className={`flex items-center gap-3 rounded-2xl px-3.5 py-2.5 transition-colors motion-reduce:transition-none ${running ? "bg-[var(--surface-2)]" : "bg-[var(--surface)]"}`}
      style={running ? { boxShadow: `inset 0 0 0 2px ${seatColor(seat)}` } : undefined}
    >
      <PieceMark seat={seat} pawn={pawn} size={24} />
      <div className="min-w-0 flex-1">
        <p className="m-0 truncate text-[16px] font-bold">
          {name}
          {isMe ? <span className="font-medium text-[var(--muted)]">{t.you}</span> : null}
          {!online ? <span className="font-medium text-[var(--muted)]">{t.offline}</span> : null}
        </p>
        <p className="m-0 text-[13px] text-[var(--muted)]">{t.barLine(moves, wins)}</p>
      </div>
      <p
        aria-label={t.clockLabel(name, clock, running)}
        className={`${FONT} m-0 min-w-[78px] rounded-xl px-2.5 py-1 text-center text-[24px] font-bold tabular-nums ${running ? "bg-[var(--text)] text-[var(--ink)]" : "text-[var(--muted)]"} ${low ? "lh-low !bg-[var(--danger)]" : ""}`}
      >
        {clock}
      </p>
    </div>
  );
}

/** A small picture of each mode for the lobby: a row of wells, or a 4x3 block, in each player's colour. */
function ModePicture({ mode }: { mode: Mode }) {
  const dot = (cx: number, cy: number, c: string) => <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r="7" fill={c ? `var(--${c})` : "var(--well)"} />;
  if (mode === "track") {
    const cells = ["p1", "p1", "", "p1", "", "", "p2", "p2", "", "p2"];
    return (
      <svg aria-hidden="true" viewBox="0 0 200 24" className="h-6 w-full">
        {cells.map((c, i) => dot(10 + i * 20, 12, c))}
      </svg>
    );
  }
  const cells = ["p1", "p1", "", "p1", "", "", "", "", "p2", "", "p2", "p2"];
  return (
    <svg aria-hidden="true" viewBox="0 0 80 60" className="h-[60px] w-[80px]">
      {cells.map((c, i) => dot(10 + (i % 4) * 20, 10 + Math.floor(i / 4) * 20, c))}
    </svg>
  );
}

/** A mode's picture, name, line and clock: inside the lobby's card and the host's switch between matches. */
function ModeInfo({ mode }: { mode: Mode }) {
  const t = useText(TEXT);
  const clock = CLOCKS[mode];
  return (
    <>
      <span className="flex h-[60px] w-full items-center justify-center">
        <ModePicture mode={mode} />
      </span>
      <span className={`${FONT} text-[20px] font-bold`}>{t.modes[mode].label}</span>
      <span className="text-[14px] leading-snug text-[var(--muted)]">{t.modes[mode].detail}</span>
      <span className="text-[13px] font-medium text-[var(--muted)]">{t.clockLine(clock.startMs / 60_000, clock.incrementMs / 1000)}</span>
    </>
  );
}

/**
 * Both players are in: the rules, the room's mode, and the host's Start
 * (`onStart`; the guest waits for `hostName`). The mode was picked on the
 * hub's Start; the host may switch it here (`onMode`), and the guest sees
 * the pick.
 */
export function Lobby({
  mode,
  onMode,
  onStart,
  hostName,
  rules,
  pawnPicker,
}: {
  mode: Mode;
  onMode?: (mode: Mode) => void;
  onStart?: () => void;
  hostName: string;
  rules?: ReactNode;
  pawnPicker?: ReactNode;
}) {
  const t = useText(TEXT);
  return (
    <div className="grid gap-4">
      <div className="rounded-2xl bg-[var(--surface)] p-4">
        <h1 className={`${FONT} m-0 text-[24px] font-extrabold`}>{t.lobbyTitle}</h1>
        <ul className="m-0 mt-2 grid gap-1.5 pl-5 text-[15px] leading-snug text-[var(--muted)]">
          {t.lobbyRules.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
        {rules ? <div className="mt-3">{rules}</div> : null}
      </div>
      {onMode ? (
        <ModeSwitch mode={mode} onMode={onMode} label={t.modeLabel} />
      ) : (
        <div className="flex flex-col items-start gap-2 rounded-2xl border-2 border-[var(--p1)] bg-[var(--surface-2)] p-3.5">
          <ModeInfo mode={mode} />
        </div>
      )}
      {pawnPicker}
      {onStart ? (
        <PrimaryButton onClick={onStart}>{t.startMatch}</PrimaryButton>
      ) : (
        <p aria-live="polite" className="m-0 text-center text-[16px] font-medium text-[var(--muted)]">
          {t.waitingForHost(hostName)}
        </p>
      )}
    </div>
  );
}

/** The host's Track / Grid switch: in the lobby, or for the next match (`label` defaults to "Mode for the next match"). */
function ModeSwitch({ mode, onMode, label }: { mode: Mode; onMode: (mode: Mode) => void; label?: string }) {
  const t = useText(TEXT);
  const choose = (next: Mode) => {
    if (next !== mode) onMode(next);
  };
  return (
    <div
      role="radiogroup"
      aria-label={label ?? t.nextMatchModeLabel}
      className="grid grid-cols-2 gap-3"
      onKeyDown={(e) => {
        if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(e.key)) {
          e.preventDefault();
          const next = MODES[(MODES.indexOf(mode) + 1) % MODES.length];
          choose(next);
          (e.currentTarget.querySelector(`[data-mode="${next}"]`) as HTMLElement | null)?.focus();
        }
      }}
    >
      {MODES.map((m) => {
        const on = m === mode;
        return (
          <button
            key={m}
            type="button"
            role="radio"
            aria-checked={on}
            tabIndex={on ? 0 : -1}
            data-mode={m}
            onClick={() => choose(m)}
            className={`flex cursor-pointer flex-col items-start gap-2 rounded-2xl border-2 p-3.5 text-left text-[var(--text)] ${on ? "border-[var(--p1)] bg-[var(--surface-2)]" : "border-transparent bg-[var(--surface)]"} ${FOCUS}`}
          >
            <ModeInfo mode={m} />
          </button>
        );
      })}
    </div>
  );
}

/**
 * A matchmaking room before (or after) the match: who's here, the mode
 * (fixed by its queue), the auto-start countdown, and the way out. With the
 * other player gone, `onFindAnother` searches again.
 */
export function MatchLobby({
  mode,
  myName,
  otherName,
  status,
  onFindAnother,
  onLeave,
  pawnPicker,
}: {
  mode: Mode;
  myName: string;
  otherName?: string;
  status: string;
  onFindAnother?: () => void;
  onLeave: () => void;
  pawnPicker?: ReactNode;
}) {
  const t = useText(TEXT);
  return (
    <div className="grid gap-4">
      <div className="rounded-2xl bg-[var(--surface)] p-4 text-center">
        <p className="m-0 text-[14px] font-medium uppercase tracking-[0.06em] text-[var(--muted)]">{t.matchmaking(t.modes[mode].label)}</p>
        <p className={`${FONT} m-0 mt-2 text-[24px] font-extrabold`}>
          {myName} <span className="text-[var(--muted)]">{t.versus}</span> {otherName ?? "…"}
        </p>
        <p aria-live="polite" className="m-0 mt-2 text-[16px] font-medium">
          {status}
        </p>
      </div>
      {pawnPicker}
      {onFindAnother ? <PrimaryButton onClick={onFindAnother}>{t.findAnother}</PrimaryButton> : null}
      <SecondaryButton onClick={onLeave}>{t.leaveRoom}</SecondaryButton>
    </div>
  );
}

/** Between rounds: who won it and why, and what comes next. */
export function RoundBanner({ result, name, me, nextIn, sameBoard }: { result: RoundResult; name: (seat: Role) => string; me: Role | null; nextIn: number | null; sameBoard: boolean }) {
  const t = useText(TEXT);
  const loser = result.winner === "p1" ? "p2" : "p1";
  const title = me ? (result.winner === me ? t.youMadeLastHop : t.madeLastHop(name(result.winner))) : t.takesRound(name(result.winner));
  const why =
    result.reason === "time"
      ? me === loser
        ? t.youRanOut
        : t.ranOut(name(loser))
      : me === loser
        ? t.youStuck
        : t.stuck(name(loser));
  return (
    <div aria-live="polite" className="rounded-2xl px-4 py-3 text-center" style={{ background: seatColor(result.winner), color: "var(--ink)" }}>
      <p className={`${FONT} m-0 text-[22px] font-extrabold`}>{title}</p>
      <p className="m-0 text-[15px] font-medium">
        {why} {t.next(sameBoard, nextIn)}
      </p>
    </div>
  );
}

/**
 * "Your pawn": the eight pawns in the player's colour, theirs picked. The
 * other player's pawn is taken (shown in their colour, disabled).
 */
export function PawnPicker({ me, mine, theirs, otherName, onPick }: { me: Role; mine: Pawn; theirs: Pawn; otherName: string; onPick: (pawn: Pawn) => void }) {
  const t = useText(TEXT);
  const other: Role = me === "p1" ? "p2" : "p1";
  return (
    <div className="grid gap-2 rounded-2xl bg-[var(--surface)] p-3.5">
      <p id="lh-pawn-label" className={`${FONT} m-0 text-[16px] font-bold`}>
        {t.yourPawn}
        <span style={{ color: seatColor(me) }}>{t.pawns[mine]}</span>
      </p>
      <div role="radiogroup" aria-labelledby="lh-pawn-label" className="grid grid-cols-4 gap-2 min-[560px]:grid-cols-8">
        {PAWNS.map((pawn) => {
          const on = pawn === mine;
          const taken = pawn === theirs;
          return (
            <button
              key={pawn}
              type="button"
              role="radio"
              aria-checked={on}
              aria-label={taken ? t.takenBy(t.pawns[pawn], otherName) : t.pawns[pawn]}
              disabled={taken}
              onClick={() => !on && onPick(pawn)}
              className={`flex aspect-square cursor-pointer items-center justify-center rounded-xl border-2 p-2 disabled:cursor-not-allowed ${on ? "border-[var(--p1)] bg-[var(--surface-2)]" : "border-transparent bg-[var(--well)]"} ${taken ? "opacity-45" : ""} ${FOCUS}`}
            >
              <PawnShape pawn={pawn} fill={seatColor(taken ? other : me)} className="h-full max-h-[44px] w-full max-w-[44px]" />
            </button>
          );
        })}
      </div>
    </div>
  );
}

/** A matchmaking room's vote after a match: each player's pick, and casting one. */
export interface Voting {
  mine?: Vote;
  theirs?: Vote;
  otherName: string;
  onVote: (vote: Vote) => void;
  onLeave: () => void;
}

/**
 * The match's result and its rounds, then what's next. In a private room the
 * host decides (`onMode` + `onAgain`) and the guest waits for `hostName`; in
 * a matchmaking room both vote (`voting`).
 */
export function MatchOver({
  score,
  history,
  winner,
  name,
  me,
  mode,
  onMode,
  hostName,
  onAgain,
  voting,
  pawnOf,
  pawnPicker,
}: {
  score: Record<Role, number>;
  history: RoundResult[];
  winner: Role | null;
  name: (seat: Role) => string;
  me: Role | null;
  mode: Mode;
  onMode?: (mode: Mode) => void;
  /** Set where the host decides and this is the guest. */
  hostName?: string;
  onAgain?: () => void;
  voting?: Voting;
  pawnOf: (seat: Role) => Pawn;
  pawnPicker?: ReactNode;
}) {
  const t = useText(TEXT);
  const title = winner == null ? t.draw : me && winner === me ? t.youWinMatch : t.winsMatch(name(winner));
  return (
    <div className="grid gap-4">
      <div className="rounded-2xl bg-[var(--surface)] p-4 text-center">
        <h1 className={`${FONT} m-0 text-[28px] font-extrabold`}>{title}</h1>
        <p className={`${FONT} m-0 mt-1 text-[40px] font-extrabold tabular-nums`}>
          <span style={{ color: seatColor("p1") }}>{score.p1}</span>
          <span className="text-[var(--muted)]"> – </span>
          <span style={{ color: seatColor("p2") }}>{score.p2}</span>
        </p>
        <ol className="m-0 mt-3 grid list-none gap-1.5 p-0 text-left text-[14px]">
          {history.map((r, i) => (
            <li key={i} className="flex items-center gap-2.5 rounded-xl bg-[var(--surface-2)] px-3 py-2">
              <PieceMark seat={r.winner} pawn={pawnOf(r.winner)} size={16} />
              <span className="flex-1">
                {t.roundOf(i + 1)}
                <b>{name(r.winner)}</b>
              </span>
              <span className="text-[var(--muted)]">
                {r.reason === "time" ? t.onTime : t.lastHop} · {t.moveCount(r.moves)}
              </span>
            </li>
          ))}
        </ol>
      </div>
      {pawnPicker}
      {voting ? (
        <VotePanel mode={mode} voting={voting} />
      ) : onMode ? (
        <>
          <p className={`${FONT} m-0 text-[18px] font-bold`}>{t.nextMatch}</p>
          <ModeSwitch mode={mode} onMode={onMode} />
        </>
      ) : (
        <p aria-live="polite" className="m-0 text-center text-[15px] text-[var(--muted)]">
          {t.nextMatchIs}
          <b className="text-[var(--text)]">{t.modes[mode].label}</b>
          {hostName ? t.waitingForHostToStart(hostName) : null}
        </p>
      )}
      {onAgain ? <PrimaryButton onClick={onAgain}>{t.playAgain}</PrimaryButton> : null}
    </div>
  );
}

/**
 * Replay or change mode, by vote: the next match starts once both pick the
 * same. Each option shows who picked it; a pick can be changed. Leaving is
 * just leaving the room.
 */
function VotePanel({ mode, voting }: { mode: Mode; voting: Voting }) {
  const t = useText(TEXT);
  const { mine, theirs, otherName, onVote, onLeave } = voting;
  const label = (v: Vote) => (v === "again" ? t.replay(t.modes[mode].label) : t.changeTo(t.modes[otherMode(mode)].label));
  const status =
    mine == null && theirs == null
      ? t.voteFirst
      : mine == null
        ? t.theyVoted(otherName, label(theirs!))
        : theirs == null
          ? t.waitingForVote(otherName)
          : t.pickSame(otherName, label(theirs));
  return (
    <div className="grid gap-3">
      <p className={`${FONT} m-0 text-[18px] font-bold`}>{t.whatNext}</p>
      <div className="grid grid-cols-2 gap-3">
        {(["again", "switch"] as const).map((v) => (
          <button
            key={v}
            type="button"
            aria-pressed={mine === v}
            onClick={() => onVote(v)}
            className={`flex min-h-[86px] cursor-pointer flex-col items-start justify-between gap-2 rounded-2xl border-2 p-3.5 text-left text-[var(--text)] ${mine === v ? "border-[var(--p1)] bg-[var(--surface-2)]" : "border-transparent bg-[var(--surface)]"} ${FOCUS}`}
          >
            <span className={`${FONT} text-[18px] font-bold`}>{label(v)}</span>
            <span className="text-[13px] font-medium text-[var(--muted)]">
              {[mine === v ? t.voterYou : null, theirs === v ? otherName : null].filter(Boolean).join(" · ") || "\u00a0"}
            </span>
          </button>
        ))}
      </div>
      <p aria-live="polite" className="m-0 text-center text-[15px] text-[var(--muted)]">
        {status}
      </p>
      <SecondaryButton onClick={onLeave}>{t.leaveRoom}</SecondaryButton>
    </div>
  );
}

/** Last Hop's questions (Leave room, New room, Reset): a violet card. */
export function AskDialog(props: RoomDialogProps) {
  return (
    <RoomDialog
      {...props}
      className={`${FONT} rounded-2xl bg-[var(--surface)] p-5 text-[16px] text-[var(--text)] shadow-[0_6px_0_var(--well)]`}
      titleClassName="text-[22px] font-extrabold leading-tight"
      CancelButton={SecondaryButton}
      ConfirmButton={PrimaryButton}
    />
  );
}

const linkClass = `cursor-pointer border-0 bg-transparent p-0 text-inherit underline ${FOCUS}`;

/** Room code, then Reset game · New room · Leave room (or All games where there's no room to leave). A matchmaking room has only Leave room. */
export function Footer({ room, roomName, onReset, onNewRoom, onLeave }: { room: string; roomName?: string; onReset?: () => unknown; onNewRoom?: () => unknown; onLeave?: () => void }) {
  const lang = useLang();
  const t = TEXT[lang];
  const [asking, setAsking] = useState<"reset" | "newRoom" | null>(null);
  const close = () => setAsking(null);
  return (
    <>
      <p className="m-0 mt-4 text-center text-[13px] text-[var(--muted)]">
        {t.room(roomName ? `${roomName} (${room})` : room)}
        <br />
        {onReset ? (
          <>
            <button type="button" onClick={() => setAsking("reset")} className={linkClass}>
              {t.resetGame}
            </button>{" "}
            ·{" "}
          </>
        ) : null}
        {onNewRoom ? (
          <>
            <button type="button" onClick={() => setAsking("newRoom")} className={linkClass}>
              {t.newRoom}
            </button>{" "}
            ·{" "}
          </>
        ) : null}
        {onLeave ? (
          <button type="button" onClick={onLeave} className={linkClass}>
            {t.leaveRoom}
          </button>
        ) : (
          <LocalLink href="/" className={linkClass}>
            {t.allGames}
          </LocalLink>
        )}
      </p>
      {asking === "reset" && onReset ? <AskDialog question={t.resetConfirm} onCancel={close} onConfirm={onReset} onDone={close} /> : null}
      {asking === "newRoom" && onNewRoom ? <AskDialog question={ROOM_TEXT[lang].newRoomConfirm} onCancel={close} onConfirm={onNewRoom} onDone={close} /> : null}
    </>
  );
}
