"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { MODE_NAME, PLAYERS, type Mode } from "@/lib/games/race/race";
import "./race.css";

/**
 * The screens every race room shares (lib/games/race/race.ts): join, lobby,
 * a round's frame, results, final standings. A game fills the slots (its
 * settings, its board or map) and gives the look through the `--race-*`
 * variables on its page (see race.css).
 */

export { MODE_NAME };

/** "1:05" from ms. */
export function formatTime(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
}

export const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

export function Message({ text, home }: { text: string; home?: boolean }) {
  return (
    <section className="race-card">
      <p className="race-status">{text}</p>
      {home ? (
        <Link href="/" className="race-button race-button-wide race-link-button">
          Back to all games
        </Link>
      ) : null}
    </section>
  );
}

export function LeaveButton({ onLeave }: { onLeave: () => void }) {
  return (
    <button type="button" className="race-button" onClick={onLeave}>
      Leave room
    </button>
  );
}

/** Name entry: a seat for this guest, or watching when the room is full (or a game is on). */
export function JoinScreen({
  mode,
  defaultName,
  full,
  underway,
  onJoin,
  onWatch,
  onLeave,
}: {
  mode: Mode;
  defaultName: string;
  full: boolean;
  underway: boolean;
  onJoin: (name: string) => void;
  onWatch: () => void;
  onLeave: () => void;
}) {
  const [typed, setTyped] = useState<string | null>(null);
  const name = typed ?? defaultName;
  const id = useId();
  return (
    <section className="race-card" aria-labelledby={`${id}-title`}>
      <h2 id={`${id}-title`} className="race-card-title">
        {full ? "This room is full" : `Join the race: ${MODE_NAME[mode]}`}
      </h2>
      {full ? (
        <p className="race-note">
          {MODE_NAME[mode]} is for {PLAYERS[mode].max} players at most. You can watch.
        </p>
      ) : (
        <form
          className="race-join"
          onSubmit={(e) => {
            e.preventDefault();
            if (name.trim()) onJoin(name.trim().slice(0, 24));
          }}
        >
          <label htmlFor={`${id}-name`} className="race-field-label">
            Your name
          </label>
          <input id={`${id}-name`} className="race-input" value={name} maxLength={24} autoComplete="nickname" onChange={(e) => setTyped(e.target.value)} placeholder="What should others call you?" />
          <button type="submit" className="race-button race-button-primary race-button-wide" disabled={!name.trim()}>
            {underway ? "Join (from the next game)" : "Join"}
          </button>
        </form>
      )}
      <div className="race-footer">
        {full || underway ? (
          <button type="button" className="race-button" onClick={onWatch}>
            Watch
          </button>
        ) : null}
        <LeaveButton onLeave={onLeave} />
      </div>
    </section>
  );
}

/** The invite: the link to copy, the code, and (the host only) the room's name. */
export function InviteCard({ room, roomName, onRename, nameError }: { room: string; roomName?: string; onRename?: (name: string) => void; nameError?: string | null }) {
  const [copied, setCopied] = useState(false);
  const [draft, setDraft] = useState<string | null>(null);
  const id = useId();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => clearTimeout(timer.current ?? undefined), []);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      timer.current = setTimeout(() => setCopied(false), 2000);
    } catch {
      // No clipboard: the link is in the address bar.
    }
  };
  const save = () => {
    if (onRename && draft !== null && draft.trim() !== (roomName ?? "")) onRename(draft);
  };
  return (
    <div className="race-invite">
      <p className="race-invite-text">
        Invite friends with the link. Room <strong>{roomName || room.toUpperCase()}</strong>
      </p>
      <button type="button" className="race-button race-button-primary" onClick={copy}>
        <span aria-live="polite">{copied ? "Copied!" : "Copy invite link"}</span>
      </button>
      {onRename ? (
        <label htmlFor={`${id}-room`} className="race-field-label">
          Name this room (optional)
          <input
            id={`${id}-room`}
            className="race-input"
            value={draft ?? roomName ?? ""}
            maxLength={24}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={save}
            onKeyDown={(e) => {
              if (e.key === "Enter") e.currentTarget.blur();
            }}
            aria-invalid={nameError ? true : undefined}
            aria-describedby={nameError ? `${id}-error` : undefined}
          />
          {nameError ? (
            <span id={`${id}-error`} role="alert" className="race-error">
              {nameError}
            </span>
          ) : null}
        </label>
      ) : null}
    </div>
  );
}

export interface Seat {
  seat: string;
  name: string;
  online: boolean;
  host: boolean;
  me: boolean;
}

function PlayerChips({ players }: { players: Seat[] }) {
  return (
    <ul className="race-players">
      {players.map((p) => (
        <li key={p.seat} className="race-player" data-me={p.me ? "" : undefined}>
          <span className="race-dot" data-online={p.online ? "" : undefined} aria-label={p.online ? "online" : "offline"} role="img" />
          <span className="race-player-name">{p.name}</span>
          {p.host ? <span className="race-pill">Host</span> : null}
          {p.me ? <span className="race-pill">You</span> : null}
        </li>
      ))}
    </ul>
  );
}

export function Lobby({
  mode,
  settings,
  rules,
  players,
  isPublic,
  canEdit,
  hostName,
  problem,
  autoStatus,
  invite,
  onStart,
  onLeave,
}: {
  mode: Mode;
  /** The game's settings: the host's switches, or what was picked. */
  settings: ReactNode;
  /** One line on how a round goes. */
  rules: string;
  players: Seat[];
  isPublic: boolean;
  /** The host of a private room: settings and Start. */
  canEdit: boolean;
  hostName: string | null;
  problem: string | null;
  /** A public room: "Starting in 12 s", "Waiting for more players…". */
  autoStatus: string | null;
  invite: ReactNode;
  onStart: () => void;
  onLeave: () => void;
}) {
  const id = useId();
  return (
    <>
      <section className="race-card" aria-labelledby={`${id}-title`}>
        <p className="race-kicker">{isPublic ? "Matchmaking" : "Private room"}</p>
        <h2 id={`${id}-title`} className="race-card-title">
          {MODE_NAME[mode]}
        </h2>
        {settings}
        <p className="race-note race-rules">{rules}</p>
      </section>

      <section className="race-card" aria-labelledby={`${id}-players`}>
        <h2 id={`${id}-players`} className="race-card-title">
          Players: {players.length} of {PLAYERS[mode].max}
        </h2>
        <PlayerChips players={players} />
        {isPublic ? (
          <p className="race-status" aria-live="polite">
            {autoStatus}
          </p>
        ) : canEdit ? (
          <>
            {problem ? (
              <p className="race-note race-problem" role="status">
                {problem}
              </p>
            ) : null}
            <button type="button" className="race-button race-button-primary race-button-wide" disabled={problem !== null} onClick={onStart}>
              Start the race
            </button>
          </>
        ) : (
          <p className="race-status">{problem ?? `Waiting for ${hostName ?? "the host"} to start…`}</p>
        )}
      </section>

      {invite}
      <div className="race-footer">
        <LeaveButton onLeave={onLeave} />
      </div>
    </>
  );
}

export interface BoardRow {
  seat: string;
  name: string;
  /** How far along, 0 to 1 (never which countries or squares). */
  progress: number;
  /** "3 of 5 found", "✓ 1:23", "Gave up". */
  status: string;
  done: boolean;
  online: boolean;
  me: boolean;
}

/** Everyone still in, as they go: how far (never where), and who's done. */
function ProgressBoard({ rows }: { rows: BoardRow[] }) {
  return (
    <ol className="race-board" aria-label="The race">
      {rows.map((row) => (
        <li key={row.seat} className="race-board-row" data-me={row.me ? "" : undefined} data-done={row.done ? "" : undefined}>
          <span className="race-dot" data-online={row.online ? "" : undefined} aria-hidden="true" />
          <span className="race-board-name">{row.name}</span>
          <span className="race-board-bar" aria-hidden="true">
            <span style={{ width: `${Math.round(Math.min(1, Math.max(0, row.progress)) * 100)}%` }} />
          </span>
          <span className="race-board-status">{row.status}</span>
        </li>
      ))}
    </ol>
  );
}

export type MyStatus = { kind: "playing" } | { kind: "done"; text: string } | { kind: "gaveUp" } | { kind: "out" } | { kind: "watching" };

/**
 * A round: the label and the clock, the game's `stage` (its map or board,
 * under the "3, 2, 1" countdown), where I stand, everyone's progress, and
 * Give up. `unit` names a round ("route", "puzzle").
 */
export function RoundView({
  roundLabel,
  unit,
  countdown,
  timeLeft,
  me,
  board,
  header,
  stage,
  afterStage,
  below,
  actions,
  onGiveUp,
  onLeave,
}: {
  roundLabel: string;
  unit: string;
  /** Seconds before the round starts, during the countdown. */
  countdown: number | null;
  timeLeft: number;
  me: MyStatus;
  board: BoardRow[];
  header?: ReactNode;
  stage: ReactNode;
  /** Under the stage while playing (a guess box). */
  afterStage?: ReactNode;
  /** Under everyone's progress (a guess list). */
  below?: ReactNode;
  /** More buttons beside Give up. */
  actions?: ReactNode;
  onGiveUp: () => void;
  /** Only for someone not playing this game (out, or watching). */
  onLeave?: () => void;
}) {
  const [asking, setAsking] = useState(false);
  const playing = me.kind === "playing";
  return (
    <>
      <div className="race-bar">
        <span className="race-kicker">{roundLabel}</span>
        <span className="race-time race-clock" data-low={timeLeft < 30_000 ? "" : undefined} aria-label={`Time left ${formatTime(timeLeft)}`}>
          {formatTime(timeLeft)}
        </span>
      </div>
      {header}
      <div className="race-stage">
        {stage}
        {countdown !== null ? (
          <div className="race-countdown" aria-live="assertive">
            <span key={countdown}>{countdown}</span>
          </div>
        ) : null}
      </div>
      {me.kind === "done" ? (
        <p className="race-done-title race-me" role="status">
          {me.text} Waiting for the others…
        </p>
      ) : me.kind === "gaveUp" ? (
        <p className="race-status race-me">You gave up this {unit}. Waiting for the others…</p>
      ) : me.kind === "out" ? (
        <p className="race-status race-me">You&apos;re out. Watching the others…</p>
      ) : me.kind === "watching" ? (
        <p className="race-status race-me">Watching.</p>
      ) : null}
      {playing ? afterStage : null}
      <ProgressBoard rows={board} />
      {below}
      <div className="race-footer">
        {playing ? actions : null}
        {playing && countdown === null ? (
          asking ? (
            <>
              <span className="race-note">Give up this {unit}?</span>
              <button type="button" className="race-button" onClick={() => setAsking(false)}>
                Keep going
              </button>
              <button
                type="button"
                className="race-button race-button-danger"
                onClick={() => {
                  setAsking(false);
                  onGiveUp();
                }}
              >
                Give up
              </button>
            </>
          ) : (
            <button type="button" className="race-button" onClick={() => setAsking(true)}>
              Give up…
            </button>
          )
        ) : null}
        {onLeave ? <LeaveButton onLeave={onLeave} /> : null}
      </div>
    </>
  );
}

export interface ResultRow {
  seat: string;
  name: string;
  /** "1:23" with the penalty, or "Didn't finish". */
  result: string;
  detail: string;
  out: boolean;
  me: boolean;
}

/** A round's results, best first; picking a row shows that player's round (`children`, the game's). */
export function ResultsView({
  title,
  next,
  rows,
  selected,
  onSelect,
  caption,
  children,
  onLeave,
}: {
  title: string;
  next: string;
  rows: ResultRow[];
  selected: string;
  onSelect: (seat: string) => void;
  /** Over the selected player's round: "Your guesses, and the route:". */
  caption: string;
  children: ReactNode;
  onLeave?: () => void;
}) {
  return (
    <>
      <section className="race-card" aria-label={title}>
        <p className="race-kicker">{title}</p>
        <ol className="race-results">
          {rows.map((row, i) => (
            <li key={row.seat}>
              <button type="button" className="race-result" aria-pressed={row.seat === selected} data-out={row.out ? "" : undefined} data-me={row.me ? "" : undefined} onClick={() => onSelect(row.seat)}>
                <span className="race-rank">{i + 1}</span>
                <span className="race-result-name">
                  {row.name}
                  {row.me ? <span className="race-you"> (you)</span> : null}
                  {row.out ? <span className="race-pill race-pill-out">Out</span> : null}
                </span>
                <span className="race-result-time">{row.result}</span>
                <span className="race-result-detail">{row.detail}</span>
              </button>
            </li>
          ))}
        </ol>
        <p className="race-status" aria-live="polite">
          {next}
        </p>
      </section>
      <p className="race-note">{caption}</p>
      {children}
      {onLeave ? (
        <div className="race-footer">
          <LeaveButton onLeave={onLeave} />
        </div>
      ) : null}
    </>
  );
}

export interface FinalRow {
  seat: string;
  name: string;
  value: string;
  detail: string;
  me: boolean;
}

export function FinalView({
  headline,
  rows,
  canPlayAgain,
  againProblem,
  onPlayAgain,
  onSettings,
  onLeave,
}: {
  headline: string;
  rows: FinalRow[];
  canPlayAgain: boolean;
  againProblem: string | null;
  onPlayAgain: () => void;
  /** The host of a private room: back to the lobby to change the mode or the settings. */
  onSettings?: () => void;
  onLeave: () => void;
}) {
  const id = useId();
  return (
    <>
      <section className="race-card" aria-labelledby={`${id}-final`}>
        <p className="race-kicker">Final standings</p>
        <h2 id={`${id}-final`} className="race-card-title race-final-title">
          {headline}
        </h2>
        <ol className="race-results">
          {rows.map((row, i) => (
            <li key={row.seat} className="race-result race-result-static" data-me={row.me ? "" : undefined} data-winner={i === 0 ? "" : undefined}>
              <span className="race-rank">{i + 1}</span>
              <span className="race-result-name">
                {row.name}
                {row.me ? <span className="race-you"> (you)</span> : null}
              </span>
              <span className="race-result-time">{row.value}</span>
              <span className="race-result-detail">{row.detail}</span>
            </li>
          ))}
        </ol>
        {againProblem ? <p className="race-note race-problem">{againProblem}</p> : null}
        {canPlayAgain ? (
          <button type="button" className="race-button race-button-primary race-button-wide" disabled={againProblem !== null} onClick={onPlayAgain}>
            Play again
          </button>
        ) : null}
      </section>
      <div className="race-footer">
        {onSettings ? (
          <button type="button" className="race-button" onClick={onSettings}>
            Change mode or settings
          </button>
        ) : null}
        <LeaveButton onLeave={onLeave} />
      </div>
    </>
  );
}
