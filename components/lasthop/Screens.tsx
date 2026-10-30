"use client";

import Link from "next/link";
import { type ReactNode, useState } from "react";
import type { Role } from "@/lib/session/types";
import { NEW_ROOM_CONFIRM, type RoomQuestion } from "@/lib/session/shared/roomActions";
import RoomDialog, { type RoomDialogProps } from "@/components/RoomDialog";
import { CLOCKS, MODE_LABELS, MODES, type Mode } from "@/lib/games/lasthop/constants";
import type { RoundResult } from "@/lib/games/lasthop/game";
import { FOCUS, FONT, formatClock, PieceMark, PrimaryButton, SecondaryButton, seatColor } from "./ui";

/** The page frame's title row: the wordmark, and the match so far. */
export function Header({ round, score }: { round?: number; score?: ReactNode }) {
  return (
    <header className="flex items-center justify-between gap-3">
      <p className={`${FONT} m-0 text-[22px] font-extrabold tracking-[-0.01em] min-[640px]:text-[28px]`}>
        Last <span className="text-[var(--p1)]">H</span>
        <span className="text-[var(--p2)]">o</span>p
      </p>
      {round ? (
        <p className="m-0 text-right text-[14px] font-medium text-[var(--muted)]">
          Round {round}
          {score ? <> · {score}</> : null}
        </p>
      ) : null}
    </header>
  );
}

export function Message({ text, alert, home }: { text: string; alert?: boolean; home?: boolean }) {
  return (
    <div className="rounded-2xl bg-[var(--surface)] px-4 py-3.5">
      <p role={alert ? "alert" : undefined} className="m-0 font-medium">
        {text}
      </p>
      {home ? (
        <Link href="/" className="mt-2 inline-block font-bold text-[var(--p1)] underline">
          All games
        </Link>
      ) : null}
    </div>
  );
}

/** A player's strip: color, name, the moves they have, and their chess clock. */
export function PlayerBar({
  seat,
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
}) {
  const low = running && clockMs < 10_000;
  return (
    <div
      className={`flex items-center gap-3 rounded-2xl px-3.5 py-2.5 transition-colors motion-reduce:transition-none ${running ? "bg-[var(--surface-2)]" : "bg-[var(--surface)]"}`}
      style={running ? { boxShadow: `inset 0 0 0 2px ${seatColor(seat)}` } : undefined}
    >
      <PieceMark seat={seat} />
      <div className="min-w-0 flex-1">
        <p className="m-0 truncate text-[16px] font-bold">
          {name}
          {isMe ? <span className="font-medium text-[var(--muted)]"> (you)</span> : null}
          {!online ? <span className="font-medium text-[var(--muted)]"> · offline</span> : null}
        </p>
        <p className="m-0 text-[13px] text-[var(--muted)]">
          {moves === 1 ? "1 move" : `${moves} moves`} available · {wins} {wins === 1 ? "round" : "rounds"}
        </p>
      </div>
      <p
        aria-label={`${name}'s clock: ${formatClock(clockMs)}${running ? ", running" : ""}`}
        className={`${FONT} m-0 min-w-[78px] rounded-xl px-2.5 py-1 text-center text-[24px] font-bold tabular-nums ${running ? "bg-[var(--text)] text-[var(--ink)]" : "text-[var(--muted)]"} ${low ? "lh-low !bg-[var(--danger)]" : ""}`}
      >
        {formatClock(clockMs)}
      </p>
    </div>
  );
}

/** A small picture of each mode for the lobby: a row of wells, or a 4x3 block, with each player's pieces in their shape. */
function ModePicture({ mode }: { mode: Mode }) {
  const dot = (cx: number, cy: number, c: string) =>
    c === "p1" ? (
      <rect key={`${cx}-${cy}`} x={cx - 6.5} y={cy - 6.5} width="13" height="13" rx="3.5" fill="var(--p1)" />
    ) : (
      <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r="7" fill={c ? `var(--${c})` : "var(--well)"} />
    );
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
  const clock = CLOCKS[mode];
  return (
    <>
      <span className="flex h-[60px] w-full items-center justify-center">
        <ModePicture mode={mode} />
      </span>
      <span className={`${FONT} text-[20px] font-bold`}>{MODE_LABELS[mode].label}</span>
      <span className="text-[14px] leading-snug text-[var(--muted)]">{MODE_LABELS[mode].detail}</span>
      <span className="text-[13px] font-medium text-[var(--muted)]">
        {clock.startMs / 60_000} min each, +{clock.incrementMs / 1000} s a move
      </span>
    </>
  );
}

/**
 * Both players are in: the rules, the room's mode, Start (either player).
 * The mode was picked on the hub's Start; here it only shows. The host
 * changes it between matches (`MatchOver`).
 */
export function Lobby({ mode, onStart }: { mode: Mode; onStart: () => void }) {
  return (
    <div className="grid gap-4">
      <div className="rounded-2xl bg-[var(--surface)] p-4">
        <h1 className={`${FONT} m-0 text-[24px] font-extrabold`}>Make the last move</h1>
        <ul className="m-0 mt-2 grid gap-1.5 pl-5 text-[15px] leading-snug text-[var(--muted)]">
          <li>Your pieces only go forward: slide into the next empty square, or jump one of theirs.</li>
          <li>If it&apos;s your turn and you can&apos;t move, you lose the round. Rushing burns your moves.</li>
          <li>Each board is played twice, swapping sides. You each have a chess clock.</li>
        </ul>
      </div>
      <div className="flex flex-col items-start gap-2 rounded-2xl border-2 border-[var(--p1)] bg-[var(--surface-2)] p-3.5">
        <ModeInfo mode={mode} />
      </div>
      <PrimaryButton onClick={onStart}>Start the match</PrimaryButton>
    </div>
  );
}

/** The host's Track / Grid switch for the next match. */
function ModeSwitch({ mode, onMode }: { mode: Mode; onMode: (mode: Mode) => void }) {
  const choose = (next: Mode) => {
    if (next !== mode) onMode(next);
  };
  return (
    <div
      role="radiogroup"
      aria-label="Mode for the next match"
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
}: {
  mode: Mode;
  myName: string;
  otherName?: string;
  status: string;
  onFindAnother?: () => void;
  onLeave: () => void;
}) {
  return (
    <div className="grid gap-4">
      <div className="rounded-2xl bg-[var(--surface)] p-4 text-center">
        <p className="m-0 text-[14px] font-medium uppercase tracking-[0.06em] text-[var(--muted)]">Matchmaking · {MODE_LABELS[mode].label}</p>
        <p className={`${FONT} m-0 mt-2 text-[24px] font-extrabold`}>
          {myName} <span className="text-[var(--muted)]">vs</span> {otherName ?? "…"}
        </p>
        <p aria-live="polite" className="m-0 mt-2 text-[16px] font-medium">
          {status}
        </p>
      </div>
      {onFindAnother ? <PrimaryButton onClick={onFindAnother}>Find another player</PrimaryButton> : null}
      <SecondaryButton onClick={onLeave}>Leave room</SecondaryButton>
    </div>
  );
}

/** Between rounds: who won it and why, and what comes next. */
export function RoundBanner({ result, name, me, nextIn, sameBoard }: { result: RoundResult; name: (seat: Role) => string; me: Role | null; nextIn: number | null; sameBoard: boolean }) {
  const loser = result.winner === "p1" ? "p2" : "p1";
  const title = me ? (result.winner === me ? "You made the last hop!" : `${name(result.winner)} made the last hop`) : `${name(result.winner)} takes the round`;
  const why =
    result.reason === "time"
      ? `${me === loser ? "You" : name(loser)} ran out of time.`
      : `${me === loser ? "You" : name(loser)} had no move left.`;
  return (
    <div aria-live="polite" className="rounded-2xl px-4 py-3 text-center" style={{ background: seatColor(result.winner), color: "var(--ink)" }}>
      <p className={`${FONT} m-0 text-[22px] font-extrabold`}>{title}</p>
      <p className="m-0 text-[15px] font-medium">
        {why} {sameBoard ? "Next: the same board, sides swapped" : "Next: a new board"}
        {nextIn != null ? ` in ${nextIn}` : ""}.
      </p>
    </div>
  );
}

/**
 * The match's result and its rounds, then the next match: the host picks its
 * mode here (`onMode`; the other player sees `hostName` picks it, and a
 * matchmaking room keeps its mode), and either player starts it.
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
}: {
  score: Record<Role, number>;
  history: RoundResult[];
  winner: Role | null;
  name: (seat: Role) => string;
  me: Role | null;
  mode: Mode;
  onMode?: (mode: Mode) => void;
  /** Set where someone else picks the mode (a private room's guest). */
  hostName?: string;
  onAgain?: () => void;
}) {
  const title = winner == null ? "A draw" : me ? (winner === me ? "You win the match!" : `${name(winner)} wins the match`) : `${name(winner)} wins the match`;
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
              <PieceMark seat={r.winner} size={14} />
              <span className="flex-1">
                Round {i + 1}: <b>{name(r.winner)}</b>
              </span>
              <span className="text-[var(--muted)]">
                {r.reason === "time" ? "on time" : "last hop"} · {r.moves} moves
              </span>
            </li>
          ))}
        </ol>
      </div>
      {onMode ? (
        <>
          <p className={`${FONT} m-0 text-[18px] font-bold`}>Next match</p>
          <ModeSwitch mode={mode} onMode={onMode} />
        </>
      ) : (
        <p className="m-0 text-center text-[15px] text-[var(--muted)]">
          Next match: <b className="text-[var(--text)]">{MODE_LABELS[mode].label}</b>
          {hostName ? ` · ${hostName} picks the mode.` : null}
        </p>
      )}
      {onAgain ? <PrimaryButton onClick={onAgain}>Play again</PrimaryButton> : null}
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

const RESET_CONFIRM: RoomQuestion = {
  title: "Reset the game?",
  message: "The match ends and you're back in the lobby, in the same mode. Seats stay as they are.",
  cancelLabel: "Cancel",
  confirmLabel: "Reset game",
  busyLabel: "Resetting…",
};

const linkClass = `cursor-pointer border-0 bg-transparent p-0 text-inherit underline ${FOCUS}`;

/** Room code, then Reset game · New room · Leave room (or All games where there's no room to leave). A matchmaking room has only Leave room. */
export function Footer({ room, roomName, onReset, onNewRoom, onLeave }: { room: string; roomName?: string; onReset?: () => unknown; onNewRoom?: () => unknown; onLeave?: () => void }) {
  const [asking, setAsking] = useState<"reset" | "newRoom" | null>(null);
  const close = () => setAsking(null);
  return (
    <>
      <p className="m-0 mt-4 text-center text-[13px] text-[var(--muted)]">
        Room: {roomName ? `${roomName} (${room})` : room}
        <br />
        {onReset ? (
          <>
            <button type="button" onClick={() => setAsking("reset")} className={linkClass}>
              Reset game
            </button>{" "}
            ·{" "}
          </>
        ) : null}
        {onNewRoom ? (
          <>
            <button type="button" onClick={() => setAsking("newRoom")} className={linkClass}>
              New room
            </button>{" "}
            ·{" "}
          </>
        ) : null}
        {onLeave ? (
          <button type="button" onClick={onLeave} className={linkClass}>
            Leave room
          </button>
        ) : (
          <Link href="/" className={linkClass}>
            All games
          </Link>
        )}
      </p>
      {asking === "reset" && onReset ? <AskDialog question={RESET_CONFIRM} onCancel={close} onConfirm={onReset} onDone={close} /> : null}
      {asking === "newRoom" && onNewRoom ? <AskDialog question={NEW_ROOM_CONFIRM} onCancel={close} onConfirm={onNewRoom} onDone={close} /> : null}
    </>
  );
}
