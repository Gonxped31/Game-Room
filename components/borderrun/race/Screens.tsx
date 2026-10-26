"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { AREA_NAME } from "@/lib/games/borderrun/areas";
import { GAME_TITLE } from "@/lib/games/borderrun/constants";
import type { Play } from "@/lib/games/borderrun/play";
import { MAP_CHOICES, MODES, PLAYERS, ROUND_COUNTS, type MapChoice, type Mode, type RoundCount } from "@/lib/games/borderrun/race";
import { LANGS, type Lang } from "@/lib/games/shared/language";
import { formatTime, GuessInput, GuessList, PathLine, PlayMap, RouteHeader, Segmented } from "../Controls";
import "../borderrun.css";
import "./race.css";

export const MODE_NAME: Record<Mode, string> = { challenge: "Challenge", survival: "Survival" };
export const MODE_LINE: Record<Mode, string> = {
  challenge: `${PLAYERS.challenge.min}–${PLAYERS.challenge.max} players. The lowest total time wins.`,
  survival: `${PLAYERS.survival.min}–${PLAYERS.survival.max} players. The slowest are out after each route.`,
};
const mapName = (map: MapChoice) => (map === "mixed" ? "Mixed" : AREA_NAME[map].en);

/** The room's page: the title sign and the names' EN/FR switch, as on the solo page, but no back link (a room's way out is Leave room). */
export function RaceShell({ lang, onLang, children }: { lang: Lang; onLang: (lang: Lang) => void; children: ReactNode }) {
  return (
    <div className="br-page">
      <main className="br-main">
        <header className="br-header">
          <h1 className="br-title">{GAME_TITLE}</h1>
          <Segmented label="Country names" options={LANGS} value={lang} onChange={onLang} render={(l) => l.toUpperCase()} small />
        </header>
        {children}
      </main>
    </div>
  );
}

export function Message({ text, home }: { text: string; home?: boolean }) {
  return (
    <section className="br-card">
      <p className="br-status">{text}</p>
      {home ? (
        <Link href="/" className="br-button br-button-wide br-link-button">
          Back to all games
        </Link>
      ) : null}
    </section>
  );
}

export function LeaveButton({ onLeave }: { onLeave: () => void }) {
  return (
    <button type="button" className="br-button" onClick={onLeave}>
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
    <section className="br-card" aria-labelledby={`${id}-title`}>
      <h2 id={`${id}-title`} className="br-card-title">
        {full ? "This room is full" : `Join the race: ${MODE_NAME[mode]}`}
      </h2>
      {full ? (
        <p className="br-note">
          {MODE_NAME[mode]} is for {PLAYERS[mode].max} players at most. You can watch.
        </p>
      ) : (
        <form
          className="br-join"
          onSubmit={(e) => {
            e.preventDefault();
            if (name.trim()) onJoin(name.trim().slice(0, 24));
          }}
        >
          <label htmlFor={`${id}-name`} className="br-field-label">
            Your name
          </label>
          <input id={`${id}-name`} className="br-input" value={name} maxLength={24} autoComplete="nickname" onChange={(e) => setTyped(e.target.value)} placeholder="What should others call you?" />
          <button type="submit" className="br-button br-button-primary br-button-wide" disabled={!name.trim()}>
            {underway ? "Join (from the next game)" : "Join"}
          </button>
        </form>
      )}
      <div className="br-footer">
        {full || underway ? (
          <button type="button" className="br-button" onClick={onWatch}>
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
    <div className="br-invite">
      <p className="br-invite-text">
        Invite friends with the link. Room <strong>{roomName || room.toUpperCase()}</strong>
      </p>
      <button type="button" className="br-button br-button-primary" onClick={copy}>
        <span aria-live="polite">{copied ? "Copied!" : "Copy invite link"}</span>
      </button>
      {onRename ? (
        <label htmlFor={`${id}-room`} className="br-field-label br-invite-name">
          Name this room (optional)
          <input
            id={`${id}-room`}
            className="br-input"
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
            <span id={`${id}-error`} role="alert" className="br-error">
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
    <ul className="br-players">
      {players.map((p) => (
        <li key={p.seat} className="br-player" data-me={p.me ? "" : undefined}>
          <span className="br-dot" data-online={p.online ? "" : undefined} aria-label={p.online ? "online" : "offline"} role="img" />
          <span className="br-player-name">{p.name}</span>
          {p.host ? <span className="br-pill">Host</span> : null}
          {p.me ? <span className="br-pill">You</span> : null}
        </li>
      ))}
    </ul>
  );
}

export function Lobby({
  mode,
  map,
  rounds,
  players,
  isPublic,
  canEdit,
  hostName,
  problem,
  autoStatus,
  invite,
  onMode,
  onMap,
  onRounds,
  onStart,
  onLeave,
}: {
  mode: Mode;
  map: MapChoice;
  rounds: RoundCount;
  players: Seat[];
  isPublic: boolean;
  /** The host of a private room: settings and Start. */
  canEdit: boolean;
  hostName: string | null;
  problem: string | null;
  /** A public room: "Starting in 12 s", "Waiting for more players…". */
  autoStatus: string | null;
  invite: ReactNode;
  onMode: (mode: Mode) => void;
  onMap: (map: MapChoice) => void;
  onRounds: (rounds: RoundCount) => void;
  onStart: () => void;
  onLeave: () => void;
}) {
  const id = useId();
  return (
    <>
      <section className="br-card" aria-labelledby={`${id}-title`}>
        <p className="br-kicker">{isPublic ? "Matchmaking" : "Private room"}</p>
        <h2 id={`${id}-title`} className="br-card-title">
          {MODE_NAME[mode]}
        </h2>
        {canEdit ? (
          <>
            <Segmented label="Mode" options={MODES} value={mode} onChange={onMode} render={(m) => MODE_NAME[m]} />
            <p className="br-note">{MODE_LINE[mode]}</p>
            <p className="br-field-label">Map</p>
            <Segmented label="Map" options={MAP_CHOICES} value={map} onChange={onMap} render={mapName} wrap />
            {mode === "challenge" ? (
              <>
                <p className="br-field-label">Routes</p>
                <Segmented label="Routes" options={ROUND_COUNTS.map(String)} value={String(rounds)} onChange={(n) => onRounds(Number(n) as RoundCount)} render={(n) => `${n} routes`} />
              </>
            ) : null}
          </>
        ) : (
          <>
            <p className="br-note">{MODE_LINE[mode]}</p>
            <p className="br-note">
              Map: {mapName(map)}
              {mode === "challenge" ? `, ${rounds} routes` : ""}
            </p>
          </>
        )}
        <p className="br-note br-rules">Each route is the same for everyone. The time limit is 3 minutes; each guess past the par adds 15 s.</p>
      </section>

      <section className="br-card" aria-labelledby={`${id}-players`}>
        <h2 id={`${id}-players`} className="br-card-title">
          Players: {players.length} of {PLAYERS[mode].max}
        </h2>
        <PlayerChips players={players} />
        {isPublic ? (
          <p className="br-status" aria-live="polite">
            {autoStatus}
          </p>
        ) : canEdit ? (
          <>
            {problem ? (
              <p className="br-note br-problem" role="status">
                {problem}
              </p>
            ) : null}
            <button type="button" className="br-button br-button-primary br-button-wide" disabled={problem !== null} onClick={onStart}>
              Start the race
            </button>
          </>
        ) : (
          <p className="br-status">{problem ?? `Waiting for ${hostName ?? "the host"} to start…`}</p>
        )}
      </section>

      {invite}
      <div className="br-footer">
        <LeaveButton onLeave={onLeave} />
      </div>
    </>
  );
}

export interface BoardRow {
  seat: string;
  name: string;
  found: number;
  par: number;
  guesses: number;
  /** The finish time with penalty, once done. */
  finish: number | null;
  gaveUp: boolean;
  online: boolean;
  me: boolean;
}

/** Everyone still in, as they go: countries found (never which), and who's done. */
function Board({ rows }: { rows: BoardRow[] }) {
  return (
    <ol className="br-board" aria-label="The race">
      {rows.map((row) => (
        <li key={row.seat} className="br-board-row" data-me={row.me ? "" : undefined} data-done={row.finish !== null ? "" : undefined}>
          <span className="br-dot" data-online={row.online ? "" : undefined} aria-hidden="true" />
          <span className="br-board-name">{row.name}</span>
          <span className="br-board-bar" aria-hidden="true">
            <span style={{ width: `${row.finish !== null ? 100 : (row.found / Math.max(1, row.par)) * 100}%` }} />
          </span>
          <span className="br-board-status">
            {row.finish !== null ? `✓ ${formatTime(row.finish)}` : row.gaveUp ? "Gave up" : `${row.found} of ${row.par} found, ${row.guesses} ${row.guesses === 1 ? "guess" : "guesses"}`}
          </span>
        </li>
      ))}
    </ol>
  );
}

export type MyStatus = { kind: "playing" } | { kind: "done"; finish: number; extra: number } | { kind: "gaveUp" } | { kind: "out" } | { kind: "watching" };

export function RoundView({
  roundLabel,
  countdown,
  timeLeft,
  play,
  lang,
  me,
  board,
  onGuess,
  onGiveUp,
  onLeave,
}: {
  roundLabel: string;
  /** Seconds before the round starts, during the countdown. */
  countdown: number | null;
  timeLeft: number;
  play: Play;
  lang: Lang;
  me: MyStatus;
  board: BoardRow[];
  onGuess: (code: string) => void;
  onGiveUp: () => void;
  /** Only for someone not playing this game (out, or watching). */
  onLeave?: () => void;
}) {
  const [asking, setAsking] = useState(false);
  const playing = me.kind === "playing";
  return (
    <>
      <div className="br-race-bar">
        <span className="br-kicker">{roundLabel}</span>
        <span className="br-time br-race-clock" data-low={timeLeft < 30_000 ? "" : undefined} aria-label={`Time left ${formatTime(timeLeft)}`}>
          {formatTime(timeLeft)}
        </span>
      </div>
      <RouteHeader play={play} lang={lang} />
      <div className="br-race-map">
        <PlayMap play={play} lang={lang} />
        {countdown !== null ? (
          <div className="br-countdown" aria-live="assertive">
            <span key={countdown}>{countdown}</span>
          </div>
        ) : null}
      </div>
      {me.kind === "done" ? (
        <p className="br-done-title br-race-me" role="status">
          Done in {formatTime(me.finish)}
          {me.extra ? ` (${me.extra} past the par)` : ""}. Waiting for the others…
        </p>
      ) : me.kind === "gaveUp" ? (
        <p className="br-status br-race-me">You gave up this route. Waiting for the others…</p>
      ) : me.kind === "out" ? (
        <p className="br-status br-race-me">You&apos;re out. Watching the others…</p>
      ) : me.kind === "watching" ? (
        <p className="br-status br-race-me">Watching.</p>
      ) : null}
      {playing ? <GuessInput key={roundLabel} play={play} lang={lang} onGuess={onGuess} disabled={countdown !== null} /> : null}
      <Board rows={board} />
      {me.kind === "playing" || me.kind === "done" || me.kind === "gaveUp" ? <GuessList play={play} lang={lang} /> : null}
      <div className="br-footer">
        {playing && countdown === null ? (
          asking ? (
            <>
              <span className="br-note">Give up this route?</span>
              <button type="button" className="br-button" onClick={() => setAsking(false)}>
                Keep going
              </button>
              <button
                type="button"
                className="br-button br-button-danger"
                onClick={() => {
                  setAsking(false);
                  onGiveUp();
                }}
              >
                Give up
              </button>
            </>
          ) : (
            <button type="button" className="br-button" onClick={() => setAsking(true)}>
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

export function ResultsView({
  title,
  next,
  rows,
  selected,
  onSelect,
  play,
  path,
  lang,
  onLeave,
}: {
  title: string;
  next: string;
  rows: ResultRow[];
  selected: string;
  onSelect: (seat: string) => void;
  /** The selected player's guesses on this route. */
  play: Play;
  /** Their route if they finished, else a shortest one. */
  path: string[];
  lang: Lang;
  onLeave?: () => void;
}) {
  const shown = rows.find((row) => row.seat === selected);
  return (
    <>
      <section className="br-card" aria-label={title}>
        <p className="br-kicker">{title}</p>
        <ol className="br-results">
          {rows.map((row, i) => (
            <li key={row.seat}>
              <button type="button" className="br-result" aria-pressed={row.seat === selected} data-out={row.out ? "" : undefined} data-me={row.me ? "" : undefined} onClick={() => onSelect(row.seat)}>
                <span className="br-rank">{i + 1}</span>
                <span className="br-result-name">
                  {row.name}
                  {row.me ? <span className="br-you"> (you)</span> : null}
                  {row.out ? <span className="br-pill br-pill-out">Out</span> : null}
                </span>
                <span className="br-result-time">{row.result}</span>
                <span className="br-result-detail">{row.detail}</span>
              </button>
            </li>
          ))}
        </ol>
        <p className="br-status" aria-live="polite">
          {next}
        </p>
      </section>
      <p className="br-note">{shown ? `${shown.me ? "Your" : `${shown.name}'s`} guesses, and ${play.guesses.length && path.length ? "the route" : "a route"}:` : null}</p>
      <PlayMap play={play} lang={lang} reveal={path} />
      <PathLine path={path} lang={lang} />
      {onLeave ? (
        <div className="br-footer">
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
  return (
    <>
      <section className="br-card br-final" aria-labelledby="br-final-title">
        <p className="br-kicker">Final standings</p>
        <h2 id="br-final-title" className="br-card-title br-final-title">
          {headline}
        </h2>
        <ol className="br-results">
          {rows.map((row, i) => (
            <li key={row.seat} className="br-result br-result-static" data-me={row.me ? "" : undefined} data-winner={i === 0 ? "" : undefined}>
              <span className="br-rank">{i + 1}</span>
              <span className="br-result-name">
                {row.name}
                {row.me ? <span className="br-you"> (you)</span> : null}
              </span>
              <span className="br-result-time">{row.value}</span>
              <span className="br-result-detail">{row.detail}</span>
            </li>
          ))}
        </ol>
        {againProblem ? <p className="br-note br-problem">{againProblem}</p> : null}
        {canPlayAgain ? (
          <button type="button" className="br-button br-button-primary br-button-wide" disabled={againProblem !== null} onClick={onPlayAgain}>
            Play again
          </button>
        ) : null}
      </section>
      <div className="br-footer">
        {onSettings ? (
          <button type="button" className="br-button" onClick={onSettings}>
            Change mode or settings
          </button>
        ) : null}
        <LeaveButton onLeave={onLeave} />
      </div>
    </>
  );
}
