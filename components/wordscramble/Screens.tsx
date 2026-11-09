"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import LocalLink from "@/components/LocalLink";
import type { SeatId } from "@/lib/session/types";
import { gamePath } from "@/lib/games/registry";
import { LANG_LABELS, LANGS, type Lang } from "@/lib/games/shared/language";
import { GAME_SLUG, TARGETS, TURNS_PER_TEAM } from "@/lib/games/wordscramble/constants";
import type { Played, Settings } from "@/lib/games/wordscramble/game";
import { members, startProblem, type Team, TEAMS, type Teams } from "@/lib/games/wordscramble/teams";
import {
  Avatar,
  ChunkyButton,
  CrownIcon,
  DISPLAY,
  FOCUS,
  LABEL,
  seatName,
  Segmented,
  Stepper,
  TeamCard,
  teamColor,
  teamText,
  TEXT,
  Tile,
  TimerRing,
  TurnProgress,
} from "./ui";
import RulesButton from "./Rules";
import { COPY } from "./text";
import { useLang, useText } from "@/lib/i18n/useLang";
import { inviteUrl } from "@/lib/share";

export const SCREEN = "min-h-screen bg-[var(--table)] px-4 pb-10 pt-4 text-[var(--ink)] min-[900px]:px-8 min-[900px]:pt-8";
export const TITLE = `${DISPLAY} m-0 text-[30px] leading-tight min-[900px]:text-[44px]`;

/** A room's only way out (no back link): gives up the seat and goes to the hub. */
function LeaveRoom({ onLeave }: { onLeave: () => void }) {
  const t = useText(COPY);
  return (
    <button type="button" onClick={onLeave} className={`${TEXT} ${FOCUS} cursor-pointer self-center border-0 bg-transparent p-0 font-bold text-[var(--muted)] underline`}>
      {t.leaveRoom}
    </button>
  );
}

export function Message({ text }: { text: string }) {
  const t = useText(COPY);
  return (
    <div className={`${SCREEN} flex flex-col items-center justify-center gap-4 text-center`}>
      <p className={`${TEXT} m-0 max-w-[420px] text-[18px] font-bold`}>{text}</p>
      <LocalLink href="/" className={`${TEXT} ${FOCUS} font-bold text-[var(--muted)] underline`}>
        {t.backToHub}
      </LocalLink>
    </div>
  );
}

// ---- Name entry -------------------------------------------------------------------------

export function NameEntry({ seats, names, canTakeOver, onPick, watching, onLeave }: {
  seats: SeatId[];
  names: Partial<Record<SeatId, string>>;
  canTakeOver: Partial<Record<SeatId, boolean>>;
  onPick: (seat: SeatId, name: string) => void;
  watching?: () => void;
  onLeave: () => void;
}) {
  const t = useText(COPY);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState("");
  const free = seats.find((seat) => !names[seat]);
  const takeable = seats.filter((seat) => names[seat] && canTakeOver[seat]);
  return (
    <div className={SCREEN}>
      <div className="mx-auto flex max-w-[440px] flex-col gap-5">
        <div className="flex items-center justify-between gap-3">
          <h1 className={TITLE}>Word Scramble</h1>
          <RulesButton />
        </div>
        {free ? (
          <form
            className="flex flex-col gap-3 rounded-[22px] border-[3px] border-[var(--ink)] bg-white p-5 shadow-[0_6px_0_var(--ink)]"
            onSubmit={(e) => {
              e.preventDefault();
              const name = draft.trim();
              if (!name) return setError(t.nameRequired);
              onPick(free, name);
            }}
          >
            <label htmlFor="ws-name" className={`${DISPLAY} text-[24px]`}>
              {t.namePrompt}
            </label>
            <input
              id="ws-name"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              maxLength={24}
              autoComplete="nickname"
              placeholder={t.namePlaceholder}
              className={`${TEXT} ${FOCUS} h-14 rounded-2xl border-[3px] border-[var(--ink)] bg-[var(--table)] px-4 text-[18px] font-bold placeholder:text-[var(--muted)]`}
            />
            {error ? (
              <p role="alert" className={`${TEXT} m-0 text-[15px] font-bold text-[var(--wrong)]`}>
                {error}
              </p>
            ) : null}
            <ChunkyButton type="submit">{t.continue}</ChunkyButton>
          </form>
        ) : (
          <div className="flex flex-col gap-3 rounded-[22px] border-[3px] border-[var(--ink)] bg-white p-5">
            <p className={`${TEXT} m-0 text-[17px] font-bold`}>
              {takeable.length ? t.welcomeBack : t.roomFull}
            </p>
            {takeable.map((seat) => (
              <ChunkyButton key={seat} white onClick={() => onPick(seat, names[seat]!)}>
                {t.iAm(names[seat]!)}
              </ChunkyButton>
            ))}
            {watching ? (
              <ChunkyButton white onClick={watching}>
                {t.justWatch}
              </ChunkyButton>
            ) : null}
          </div>
        )}
        <LeaveRoom onLeave={onLeave} />
      </div>
    </div>
  );
}

// ---- Invite -----------------------------------------------------------------------------

const noSubscribe = () => () => {};

export function InviteRow({ room, roomName, onRename, nameError }: { room: string; roomName?: string; onRename?: (name: string) => void; nameError: string | null }) {
  const lang = useLang();
  const t = COPY[lang];
  // On screen, the room's plain address (the server render has no host); Copy link hands out the invite link.
  const host = useSyncExternalStore(noSubscribe, () => window.location.host, () => "");
  const shown = `${host}${gamePath(GAME_SLUG, lang)}#${room}`;
  const [copied, setCopied] = useState(false);
  const [draft, setDraft] = useState(roomName ?? "");
  const nameRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (document.activeElement === nameRef.current) return;
    const id = setTimeout(() => setDraft(roomName ?? ""), 0);
    return () => clearTimeout(id);
  }, [roomName]);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(inviteUrl(window.location.origin, GAME_SLUG, room, lang));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // No clipboard: the link is on screen to copy by hand.
    }
  };
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <span className={`${TEXT} min-w-0 flex-1 truncate rounded-xl border-2 border-[var(--line)] bg-white px-3 py-3 text-[15px] font-semibold text-[var(--muted)]`}>{shown}</span>
        <ChunkyButton onClick={copy} className="min-h-12 shrink-0 px-4 text-[16px]">
          {copied ? t.copied : t.copyLink}
        </ChunkyButton>
      </div>
      <p aria-live="polite" className="sr-only">
        {copied ? t.linkCopied : ""}
      </p>
      {onRename ? (
        <label className={`${TEXT} flex flex-col gap-1 text-[14px] font-bold text-[var(--muted)]`}>
          {t.nameRoom}
          <input
            ref={nameRef}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={() => draft.trim() !== (roomName ?? "") && onRename(draft)}
            onKeyDown={(e) => {
              if (e.key === "Enter") e.currentTarget.blur();
            }}
            placeholder={room}
            maxLength={40}
            aria-invalid={nameError ? true : undefined}
            aria-describedby={nameError ? "ws-room-name-error" : undefined}
            className={`${TEXT} ${FOCUS} h-11 rounded-xl border-2 bg-white px-3 text-[16px] font-bold text-[var(--ink)] ${nameError ? "border-[var(--wrong)]" : "border-[var(--line)]"}`}
          />
        </label>
      ) : null}
      {nameError ? (
        <p id="ws-room-name-error" role="alert" className={`${TEXT} m-0 text-[14px] font-bold text-[var(--wrong)]`}>
          {nameError}
        </p>
      ) : null}
    </div>
  );
}

// ---- Team lobby -------------------------------------------------------------------------

/** A public room's lobby (matchmaking, docs/matchmaking.md): no host, no settings; the game starts by itself with even teams. */
export interface MatchLobby {
  /** "Starting in 12 s", "Waiting for one more player to even the teams…" (in the page's language) */
  status: string;
  onLeave: () => void;
}

function MatchStatus({ status, onLeave, settings }: MatchLobby & { settings: Settings }) {
  const t = useText(COPY);
  return (
    <section className="flex flex-col gap-3 rounded-[22px] border-2 border-[var(--line)] bg-[var(--panel)] p-4 min-[900px]:flex-row min-[900px]:items-center min-[900px]:gap-5">
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <h2 className={LABEL}>{t.playingOnline(LANG_LABELS[settings.lang], settings.turnsPerTeam)}</h2>
        <p role="status" aria-live="polite" className={`${DISPLAY} m-0 text-[24px]`}>
          {status}
        </p>
        <p className={`${TEXT} m-0 text-[15px] font-bold text-[var(--muted)]`}>{t.evenedOut}</p>
      </div>
      <ChunkyButton white className="min-[900px]:w-[220px]" onClick={onLeave}>
        {t.leaveRoom}
      </ChunkyButton>
    </section>
  );
}

export function Lobby({ room, seats, joined, names, teams, me, hostSeat, isHost, settings, invite, match, onPickTeam, onSettings, onStart, onLeave }: {
  room: string;
  seats: SeatId[];
  joined: SeatId[];
  names: Partial<Record<SeatId, string>>;
  teams: Teams;
  me: SeatId | null;
  hostSeat: SeatId | null;
  isHost: boolean;
  settings: Settings;
  invite: React.ReactNode;
  /** Set in a public room: replaces the settings, Start and the even-teams warning, with its own Leave room. */
  match?: MatchLobby;
  onPickTeam: (team: Team) => void;
  onSettings: { lang: (lang: Lang) => void; mode: (mode: Settings["mode"]) => void; turns: (n: number) => void; target: (n: number) => void };
  onStart: () => void;
  onLeave: () => void;
}) {
  const lang = useLang();
  const t = COPY[lang];
  const nameOf = (seat: SeatId) => seatName(names, seat, lang);
  const problem = startProblem(teams, joined);
  const half = seats.length / 2;
  const column = (team: Team) => {
    const list = members(teams, joined, team);
    const mine = me != null && teams[me] === team;
    return (
      <section key={team} className="flex min-w-0 flex-col overflow-hidden rounded-[22px] border-[3px] border-[var(--ink)] bg-white shadow-[0_6px_0_var(--ink)]">
        <h2 className={`${DISPLAY} m-0 flex items-center justify-between px-3 py-2 text-[20px] min-[900px]:text-[24px]`} style={{ background: teamColor(team), color: teamText(team) }}>
          {t.team(team)} <span className="text-[18px]">{list.length}</span>
        </h2>
        <ul className="m-0 grid list-none gap-1.5 p-2 min-[900px]:grid-cols-2">
          {list.map((seat) => (
            <li key={seat} className="flex min-w-0 items-center gap-2 rounded-xl bg-[var(--table)] px-2 py-2">
              <Avatar team={team} name={nameOf(seat)} size={30} />
              <span className={`${TEXT} min-w-0 flex-1 truncate text-[15px] font-extrabold`}>
                {nameOf(seat)}
                {seat === me ? <span className="font-bold text-[var(--muted)]">{t.youTag}</span> : null}
              </span>
              {seat === hostSeat ? (
                <span title={t.host} className="text-[var(--warn-edge)]">
                  <CrownIcon size={16} />
                </span>
              ) : null}
            </li>
          ))}
          {list.length < half ? (
            <li className={`${TEXT} flex items-center justify-center rounded-xl border-2 border-dashed border-[var(--slot)] px-2 py-2.5 text-[14px] font-bold text-[var(--muted)]`}>{t.openSpot}</li>
          ) : null}
        </ul>
        {me && !mine ? (
          <div className="px-2 pb-2.5">
            <ChunkyButton white className="min-h-11 w-full text-[15px]" onClick={() => onPickTeam(team)}>
              {t.switchTo(team)}
            </ChunkyButton>
          </div>
        ) : null}
      </section>
    );
  };

  const settingsPanel = match ? (
    <MatchStatus {...match} settings={settings} />
  ) : isHost ? (
    <section className="flex flex-col gap-3 rounded-[22px] border-2 border-[var(--line)] bg-[var(--panel)] p-4 min-[900px]:flex-row min-[900px]:flex-wrap min-[900px]:items-end min-[900px]:gap-5">
      <div className="flex flex-col gap-1.5 min-[900px]:w-[240px]">
        <h3 className={LABEL}>{t.language}</h3>
        <Segmented label={t.language} options={LANGS.map((l) => ({ value: l, label: l.toUpperCase() }))} value={settings.lang} onChange={onSettings.lang} />
      </div>
      <div className="flex flex-col gap-1.5 min-[900px]:w-[260px]">
        <h3 className={LABEL}>{t.length}</h3>
        <Segmented label={t.length} options={[{ value: "turns" as const, label: t.turns }, { value: "target" as const, label: t.targetScore }]} value={settings.mode} onChange={onSettings.mode} />
      </div>
      <div className="min-[900px]:w-[260px]">
        {settings.mode === "turns" ? (
          <Stepper label={t.turnsPerTeam} value={settings.turnsPerTeam} min={TURNS_PER_TEAM.min} max={TURNS_PER_TEAM.max} onChange={onSettings.turns} />
        ) : (
          <Segmented label={t.targetScore} options={TARGETS.map((n) => ({ value: n, label: t.pts(n) }))} value={settings.target as (typeof TARGETS)[number]} onChange={onSettings.target} />
        )}
      </div>
      <div className="flex flex-col gap-1.5 min-[900px]:ml-auto min-[900px]:w-[260px]">
        <ChunkyButton disabled={problem != null} onClick={onStart}>
          {t.start}
        </ChunkyButton>
        {problem ? <p className={`${TEXT} m-0 text-center text-[14px] font-bold text-[var(--muted)]`}>{t.evenToStart}</p> : null}
      </div>
    </section>
  ) : (
    <p className={`${TEXT} m-0 rounded-[18px] border-2 border-[var(--line)] bg-[var(--panel)] p-4 text-center text-[16px] font-bold text-[var(--muted)]`}>
      {t.waitingForHost(LANG_LABELS[settings.lang], settings.mode === "turns" ? t.perTeam(settings.turnsPerTeam) : t.firstTo(settings.target), hostSeat ? nameOf(hostSeat) : null)}
    </p>
  );

  return (
    <div className={SCREEN}>
      <div className="mx-auto flex max-w-[1100px] flex-col gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className={`${TITLE} flex-1`}>{t.pickTeam}</h1>
          <span className={`${DISPLAY} rounded-full border-2 border-[var(--ink)] bg-white px-3 py-1 text-[16px] tracking-[0.06em]`}>{room}</span>
          <RulesButton />
        </div>
        {invite}
        <RulesButton variant="link" />
        <div className="grid grid-cols-2 gap-3 min-[900px]:gap-5">{TEAMS.map(column)}</div>
        {problem && joined.length > 0 && !match ? (
          <p role="status" className={`${TEXT} m-0 rounded-2xl border-2 border-[var(--warn-edge)] bg-[var(--warn)] px-4 py-3 text-[15px] font-bold text-[var(--warn-ink)]`}>
            {problem.short ? t.teamsUneven(problem.a, problem.b, problem.short) : joined.length < 2 ? t.waitingOneMore : t.everyonePick}
          </p>
        ) : null}
        {settingsPanel}
        {match ? null : <LeaveRoom onLeave={onLeave} />}
      </div>
    </div>
  );
}

// ---- Between turns ----------------------------------------------------------------------

export function SoFar({ history, words }: { history: Played[]; words: (id: string) => string }) {
  const t = useText(COPY);
  if (!history.length) return null;
  return (
    <section className="flex flex-col gap-2">
      <h2 className={LABEL}>{t.soFar}</h2>
      <ul className="m-0 flex list-none flex-col gap-1.5 p-0">
        {history.map((h, i) => (
          <li key={i} className={`${TEXT} flex items-center gap-3 rounded-xl bg-white px-3 py-2 text-[15px] font-bold`}>
            <span className="h-3 w-3 shrink-0 rounded-full" style={{ background: teamColor(h.team) }} aria-hidden="true" />
            <span className="min-w-16 shrink-0 whitespace-nowrap text-[var(--muted)]">{t.team(h.team)}</span>
            <span className="min-w-0 flex-1 truncate uppercase">{words(h.wordId)}</span>
            <span className={DISPLAY}>{h.points ? `+${h.points}` : "0"}</span>
            {h.steal ? (
              <span className={`${TEXT} rounded-full px-2 py-0.5 text-[13px] font-extrabold`} style={{ background: teamColor(h.team === "A" ? "B" : "A"), color: teamText(h.team === "A" ? "B" : "A") }}>
                {t.stealTag(h.steal > 0 ? `+${h.steal}` : `−${-h.steal}`)}
              </span>
            ) : null}
          </li>
        ))}
      </ul>
    </section>
  );
}

export function Scoreboard({ turn, total, totalLabel, scores, teamNames, history, words, nextTeam, seconds, fraction }: {
  turn: number;
  total: number | null;
  totalLabel: string;
  scores: Record<Team, number>;
  teamNames: Record<Team, string[]>;
  history: Played[];
  words: (id: string) => string;
  nextTeam: Team;
  seconds: number;
  fraction: number;
}) {
  const t = useText(COPY);
  return (
    <div className={SCREEN}>
      <div className="mx-auto flex max-w-[960px] flex-col gap-5">
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between gap-3">
            <p className={`${DISPLAY} m-0 text-[24px]`}>{totalLabel}</p>
            <RulesButton />
          </div>
          {total ? <TurnProgress total={total} played={turn + 1} /> : null}
        </div>
        <div className="grid grid-cols-1 items-center gap-3 min-[600px]:grid-cols-[1fr_auto_1fr]">
          <TeamCard team="A" score={scores.A} names={teamNames.A} />
          <span className={`${DISPLAY} hidden text-center text-[28px] text-[var(--muted)] min-[600px]:block`}>{t.vs}</span>
          <TeamCard team="B" score={scores.B} names={teamNames.B} />
        </div>
        <SoFar history={history} words={words} />
        <div className="flex items-center gap-4 rounded-[22px] border-[3px] px-4 py-3" style={{ borderColor: teamColor(nextTeam), background: "#FFFFFF" }}>
          <TimerRing seconds={seconds} fraction={fraction} team={nextTeam} label={t.nextTurnIn(seconds)} />
          <p className={`${DISPLAY} m-0 text-[22px]`}>{t.upNext(nextTeam)}</p>
        </div>
      </div>
    </div>
  );
}

/** Before the first word: who starts. */
export function GetReady({ team, seconds, mine }: { team: Team; seconds: number; mine: boolean }) {
  const t = useText(COPY);
  return (
    <div className={`${SCREEN} relative flex flex-col items-center justify-center gap-5 text-center`}>
      <div className="absolute top-4 right-4 min-[900px]:top-8 min-[900px]:right-8">
        <RulesButton />
      </div>
      <TimerRing seconds={seconds} fraction={seconds / 3} team={team} size={120} label={t.startingInSeconds(seconds)} />
      <p className={`${DISPLAY} m-0 text-[32px]`}>{mine ? t.yourTeamStarts : t.teamStarts(team)}</p>
      <p className={`${TEXT} m-0 text-[17px] font-bold text-[var(--muted)]`}>{mine ? t.getReady : t.youPlayNext}</p>
    </div>
  );
}

// ---- End ----------------------------------------------------------------------------------

export function End({ winner, scores, teamNames, found, summary, canRematch, onRematch, onShuffle, onLeave }: {
  winner: Team | "draw";
  scores: Record<Team, number>;
  teamNames: Record<Team, string[]>;
  found: Record<Team, number>;
  summary: string;
  canRematch: boolean;
  onRematch: () => void;
  onShuffle: () => void;
  onLeave: () => void;
}) {
  const t = useText(COPY);
  const title = winner === "draw" ? t.draw : t.teamWins(winner);
  const letters = winner === "draw" ? [...t.drawTiles] : [winner, ...t.winsTiles];
  // 52 px tiles, smaller when the word is longer (French), so the row fits a 375 px phone.
  const tile = Math.min(52, Math.floor((340 - (letters.length - 1) * 6) / letters.length));
  return (
    <div className={SCREEN}>
      <div className="mx-auto flex max-w-[900px] flex-col gap-5">
        <div className="flex justify-end">
          <RulesButton />
        </div>
        <div className="flex flex-col items-center gap-3 text-center">
          <span className="text-[var(--warn-edge)]">
            <CrownIcon size={40} />
          </span>
          <div aria-hidden="true" className="flex gap-1.5">
            {letters.map((l, i) => (
              <Tile key={i} letter={l} look={i === 0 && winner !== "draw" ? "team" : "wood"} team={winner === "draw" ? "A" : winner} size={tile} tilt={i % 2 ? 3 : -3} />
            ))}
          </div>
          <h1 className={TITLE}>{title}</h1>
          <p className={`${TEXT} m-0 text-[16px] font-bold text-[var(--muted)]`}>{summary}</p>
        </div>
        <div className="grid grid-cols-1 gap-3 min-[600px]:grid-cols-2">
          {TEAMS.map((team) => (
            <TeamCard key={team} team={team} score={scores[team]} names={teamNames[team]} loser={winner !== "draw" && winner !== team}>
              <p className={`${TEXT} m-0 text-[15px] font-extrabold`}>
                {t.wordsFound(found[team])}
              </p>
            </TeamCard>
          ))}
        </div>
        <div className="flex flex-col gap-3 min-[600px]:flex-row">
          {canRematch ? (
            <ChunkyButton className="flex-1" onClick={onRematch}>
              {t.rematch}
            </ChunkyButton>
          ) : null}
          <ChunkyButton white className="flex-1" onClick={onShuffle}>
            {t.shuffleTeams}
          </ChunkyButton>
        </div>
        <LeaveRoom onLeave={onLeave} />
      </div>
    </div>
  );
}

