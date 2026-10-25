"use client";

import Link from "next/link";
import { type ReactNode, useEffect, useRef, useState, useSyncExternalStore } from "react";
import type { SeatId } from "@/lib/session/types";
import { LANG_LABELS, LANGS, type Lang } from "@/lib/games/shared/language";
import { LENGTHS, MIN_PLAYERS, TOPIC_LABELS, TOPICS, type TopicId } from "@/lib/games/buzzerquiz/constants";
import type { Settings } from "@/lib/games/buzzerquiz/game";
import {
  Avatar,
  BackIcon,
  CrownIcon,
  DISPLAY,
  FOCUS,
  LABEL,
  PrimaryButton,
  ScoreBoard,
  type ScoreRow,
  SecondaryButton,
  Segmented,
  TEXT,
  TOPIC_ICONS,
} from "./ui";

/** Interface copy stays English; only the questions follow the room's language. */
const topicLabel = (topic: TopicId) => TOPIC_LABELS[topic].en;

const SCREEN = "min-h-screen bg-[var(--stage)] px-4 pb-10 pt-4 text-[var(--text)] min-[900px]:px-8 min-[900px]:pt-8";
const TITLE = `${DISPLAY} m-0 text-[28px] font-extrabold leading-tight min-[900px]:text-[40px]`;

function BackToHub() {
  return (
    <Link href="/" aria-label="Back to all games" className={`${FOCUS} flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[var(--surface)] text-[var(--text)]`}>
      <BackIcon size={22} />
    </Link>
  );
}

// ---- Message (connection error, missing room, connecting) -------------------------------

export function Message({ text }: { text: string }) {
  return (
    <div className={`${SCREEN} flex flex-col items-center justify-center gap-4 text-center`}>
      <p className={`${TEXT} m-0 max-w-[420px] text-[18px] font-bold`}>{text}</p>
      <Link href="/" className={`${TEXT} ${FOCUS} font-bold text-[var(--text-muted)] underline`}>
        Back to Game Room
      </Link>
    </div>
  );
}

// ---- Name entry -------------------------------------------------------------------------

/**
 * Taking a seat: a name for the first free seat, or - when every seat is held
 * by someone offline for 2 minutes - taking one of those over.
 */
export function NameEntry({ seats, names, canTakeOver, onPick, watching }: {
  seats: SeatId[];
  names: Partial<Record<SeatId, string>>;
  canTakeOver: Partial<Record<SeatId, boolean>>;
  onPick: (seat: SeatId, name: string) => void;
  /** Watch the game instead (the room is full, or a game is under way). */
  watching?: () => void;
}) {
  const [draft, setDraft] = useState("");
  const [error, setError] = useState("");
  const free = seats.find((seat) => !names[seat]);
  const takeable = seats.filter((seat) => names[seat] && canTakeOver[seat]);

  const submit = () => {
    const name = draft.trim();
    if (!name) {
      setError("Enter your name to continue.");
      return;
    }
    if (free) onPick(free, name);
  };

  return (
    <div className={SCREEN}>
      <div className="mx-auto flex max-w-[440px] flex-col gap-5">
        <div className="flex items-center gap-3">
          <BackToHub />
          <h1 className={TITLE}>Buzzer Quiz</h1>
        </div>
        {free ? (
          <form
            className="flex flex-col gap-3 rounded-[20px] bg-[var(--surface)] p-5"
            onSubmit={(e) => {
              e.preventDefault();
              submit();
            }}
          >
            <label htmlFor="bq-name" className={`${DISPLAY} text-[22px] font-extrabold`}>
              What&apos;s your name?
            </label>
            <input
              id="bq-name"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              maxLength={24}
              autoComplete="nickname"
              placeholder="Your name"
              className={`${TEXT} ${FOCUS} h-14 rounded-2xl border-0 bg-[var(--text)] px-4 text-[18px] font-bold text-[var(--ink)] placeholder:text-[#6b6590]`}
            />
            {error ? (
              <p role="alert" className={`${TEXT} m-0 text-[15px] font-bold text-[var(--points)]`}>
                {error}
              </p>
            ) : null}
            <PrimaryButton type="submit">Continue</PrimaryButton>
          </form>
        ) : (
          <div className="flex flex-col gap-3 rounded-[20px] bg-[var(--surface)] p-5">
            <p className={`${TEXT} m-0 text-[17px] font-bold`}>
              {takeable.length ? "Welcome back! Which one are you on this device?" : "All 4 seats are taken. A seat frees up 2 minutes after its player goes offline."}
            </p>
            {takeable.map((seat) => (
              <SecondaryButton key={seat} onClick={() => onPick(seat, names[seat]!)}>
                I&apos;m {names[seat]}
              </SecondaryButton>
            ))}
            {watching ? <SecondaryButton onClick={watching}>Just watch</SecondaryButton> : null}
          </div>
        )}
      </div>
    </div>
  );
}

// ---- Setup (host) -----------------------------------------------------------------------

function settingsFields({ settings, onLang, onTopic, onLength }: {
  settings: Settings;
  onLang: (lang: Lang) => void;
  onTopic: (topic: TopicId) => void;
  onLength: (length: number) => void;
}) {
  const count = settings.topics.length;
  return {
    language: (
      <section className="flex flex-col gap-2.5">
        <h2 className={LABEL}>Language</h2>
        <Segmented label="Language" options={LANGS.map((lang) => ({ value: lang, label: LANG_LABELS[lang] }))} value={settings.lang} onChange={onLang} />
      </section>
    ),
    topics: (
      <section className="flex flex-col gap-2.5">
        <div className="flex items-baseline justify-between gap-2">
          <h2 className={LABEL}>Topics</h2>
          <span className={`${TEXT} text-[14px] text-[var(--text-muted)]`}>{count === 0 ? "Pick at least one" : `${count} picked${count > 1 ? ", mixed" : ""}`}</span>
        </div>
        <div className="grid grid-cols-2 gap-2.5 min-[900px]:grid-cols-3">
          {TOPICS.map((topic) => {
            const on = settings.topics.includes(topic);
            return (
              <button
                key={topic}
                type="button"
                aria-pressed={on}
                onClick={() => onTopic(topic)}
                className={`${DISPLAY} ${FOCUS} relative flex h-[62px] cursor-pointer items-center gap-2.5 rounded-2xl px-3 text-left text-[17px] font-extrabold min-[900px]:h-[110px] min-[900px]:flex-col min-[900px]:items-start min-[900px]:justify-between min-[900px]:p-4`}
                style={{ background: on ? "var(--surface-2)" : "var(--surface)", border: `3px solid ${on ? "var(--points)" : "transparent"}`, color: "var(--text)" }}
              >
                <span style={{ color: on ? "var(--points)" : "var(--text-muted)" }}>{TOPIC_ICONS[topic]}</span>
                <span className="leading-tight">{topicLabel(topic)}</span>
                {on ? (
                  <span aria-hidden="true" className="absolute right-2 top-2 flex h-5 w-5 items-center justify-center rounded-full bg-[var(--points)] text-[var(--ink)]">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round">
                      <path d="m5 12.5 4.5 4.5L19 7.5" />
                    </svg>
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>
      </section>
    ),
    length: (
      <section className="flex flex-col gap-2.5">
        <h2 className={LABEL}>Questions</h2>
        <Segmented label="Questions" options={LENGTHS.map((n) => ({ value: n, label: String(n) }))} value={settings.length} onChange={onLength} />
      </section>
    ),
  };
}

export function Setup({ settings, onLang, onTopic, onLength, onContinue }: {
  settings: Settings;
  onLang: (lang: Lang) => void;
  onTopic: (topic: TopicId) => void;
  onLength: (length: number) => void;
  onContinue: () => void;
}) {
  const fields = settingsFields({ settings, onLang, onTopic, onLength });
  const cta = (
    <div className="flex flex-col gap-2.5">
      <PrimaryButton disabled={!settings.topics.length} onClick={onContinue}>
        Continue to the waiting room
      </PrimaryButton>
      <p className={`${TEXT} m-0 text-center text-[15px] text-[var(--text-muted)]`}>Next you&apos;ll get a link to send to your friends.</p>
    </div>
  );
  return (
    <div className={SCREEN}>
      <div className="mx-auto flex max-w-[1040px] flex-col gap-6">
        <div className="flex items-center gap-3">
          <BackToHub />
          <h1 className={TITLE}>New quiz</h1>
        </div>
        <div className="flex flex-col gap-6 min-[900px]:grid min-[900px]:grid-cols-[minmax(300px,360px)_1fr] min-[900px]:gap-10">
          <div className="flex flex-col gap-6">
            {fields.language}
            {fields.length}
            <ScoringNote />
          </div>
          <div className="flex flex-col gap-6">
            {fields.topics}
            {cta}
          </div>
        </div>
      </div>
    </div>
  );
}

function ScoringNote() {
  return (
    <div className={`${TEXT} hidden rounded-2xl bg-[var(--surface)] p-4 text-[15px] leading-relaxed text-[var(--text-muted)] min-[900px]:block`}>
      <p className={`${DISPLAY} m-0 mb-1.5 text-[17px] font-extrabold text-[var(--text)]`}>How scoring works</p>
      Buzz, then pick. Right with 4 choices left scores 3, with 3 left 2, with 2 left 1. A wrong pick is struck out for everyone, and you&apos;re out until
      the next question.
    </div>
  );
}

// ---- Invite card ------------------------------------------------------------------------

const noSubscribe = () => () => {};

/** "Invite friends": the room link, a Copy button, and (creator only) the room's name. */
export function InviteCard({ room, roomName, onRename, nameError }: { room: string; roomName?: string; onRename?: (name: string) => void; nameError: string | null }) {
  // The link needs the page's origin, which the server render doesn't have.
  const origin = useSyncExternalStore(noSubscribe, () => window.location.origin, () => "");
  const link = `${origin}/buzzerquiz#${room}`;
  const [copied, setCopied] = useState(false);
  const [draft, setDraft] = useState(roomName ?? "");
  const nameRef = useRef<HTMLInputElement>(null);
  // Follow a rename that lands while the field isn't being edited.
  useEffect(() => {
    if (document.activeElement === nameRef.current) return;
    const id = setTimeout(() => setDraft(roomName ?? ""), 0);
    return () => clearTimeout(id);
  }, [roomName]);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // No clipboard (permissions, insecure context): the link is on screen to copy by hand.
    }
  };
  const save = () => {
    if (onRename && draft.trim() !== (roomName ?? "")) onRename(draft);
  };
  return (
    <section className="flex flex-col gap-3 rounded-[20px] bg-[var(--surface)] p-4">
      <h2 className={LABEL}>Invite friends</h2>
      <div className="flex items-center gap-2">
        <span className={`${TEXT} min-w-0 flex-1 truncate rounded-xl bg-[var(--surface-dim)] px-3 py-3 text-[15px] text-[var(--text-muted)]`}>{link.replace(/^https?:\/\//, "")}</span>
        <button
          type="button"
          onClick={copy}
          className={`${DISPLAY} ${FOCUS} h-12 shrink-0 cursor-pointer rounded-xl border-2 border-[var(--ink)] bg-[var(--buzz)] px-4 text-[17px] font-extrabold text-[var(--ink)] shadow-[0_4px_0_var(--buzz-ring)] active:translate-y-1 active:shadow-none`}
        >
          {copied ? "Copied!" : "Copy"}
        </button>
      </div>
      <p aria-live="polite" className="sr-only">
        {copied ? "Link copied" : ""}
      </p>
      {onRename ? (
        <label className={`${TEXT} flex flex-col gap-1.5 text-[14px] font-bold text-[var(--text-muted)]`}>
          Name this room (optional)
          <input
            ref={nameRef}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={save}
            onKeyDown={(e) => {
              if (e.key === "Enter") e.currentTarget.blur();
            }}
            placeholder={room}
            maxLength={40}
            aria-invalid={nameError ? true : undefined}
            aria-describedby={nameError ? "bq-room-name-error" : undefined}
            className={`${TEXT} ${FOCUS} h-11 rounded-xl border-2 bg-[var(--surface-dim)] px-3 text-[16px] font-bold text-[var(--text)] placeholder:text-[var(--text-struck)] ${nameError ? "border-[var(--buzz)]" : "border-transparent"}`}
          />
        </label>
      ) : null}
      {nameError ? (
        <p id="bq-room-name-error" role="alert" className={`${TEXT} m-0 text-[14px] font-bold text-[var(--points)]`}>
          {nameError}
        </p>
      ) : null}
    </section>
  );
}

// ---- Waiting room -----------------------------------------------------------------------

/** A public room's lobby (matchmaking, docs/matchmaking.md): no host, so the start block says when the game starts by itself. */
export interface MatchLobby {
  /** "Starting in 12 s", "Waiting for more players…" */
  status: string;
  onLeave: () => void;
}

function MatchStatus({ status, onLeave }: MatchLobby) {
  return (
    <section className="flex flex-col gap-3 rounded-2xl bg-[var(--surface)] p-4">
      <h2 className={LABEL}>Playing online</h2>
      <p role="status" aria-live="polite" className={`${DISPLAY} m-0 text-[22px] font-extrabold`}>
        {status}
      </p>
      <p className={`${TEXT} m-0 text-[15px] text-[var(--text-muted)]`}>The quiz starts by itself once enough players are here.</p>
      <SecondaryButton onClick={onLeave}>Leave room</SecondaryButton>
    </section>
  );
}

export function Lobby({ room, seats, names, me, hostSeat, isHost, settings, inSetup, invite, match, onEdit, onStart }: {
  room: string;
  seats: SeatId[];
  names: Partial<Record<SeatId, string>>;
  me: SeatId | null;
  hostSeat: SeatId | null;
  isHost: boolean;
  settings: Settings;
  /** The host is still choosing the topics. */
  inSetup: boolean;
  invite: ReactNode;
  /** Set in a public room: replaces the host's Start (and the wait for the host). */
  match?: MatchLobby;
  onEdit: () => void;
  onStart: () => void;
}) {
  const joined = seats.filter((seat) => names[seat]);
  const hostName = hostSeat ? names[hostSeat] : undefined;
  const player = (seat: SeatId) => {
    const name = names[seat];
    if (!name) {
      return (
        <li key={seat} className={`${TEXT} flex h-[58px] items-center rounded-2xl border-2 border-dashed border-[var(--line-dashed)] px-4 text-[16px] text-[var(--text-muted)] min-[900px]:h-[120px] min-[900px]:justify-center`}>
          Waiting for a player…
        </li>
      );
    }
    return (
      <li key={seat} className="flex h-[58px] items-center gap-3 rounded-2xl bg-[var(--surface)] px-3 min-[900px]:h-auto min-[900px]:min-h-[120px] min-[900px]:flex-col min-[900px]:justify-center min-[900px]:gap-1.5 min-[900px]:py-3">
        <span className="min-[900px]:hidden"><Avatar seat={seat} name={name} size={38} /></span>
        <span className="hidden min-[900px]:block"><Avatar seat={seat} name={name} size={60} /></span>
        <span className={`${DISPLAY} min-w-0 flex-1 truncate text-[18px] font-extrabold min-[900px]:flex-none`}>
          {name}
          {seat === me ? <span className={`${TEXT} ml-1.5 text-[14px] font-bold text-[var(--text-muted)]`}>(you)</span> : null}
        </span>
        {seat === hostSeat ? (
          <span className={`${TEXT} flex items-center gap-1 text-[14px] font-bold text-[var(--points)]`}>
            <CrownIcon size={18} /> Host
          </span>
        ) : null}
      </li>
    );
  };
  const chips = (
    <section className="flex flex-col gap-2.5">
      <div className="flex items-baseline justify-between">
        <h2 className={LABEL}>The quiz</h2>
        {isHost ? (
          <button type="button" onClick={onEdit} className={`${TEXT} ${FOCUS} cursor-pointer border-0 bg-transparent p-0 text-[15px] font-bold text-[var(--points)] underline`}>
            Edit
          </button>
        ) : null}
      </div>
      {inSetup ? (
        <p className={`${TEXT} m-0 text-[16px] text-[var(--text-muted)]`}>{hostName ?? "The host"} is choosing the topics…</p>
      ) : (
        <ul className="m-0 flex list-none flex-wrap gap-2 p-0">
          <li className={`${TEXT} rounded-full bg-[var(--surface)] px-3 py-1.5 text-[14px] font-bold`}>{LANG_LABELS[settings.lang]}</li>
          <li className={`${TEXT} rounded-full bg-[var(--surface)] px-3 py-1.5 text-[14px] font-bold`}>{settings.length} questions</li>
          {settings.topics.map((topic) => (
            <li key={topic} className={`${TEXT} rounded-full border-2 border-[var(--points)] px-3 py-1 text-[14px] font-bold text-[var(--points)]`}>
              {topicLabel(topic)}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
  const start = match ? (
    <MatchStatus {...match} />
  ) : isHost ? (
    <div className="flex flex-col gap-2">
      <PrimaryButton disabled={joined.length < MIN_PLAYERS || inSetup} onClick={onStart}>
        {joined.length < MIN_PLAYERS ? `Needs ${MIN_PLAYERS} players` : `Start with ${joined.length} players`}
      </PrimaryButton>
    </div>
  ) : (
    <p className={`${TEXT} m-0 rounded-2xl bg-[var(--surface)] p-4 text-center text-[16px] font-bold text-[var(--text-muted)]`}>
      Waiting for {hostName ?? "the host"} to start
    </p>
  );
  return (
    <div className={SCREEN}>
      <div className="mx-auto flex max-w-[1040px] flex-col gap-5">
        <div className="flex items-center gap-3">
          <BackToHub />
          <h1 className={`${TITLE} flex-1`}>Waiting room</h1>
          <span className={`${DISPLAY} rounded-full bg-[var(--surface)] px-3 py-1.5 text-[15px] font-extrabold tracking-[0.06em]`}>{room}</span>
        </div>
        <div className="flex flex-col gap-5 min-[900px]:grid min-[900px]:grid-cols-[1fr_320px] min-[900px]:gap-8">
          <section className="flex flex-col gap-2.5 min-[900px]:order-1">
            <h2 className={LABEL}>Players · {joined.length} of {seats.length}</h2>
            <ul className="m-0 flex list-none flex-col gap-2 p-0 min-[900px]:grid min-[900px]:grid-cols-2 min-[900px]:gap-3">{seats.map(player)}</ul>
          </section>
          <div className="flex flex-col gap-5 min-[900px]:order-2">
            {invite}
            {chips}
            {start}
          </div>
        </div>
      </div>
    </div>
  );
}

// ---- Countdown --------------------------------------------------------------------------

export function Countdown({ seconds, index, total, topic, scores }: { seconds: number; index: number; total: number; topic?: TopicId; scores: ScoreRow[] }) {
  const size = 230;
  const r = (size - 14) / 2;
  const c = 2 * Math.PI * r;
  return (
    <div className={SCREEN}>
      <div className="mx-auto flex max-w-[1040px] flex-col items-center gap-6">
        <div className="w-full max-w-[600px]">
          <ScoreBoard rows={scores} />
        </div>
        <p className={`${DISPLAY} m-0 text-[20px] font-extrabold`}>
          Question {index + 1} of {total}
        </p>
        {topic ? <p className={`${LABEL} -mt-4`}>{topicLabel(topic)}</p> : null}
        <div role="timer" aria-label={`Starting in ${seconds} seconds`} className="relative" style={{ width: size, height: size }}>
          <svg aria-hidden="true" width={size} height={size} className="-rotate-90">
            <circle cx={size / 2} cy={size / 2} r={r} stroke="var(--surface-2)" strokeWidth={14} fill="none" />
            <circle cx={size / 2} cy={size / 2} r={r} stroke="var(--buzz)" strokeWidth={14} fill="none" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - seconds / 3)} />
          </svg>
          <span aria-hidden="true" className={`${DISPLAY} absolute inset-0 flex items-center justify-center text-[130px] font-extrabold leading-none`}>
            {Math.max(1, seconds)}
          </span>
        </div>
        <p className={`${TEXT} m-0 text-[17px] text-[var(--text-muted)]`}>Thumb on the buzzer…</p>
      </div>
    </div>
  );
}

// ---- Final ranking ----------------------------------------------------------------------

export function Final({ rows, me, canRematch, isHost, onRematch, onNewTopics }: {
  rows: { seat: SeatId; name: string; score: number; rank: number }[];
  me: SeatId | null;
  canRematch: boolean;
  isHost: boolean;
  onRematch: () => void;
  onNewTopics: () => void;
}) {
  const winners = rows.filter((row) => row.rank === 1);
  const title = winners.length === 1 ? `${winners[0].name} wins!` : `${winners.map((w) => w.name).slice(0, -1).join(", ")} and ${winners.at(-1)?.name} win!`;
  const ordinal = (n: number) => ["1st", "2nd", "3rd", "4th"][n - 1] ?? `${n}th`;
  return (
    <div className={SCREEN}>
      <div className="mx-auto flex max-w-[640px] flex-col gap-6">
        <div className="flex items-center gap-3">
          <BackToHub />
          <span className={`${LABEL}`}>Final ranking</span>
        </div>
        <div className="flex flex-col items-center gap-3 text-center">
          <span className="text-[var(--points)]"><CrownIcon size={44} /></span>
          <div className="flex -space-x-4 min-[900px]:hidden">
            {winners.map((w) => (
              <span key={w.seat} className="rounded-full ring-4 ring-[var(--stage)]">
                <Avatar seat={w.seat} name={w.name} size={winners.length > 1 ? 96 : 132} />
              </span>
            ))}
          </div>
          <h1 className={TITLE}>{title}</h1>
        </div>
        <Podium rows={rows} />
        <ol className="m-0 flex list-none flex-col gap-2 p-0 min-[900px]:hidden">
          {rows.map((row) => {
            const first = row.rank === 1;
            return (
              <li
                key={row.seat}
                className={`flex items-center gap-3 rounded-2xl px-3.5 ${first ? "h-16" : "h-[58px]"}`}
                style={{ background: first ? `var(--${row.seat})` : "var(--surface)", color: first ? "var(--ink)" : "var(--text)" }}
              >
                <span className={`${DISPLAY} w-11 text-[18px] font-extrabold`}>{ordinal(row.rank)}</span>
                <span className={`rounded-full ${first ? "ring-2 ring-[var(--ink)]" : ""}`}>
                  <Avatar seat={row.seat} name={row.name} size={36} />
                </span>
                <span className={`${DISPLAY} min-w-0 flex-1 truncate text-[19px] font-extrabold`}>
                  {row.name}
                  {row.seat === me ? <span className={`${TEXT} ml-1.5 text-[14px] font-bold opacity-75`}>(you)</span> : null}
                </span>
                <span className={`${DISPLAY} text-[24px] font-extrabold`}>{row.score}</span>
              </li>
            );
          })}
        </ol>
        <div className="flex flex-col gap-3 min-[600px]:flex-row">
          {canRematch ? <PrimaryButton onClick={onRematch}>Rematch</PrimaryButton> : null}
          {isHost ? <SecondaryButton onClick={onNewTopics}>New topics</SecondaryButton> : null}
        </div>
        <Link href="/" className={`${TEXT} ${FOCUS} self-center font-bold text-[var(--text-muted)] underline`}>
          Back to Game Room
        </Link>
      </div>
    </div>
  );
}

const ORDINALS = ["1st", "2nd", "3rd", "4th"];

/** Desktop: 2nd, 1st and 3rd as podium steps, a 4th player as a row below. */
function Podium({ rows }: { rows: { seat: SeatId; name: string; score: number; rank: number }[] }) {
  const [first, second, third, fourth] = rows;
  const step = (row: (typeof rows)[number] | undefined, height: number) =>
    row ? (
      <li key={row.seat} className="flex w-[180px] flex-col items-center gap-2">
        <Avatar seat={row.seat} name={row.name} size={56} />
        <span className={`${DISPLAY} max-w-full truncate text-[19px] font-extrabold`}>{row.name}</span>
        <div
          className="flex w-full flex-col items-center gap-1 rounded-t-2xl pt-3"
          style={{ height, background: row.rank === 1 ? `var(--${row.seat})` : "var(--surface)", color: row.rank === 1 ? "var(--ink)" : "var(--text)" }}
        >
          <span className={`${DISPLAY} text-[30px] font-extrabold leading-none`}>{row.score}</span>
          <span className={`${TEXT} text-[14px] font-bold opacity-75`}>{ORDINALS[row.rank - 1]}</span>
        </div>
      </li>
    ) : null;
  return (
    <div className="hidden flex-col items-center gap-3 min-[900px]:flex">
      <ol className="m-0 flex list-none items-end gap-3 p-0">
        {step(second, 150)}
        {step(first, 210)}
        {step(third, 110)}
      </ol>
      {fourth ? (
        <p className={`${TEXT} m-0 flex w-full items-center gap-3 rounded-2xl bg-[var(--surface)] px-4 py-3 text-[17px] font-bold`}>
          <span className="w-10">{ORDINALS[fourth.rank - 1]}</span>
          <Avatar seat={fourth.seat} name={fourth.name} size={32} />
          <span className="flex-1">{fourth.name}</span>
          <span className={`${DISPLAY} text-[22px] font-extrabold`}>{fourth.score}</span>
        </p>
      ) : null}
    </div>
  );
}

/** "Next question in 3" / "Results in 2". */
export function NextPill({ text }: { text: string }) {
  return <div className={`${DISPLAY} rounded-full bg-[var(--surface)] px-5 py-3 text-[18px] font-extrabold`}>{text}</div>;
}
