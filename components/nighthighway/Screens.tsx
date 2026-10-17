"use client";

import Link from "next/link";
import { type ReactNode, useState } from "react";
import type { Role } from "@/lib/session/types";
import type { GameState, RaceOptions, RunResult } from "@/lib/games/nighthighway/game";

/**
 * The race page's own screens, drawn over the road in the original title
 * card's style (bottom-left, film title card). Class names are the
 * original stylesheet's (./nighthighway.css) plus ./screens.css's nh-* ones.
 */

const fmt = (n: number) => Math.floor(n).toLocaleString("en-US");

/** A title-card screen, with the back link to the hub in the top corner. */
export function Card({ children, back = true }: { children: ReactNode; back?: boolean }) {
  return (
    <section className="layer screen nh-screen">
      {back ? (
        // Every game keeps a way back to the hub (see components/Header.tsx).
        <Link href="/" className="nh-back" aria-label="Back to all games">
          ←
        </Link>
      ) : null}
      <div className="card">{children}</div>
    </section>
  );
}

function Wordmark() {
  return (
    <h1 className="wordmark nh-wordmark">
      <span>Night</span>
      <span className="hot">Highway</span>
    </h1>
  );
}

/** A full-screen message (connection trouble, an unknown room). */
export function Message({ text }: { text: string }) {
  return (
    <Card>
      <Wordmark />
      <p role="alert" className="lede">
        {text}
      </p>
    </Card>
  );
}

/** Pick a seat by typing a name - or, when both seats are held, take over one whose driver has been gone a while. */
export function NameEntry({
  names,
  canTakeOver,
  onPick,
}: {
  names: Partial<Record<Role, string>>;
  canTakeOver: Partial<Record<Role, boolean>>;
  onPick: (role: Role, name: string) => void;
}) {
  const [draft, setDraft] = useState("");
  const [error, setError] = useState("");
  const open: Role | null = !names.p1 ? "p1" : !names.p2 ? "p2" : null;
  const otherName = names.p1 ?? names.p2;

  const submit = () => {
    const name = draft.trim();
    if (!name) {
      setError("Enter your name to race.");
      return;
    }
    setError("");
    if (open) onPick(open, name);
  };

  return (
    <Card>
      <p className="kicker">60 seconds · one road · two drivers</p>
      <Wordmark />
      {open ? (
        <>
          <p className="lede">
            {otherName
              ? `${otherName} is waiting at the start line. What's your name?`
              : "Race a friend down the same road after midnight: same traffic, same clock, highest score wins. What's your name?"}
          </p>
          <form
            className="row"
            onSubmit={(e) => {
              e.preventDefault();
              submit();
            }}
          >
            <input
              className="nh-field"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="Your name"
              maxLength={24}
              aria-label="Your name"
              aria-invalid={error ? true : undefined}
              aria-describedby={error ? "nh-name-error" : undefined}
              autoComplete="nickname"
            />
            <button className="cta" type="submit">
              Continue
            </button>
          </form>
          {error ? (
            <p id="nh-name-error" role="alert" className="note nh-error">
              {error}
            </p>
          ) : null}
        </>
      ) : (
        <>
          <p className="lede">
            {canTakeOver.p1 || canTakeOver.p2
              ? "Welcome back! Which driver are you on this device?"
              : "Both seats are taken. A seat frees up 2 minutes after its driver goes offline."}
          </p>
          <div className="row">
            {(["p1", "p2"] as Role[]).map((role) => (
              <button key={role} className="cta" type="button" disabled={!canTakeOver[role]} onClick={() => onPick(role, names[role]!)}>
                {canTakeOver[role] ? `I'm ${names[role]}` : `${names[role]} is driving`}
              </button>
            ))}
          </div>
        </>
      )}
      <p className="note">
        Or <a href="/nighthighway/solo">drive solo</a>.
      </p>
    </Card>
  );
}

/** Seated, waiting for the second driver: the invite link (the shared InviteLinkBanner, passed in). */
export function WaitingForDriver({ invite }: { invite: ReactNode }) {
  return (
    <Card>
      <p className="kicker">Waiting for the other driver</p>
      <Wordmark />
      <p className="lede">Send them the link. You race the same road at the same time, and each of you sees the other as a ghost car.</p>
      <div className="nh-invite">{invite}</div>
      <p className="note">
        Waiting for a while? <a href="/nighthighway/solo">Practice solo</a> in the meantime.
      </p>
    </Card>
  );
}

const STATS: { label: string; get: (r: RunResult) => string }[] = [
  { label: "Score", get: (r) => fmt(r.score) },
  { label: "Distance", get: (r) => `${(r.distance / 1000).toFixed(2)} km` },
  { label: "Top speed", get: (r) => `${r.top} km/h` },
  { label: "Average", get: (r) => `${r.avg} km/h` },
  { label: "Near misses", get: (r) => String(r.nearMiss) },
  { label: "Overtakes", get: (r) => String(r.overtakes) },
  { label: "Crashes", get: (r) => String(r.crashes) },
];

/** Between races: the series score, the last race's results, and Ready. */
export function Lobby({
  game,
  me,
  other,
  names,
  otherOnline,
  onReady,
  onOptions,
  footer,
}: {
  game: GameState;
  me: Role;
  other: Role;
  names: Partial<Record<Role, string>>;
  otherOnline: boolean;
  onReady: (ready: boolean) => void;
  /** Flips a switch for the next race (either player can; it takes back both Readys). */
  onOptions: (change: Partial<RaceOptions>) => void;
  footer: ReactNode;
}) {
  const myName = names[me] ?? "You";
  const otherName = names[other] ?? "The other driver";
  const last = game.phase === "DONE" ? game.history.at(-1) : undefined;
  const iAmReady = Boolean(game.ready[me]);
  const theyAreReady = Boolean(game.ready[other]);
  const mine = game.results[me];
  const theirs = game.results[other];

  let headline = "Ready to race?";
  if (last) headline = last.winner === "tie" ? "Dead heat" : last.winner === me ? "You win" : `${otherName} wins`;

  return (
    <Card>
      <p className="kicker">
        {last ? `Race ${last.race} result` : "Start line"} · {myName} {game.wins[me]} – {game.wins[other]} {otherName}
      </p>
      <p className={`results-score nh-headline${last && last.winner === me ? " nh-win" : ""}`}>{headline}</p>
      {last && (mine || theirs) ? (
        <div className="nh-table-wrap">
          <table className="nh-table">
            <thead>
              <tr>
                <th scope="col">
                  <span className="sr-only">Stat</span>
                </th>
                <th scope="col">{myName}</th>
                <th scope="col">{otherName}</th>
              </tr>
            </thead>
            <tbody>
              {STATS.map(({ label, get }) => (
                <tr key={label}>
                  <th scope="row">{label}</th>
                  <td>{mine ? get(mine) : "Didn't finish"}</td>
                  <td>{theirs ? get(theirs) : "Didn't finish"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="lede">Same road, same traffic, same 60 seconds. Weave through it, chain near misses, and outscore {otherName}.</p>
      )}
      <div className="row nh-options" role="group" aria-label="Next race">
        {(
          [
            ["pickups", "Pickups"],
            ["rain", "Rain"],
            ["desert", "Desert"],
          ] as const
        ).map(([key, label]) => (
          <button key={key} type="button" role="switch" aria-checked={game.options[key]} className="nh-switch" onClick={() => onOptions({ [key]: !game.options[key] })}>
            {label}
          </button>
        ))}
      </div>
      <div className="row">
        <button className="cta" type="button" onClick={() => onReady(!iAmReady)} aria-pressed={iAmReady}>
          {iAmReady ? "Not ready" : last ? "Race again" : "Ready"}
        </button>
        <span className="note" aria-live="polite">
          {!otherOnline
            ? `${otherName} is offline.`
            : iAmReady && theyAreReady
              ? "Starting…"
              : iAmReady
                ? `Waiting for ${otherName}…`
                : theyAreReady
                  ? `${otherName} is ready.`
                  : "The race starts when you're both ready."}
        </span>
      </div>
      {footer}
    </Card>
  );
}

/** This device finished; the other driver hasn't yet. */
export function WaitingForResult({ result, otherName }: { result: RunResult; otherName: string }) {
  return (
    <Card back={false}>
      <p className="kicker">Run complete</p>
      <p className="results-score">{fmt(result.score)}</p>
      <p className="best" aria-live="polite">
        Waiting for {otherName} to finish…
      </p>
    </Card>
  );
}

/** The couple of seconds between both pressing Ready and the countdown. */
export function GetReady() {
  return (
    <div className="layer nh-getready" aria-live="assertive">
      <p>Get ready</p>
    </div>
  );
}

/** Room line under the lobby: the room's name or code, and the ways out. */
export function RoomLinks({ room, roomName, onNewRoom }: { room: string; roomName?: string; onNewRoom: () => void }) {
  return (
    <p className="note nh-links">
      Room {roomName || room} ·{" "}
      <button type="button" className="nh-linkbtn" onClick={onNewRoom}>
        New room
      </button>{" "}
      · <a href="/nighthighway/solo">Drive solo</a> · <Link href="/">All games</Link>
    </p>
  );
}
