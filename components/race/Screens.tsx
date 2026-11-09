"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import LocalLink from "@/components/LocalLink";
import { MODE_NAME, PLAYERS, type Mode } from "@/lib/games/race/race";
import type { Lang } from "@/lib/i18n/lang";
import { plural as pluralFor, texts } from "@/lib/i18n/text";
import { useText } from "@/lib/i18n/useLang";
import { inviteFromLocation } from "@/lib/session/shared/inviteFromLocation";
import "./race.css";

/**
 * The screens every race room shares (lib/games/race/race.ts): join, lobby,
 * a round's frame, results, final standings. A game fills the slots (its
 * settings, its board or map) and gives the look through the `--race-*`
 * variables on its page (see race.css).
 */

/** The English mode names, as before; `modeName(mode, lang)` for the page's language. */
export { MODE_NAME };

/** Each mode's name in each language (docs/i18n.md's glossary: Défi, Survie). */
export const MODE_NAMES = texts<Record<Mode, string>>({
  en: MODE_NAME,
  fr: { challenge: "Défi", survival: "Survie" },
});

/** "Challenge" / "Défi". */
export const modeName = (mode: Mode, lang: Lang = "en") => MODE_NAMES[lang][mode];

/**
 * Why a game of this mode can't start with this many players, or null if it
 * can: `startProblem` (lib/games/race/race.ts) in the page's language.
 */
export function raceStartProblem(mode: Mode, players: number, lang: Lang = "en"): string | null {
  const { min, max } = PLAYERS[mode];
  if (players < min) return TEXT[lang].needsAtLeast(modeName(mode, lang), min);
  if (players > max) return TEXT[lang].atMost(modeName(mode, lang), max);
  return null;
}

const TEXT = texts({
  en: {
    home: "Back to all games",
    leave: "Leave room",
    full: "This room is full",
    joinTitle: (mode: string) => `Join the race: ${mode}`,
    atMost: (mode: string, max: number) => `${mode} is for ${max} players at most.`,
    needsAtLeast: (mode: string, min: number) => `${mode} needs at least ${min} players.`,
    canWatch: "You can watch.",
    yourName: "Your name",
    namePlaceholder: "What should others call you?",
    join: "Join",
    joinNext: "Join (from the next game)",
    watch: "Watch",
    invite: "Invite friends with the link. Room",
    copied: "Copied!",
    copy: "Copy invite link",
    nameRoom: "Name this room (optional)",
    online: "online",
    offline: "offline",
    host: "Host",
    you: "You",
    youAfterName: " (you)",
    matchmaking: "Matchmaking",
    privateRoom: "Private room",
    players: (n: number, max: number) => `Players: ${n} of ${max}`,
    start: "Start the race",
    waitingHost: (host: string | null) => `Waiting for ${host ?? "the host"} to start…`,
    board: "The race",
    timeLeft: (time: string) => `Time left ${time}`,
    waitingOthers: "Waiting for the others…",
    gaveUp: (unit: string) => `You gave up this ${unit}. Waiting for the others…`,
    out: "You're out. Watching the others…",
    watching: "Watching.",
    giveUpAsk: (unit: string) => `Give up this ${unit}?`,
    keepGoing: "Keep going",
    giveUp: "Give up",
    giveUpMenu: "Give up…",
    outPill: "Out",
    finalStandings: "Final standings",
    playAgain: "Play again",
    settings: "Change mode or settings",
  },
  fr: {
    home: "Retour à tous les jeux",
    leave: "Quitter le salon",
    full: "Ce salon est complet",
    joinTitle: (mode) => `Rejoins la course : ${mode}`,
    atMost: (mode, max) => `Le mode ${mode} se joue à ${max} joueurs au maximum.`,
    needsAtLeast: (mode, min) => `Il faut au moins ${min} joueurs pour le mode ${mode}.`,
    canWatch: "Tu peux regarder.",
    yourName: "Ton nom",
    namePlaceholder: "Le nom que les autres verront",
    join: "Rejoindre",
    joinNext: "Rejoindre (dès la prochaine partie)",
    watch: "Regarder",
    invite: "Invite tes amis avec le lien. Salon",
    copied: "Copié !",
    copy: "Copier le lien d'invitation",
    nameRoom: "Nomme ce salon (facultatif)",
    online: "en ligne",
    offline: "hors ligne",
    host: "Hôte",
    you: "Toi",
    youAfterName: " (toi)",
    matchmaking: "Partie rapide",
    privateRoom: "Salon privé",
    players: (n, max) => `Joueurs : ${n} sur ${max}`,
    start: "Lancer la course",
    waitingHost: (host) => (host ? `On attend que ${host} lance la course…` : "On attend que l'hôte lance la course…"),
    board: "La course",
    timeLeft: (time) => `Temps restant ${time}`,
    waitingOthers: "On attend les autres…",
    // A round is a "manche" whatever the game calls it (a route, a puzzle): no gender to match.
    gaveUp: () => "Tu as abandonné cette manche. On attend les autres…",
    out: "La course est finie pour toi. Tu regardes les autres…",
    watching: "Tu regardes la course.",
    giveUpAsk: () => "Abandonner cette manche ?",
    keepGoing: "Je continue",
    giveUp: "Abandonner",
    giveUpMenu: "Abandonner…",
    outPill: "Hors course",
    finalStandings: "Classement final",
    playAgain: "Rejouer",
    settings: "Changer de mode ou de réglages",
  },
});

/** "1:05" from ms (the same in both languages). */
export function formatTime(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
}

/**
 * "3 routes": `n` and `word`, plural by the language's rule (French says
 * "0 manche"). `many` is the plural when it isn't `word` + "s" ("parcours").
 */
export const plural = (n: number, word: string, lang: Lang = "en", many = `${word}s`) => `${n} ${pluralFor(lang, n, word, many)}`;

export function Message({ text, home }: { text: string; home?: boolean }) {
  const t = useText(TEXT);
  return (
    <section className="race-card">
      <p className="race-status">{text}</p>
      {home ? (
        <LocalLink href="/" className="race-button race-button-wide race-link-button">
          {t.home}
        </LocalLink>
      ) : null}
    </section>
  );
}

export function LeaveButton({ onLeave }: { onLeave: () => void }) {
  const t = useText(TEXT);
  return (
    <button type="button" className="race-button" onClick={onLeave}>
      {t.leave}
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
  const t = useText(TEXT);
  const names = useText(MODE_NAMES);
  const [typed, setTyped] = useState<string | null>(null);
  const name = typed ?? defaultName;
  const id = useId();
  return (
    <section className="race-card" aria-labelledby={`${id}-title`}>
      <h2 id={`${id}-title`} className="race-card-title">
        {full ? t.full : t.joinTitle(names[mode])}
      </h2>
      {full ? (
        <p className="race-note">
          {t.atMost(names[mode], PLAYERS[mode].max)} {t.canWatch}
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
            {t.yourName}
          </label>
          <input id={`${id}-name`} className="race-input" value={name} maxLength={24} autoComplete="nickname" onChange={(e) => setTyped(e.target.value)} placeholder={t.namePlaceholder} />
          <button type="submit" className="race-button race-button-primary race-button-wide" disabled={!name.trim()}>
            {underway ? t.joinNext : t.join}
          </button>
        </form>
      )}
      <div className="race-footer">
        {full || underway ? (
          <button type="button" className="race-button" onClick={onWatch}>
            {t.watch}
          </button>
        ) : null}
        <LeaveButton onLeave={onLeave} />
      </div>
    </section>
  );
}

/** The invite: the link to copy, the code, and (the host only) the room's name. */
export function InviteCard({ room, roomName, onRename, nameError }: { room: string; roomName?: string; onRename?: (name: string) => void; nameError?: string | null }) {
  const t = useText(TEXT);
  const [copied, setCopied] = useState(false);
  const [draft, setDraft] = useState<string | null>(null);
  const id = useId();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => clearTimeout(timer.current ?? undefined), []);
  const copy = async () => {
    try {
      // The room's invite page in this page's language, not the address as it is (lib/share.ts).
      await navigator.clipboard.writeText(inviteFromLocation(window.location));
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
        {t.invite} <strong>{roomName || room.toUpperCase()}</strong>
      </p>
      <button type="button" className="race-button race-button-primary" onClick={copy}>
        <span aria-live="polite">{copied ? t.copied : t.copy}</span>
      </button>
      {onRename ? (
        <label htmlFor={`${id}-room`} className="race-field-label">
          {t.nameRoom}
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
  const t = useText(TEXT);
  return (
    <ul className="race-players">
      {players.map((p) => (
        <li key={p.seat} className="race-player" data-me={p.me ? "" : undefined}>
          <span className="race-dot" data-online={p.online ? "" : undefined} aria-label={p.online ? t.online : t.offline} role="img" />
          <span className="race-player-name">{p.name}</span>
          {p.host ? <span className="race-pill">{t.host}</span> : null}
          {p.me ? <span className="race-pill">{t.you}</span> : null}
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
  const t = useText(TEXT);
  const names = useText(MODE_NAMES);
  const id = useId();
  return (
    <>
      <section className="race-card" aria-labelledby={`${id}-title`}>
        <p className="race-kicker">{isPublic ? t.matchmaking : t.privateRoom}</p>
        <h2 id={`${id}-title`} className="race-card-title">
          {names[mode]}
        </h2>
        {settings}
        <p className="race-note race-rules">{rules}</p>
      </section>

      <section className="race-card" aria-labelledby={`${id}-players`}>
        <h2 id={`${id}-players`} className="race-card-title">
          {t.players(players.length, PLAYERS[mode].max)}
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
              {t.start}
            </button>
          </>
        ) : (
          <p className="race-status">{problem ?? t.waitingHost(hostName)}</p>
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
  const t = useText(TEXT);
  return (
    <ol className="race-board" aria-label={t.board}>
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
  const t = useText(TEXT);
  const [asking, setAsking] = useState(false);
  const playing = me.kind === "playing";
  return (
    <>
      <div className="race-bar">
        <span className="race-kicker">{roundLabel}</span>
        <span className="race-time race-clock" data-low={timeLeft < 30_000 ? "" : undefined} aria-label={t.timeLeft(formatTime(timeLeft))}>
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
          {me.text} {t.waitingOthers}
        </p>
      ) : me.kind === "gaveUp" ? (
        <p className="race-status race-me">{t.gaveUp(unit)}</p>
      ) : me.kind === "out" ? (
        <p className="race-status race-me">{t.out}</p>
      ) : me.kind === "watching" ? (
        <p className="race-status race-me">{t.watching}</p>
      ) : null}
      {playing ? afterStage : null}
      <ProgressBoard rows={board} />
      {below}
      <div className="race-footer">
        {playing ? actions : null}
        {playing && countdown === null ? (
          asking ? (
            <>
              <span className="race-note">{t.giveUpAsk(unit)}</span>
              <button type="button" className="race-button" onClick={() => setAsking(false)}>
                {t.keepGoing}
              </button>
              <button
                type="button"
                className="race-button race-button-danger"
                onClick={() => {
                  setAsking(false);
                  onGiveUp();
                }}
              >
                {t.giveUp}
              </button>
            </>
          ) : (
            <button type="button" className="race-button" onClick={() => setAsking(true)}>
              {t.giveUpMenu}
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
  const t = useText(TEXT);
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
                  {row.me ? <span className="race-you">{t.youAfterName}</span> : null}
                  {row.out ? <span className="race-pill race-pill-out">{t.outPill}</span> : null}
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
  const t = useText(TEXT);
  const id = useId();
  return (
    <>
      <section className="race-card" aria-labelledby={`${id}-final`}>
        <p className="race-kicker">{t.finalStandings}</p>
        <h2 id={`${id}-final`} className="race-card-title race-final-title">
          {headline}
        </h2>
        <ol className="race-results">
          {rows.map((row, i) => (
            <li key={row.seat} className="race-result race-result-static" data-me={row.me ? "" : undefined} data-winner={i === 0 ? "" : undefined}>
              <span className="race-rank">{i + 1}</span>
              <span className="race-result-name">
                {row.name}
                {row.me ? <span className="race-you">{t.youAfterName}</span> : null}
              </span>
              <span className="race-result-time">{row.value}</span>
              <span className="race-result-detail">{row.detail}</span>
            </li>
          ))}
        </ol>
        {againProblem ? <p className="race-note race-problem">{againProblem}</p> : null}
        {canPlayAgain ? (
          <button type="button" className="race-button race-button-primary race-button-wide" disabled={againProblem !== null} onClick={onPlayAgain}>
            {t.playAgain}
          </button>
        ) : null}
      </section>
      <div className="race-footer">
        {onSettings ? (
          <button type="button" className="race-button" onClick={onSettings}>
            {t.settings}
          </button>
        ) : null}
        <LeaveButton onLeave={onLeave} />
      </div>
    </>
  );
}
