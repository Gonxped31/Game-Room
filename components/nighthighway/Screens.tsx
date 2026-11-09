"use client";

import { type ReactNode, useState } from "react";
import LocalLink from "@/components/LocalLink";
import { useLocalHref, useText } from "@/lib/i18n/useLang";
import type { Role } from "@/lib/session/types";
import type { GameState, RaceOptions, RunResult } from "@/lib/games/nighthighway/game";
import RulesButton from "./Rules";
import { SCREENS_TEXT } from "./text";

/**
 * The race page's own screens, drawn over the road in the original title
 * card's style (bottom-left, film title card). Class names are the
 * original stylesheet's (./nighthighway.css) plus ./screens.css's nh-* ones.
 * Their words are in ./text.ts (SCREENS_TEXT).
 */

type Text = (typeof SCREENS_TEXT)["en"];

/** "Drive solo" / "Practice solo": a plain link to the solo page, in the page's language. */
function useSoloHref() {
  return useLocalHref("/nighthighway/solo");
}

/**
 * A title-card screen. Room screens have no back link: their way out is
 * "Leave room". Only `back` cards (no room to leave: an error, an unknown room)
 * get the link to the hub in the top corner; every other card has How to play's
 * ? in the opposite corner.
 */
export function Card({ children, back = false }: { children: ReactNode; back?: boolean }) {
  const t = useText(SCREENS_TEXT);
  return (
    <section className="layer screen nh-screen">
      {back ? (
        <LocalLink href="/" className="nh-back" aria-label={t.back}>
          ←
        </LocalLink>
      ) : (
        <span className="nh-rules">
          <RulesButton />
        </span>
      )}
      <div className="card">{children}</div>
    </section>
  );
}

/**
 * Phones and tablets only (screens.css shows it on a coarse pointer, so
 * nothing reads the device during render): Night Highway is heavy 3D, and
 * plays best on a computer (the registry's `bestOnComputer`).
 */
export function PhoneNote() {
  return <p className="nh-phone-note">{useText(SCREENS_TEXT).phoneNote}</p>;
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
    <Card back>
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
  onLeave,
}: {
  names: Partial<Record<Role, string>>;
  canTakeOver: Partial<Record<Role, boolean>>;
  onPick: (role: Role, name: string) => void;
  onLeave: () => void;
}) {
  const t = useText(SCREENS_TEXT);
  const soloHref = useSoloHref();
  const [draft, setDraft] = useState("");
  const [error, setError] = useState("");
  const open: Role | null = !names.p1 ? "p1" : !names.p2 ? "p2" : null;
  const otherName = names.p1 ?? names.p2;

  const submit = () => {
    const name = draft.trim();
    if (!name) {
      setError(t.nameRequired);
      return;
    }
    setError("");
    if (open) onPick(open, name);
  };

  return (
    <Card>
      <p className="kicker">{t.entryKicker}</p>
      <Wordmark />
      <PhoneNote />
      {open ? (
        <>
          <p className="lede">{otherName ? t.otherWaiting(otherName) : t.raceAFriend}</p>
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
              placeholder={t.yourName}
              maxLength={24}
              aria-label={t.yourName}
              aria-invalid={error ? true : undefined}
              aria-describedby={error ? "nh-name-error" : undefined}
              autoComplete="nickname"
            />
            <button className="cta" type="submit">
              {t.continue}
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
          <p className="lede">{canTakeOver.p1 || canTakeOver.p2 ? t.welcomeBack : t.seatsTaken}</p>
          <div className="row">
            {(["p1", "p2"] as Role[]).map((role) => (
              <button key={role} className="cta" type="button" disabled={!canTakeOver[role]} onClick={() => onPick(role, names[role]!)}>
                {canTakeOver[role] ? t.iAm(names[role]!) : t.isDriving(names[role]!)}
              </button>
            ))}
          </div>
        </>
      )}
      <p className="note nh-links">
        {t.or} <a href={soloHref}>{t.driveSoloLink}</a> ·{" "}
        <button type="button" className="nh-linkbtn" onClick={onLeave}>
          {t.leaveRoom}
        </button>
      </p>
    </Card>
  );
}

/** Seated, waiting for the second driver: the invite link (the shared InviteLinkBanner, passed in). */
export function WaitingForDriver({ invite, onLeave }: { invite: ReactNode; onLeave: () => void }) {
  const t = useText(SCREENS_TEXT);
  const soloHref = useSoloHref();
  return (
    <Card>
      <p className="kicker">{t.waitingKicker}</p>
      <Wordmark />
      <PhoneNote />
      <p className="lede">{t.waitingLede}</p>
      <div className="nh-invite">{invite}</div>
      <p className="note">
        {t.waitingBefore}
        <a href={soloHref}>{t.practiceSolo}</a>
        {t.waitingAfter}
      </p>
      <p className="note nh-links">
        <button type="button" className="nh-linkbtn" onClick={onLeave}>
          {t.leaveRoom}
        </button>
      </p>
    </Card>
  );
}

const stats = (t: Text): { label: string; get: (r: RunResult) => string }[] => [
  { label: t.score, get: (r) => t.num(r.score) },
  { label: t.distance, get: (r) => t.km(r.distance) },
  { label: t.topSpeed, get: (r) => `${r.top} km/h` },
  { label: t.average, get: (r) => `${r.avg} km/h` },
  { label: t.nearMisses, get: (r) => String(r.nearMiss) },
  { label: t.overtakes, get: (r) => String(r.overtakes) },
  { label: t.crashes, get: (r) => String(r.crashes) },
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
  const t = useText(SCREENS_TEXT);
  const myName = names[me] ?? t.you;
  const otherName = names[other] ?? t.theOtherDriver;
  const last = game.phase === "DONE" ? game.history.at(-1) : undefined;
  const iAmReady = Boolean(game.ready[me]);
  const theyAreReady = Boolean(game.ready[other]);
  const mine = game.results[me];
  const theirs = game.results[other];

  let headline = t.readyToRace;
  if (last) headline = last.winner === "tie" ? t.deadHeat : last.winner === me ? t.youWin : t.wins(otherName);

  return (
    <Card>
      <p className="kicker">
        {last ? t.raceResult(last.race) : t.startLine} · {myName} {game.wins[me]} – {game.wins[other]} {otherName}
      </p>
      <p className={`results-score nh-headline${last && last.winner === me ? " nh-win" : ""}`}>{headline}</p>
      {last && (mine || theirs) ? (
        <div className="nh-table-wrap">
          <table className="nh-table">
            <thead>
              <tr>
                <th scope="col">
                  <span className="sr-only">{t.stat}</span>
                </th>
                <th scope="col">{myName}</th>
                <th scope="col">{otherName}</th>
              </tr>
            </thead>
            <tbody>
              {stats(t).map(({ label, get }) => (
                <tr key={label}>
                  <th scope="row">{label}</th>
                  <td>{mine ? get(mine) : t.didntFinish}</td>
                  <td>{theirs ? get(theirs) : t.didntFinish}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="lede">{t.lobbyLede(otherName)}</p>
      )}
      <div className="row nh-options" role="group" aria-label={t.nextRace}>
        {(
          [
            ["pickups", t.pickups],
            ["rain", t.rain],
            ["desert", t.desert],
          ] as const
        ).map(([key, label]) => (
          <button key={key} type="button" role="switch" aria-checked={game.options[key]} className="nh-switch" onClick={() => onOptions({ [key]: !game.options[key] })}>
            {label}
          </button>
        ))}
      </div>
      <div className="row">
        <RulesButton variant="link" />
      </div>
      <div className="row">
        <button className="cta" type="button" onClick={() => onReady(!iAmReady)} aria-pressed={iAmReady}>
          {iAmReady ? t.notReady : last ? t.raceAgain : t.ready}
        </button>
        <span className="note" aria-live="polite">
          {!otherOnline
            ? t.offline(otherName)
            : iAmReady && theyAreReady
              ? t.starting
              : iAmReady
                ? t.waitingFor(otherName)
                : theyAreReady
                  ? t.isReady(otherName)
                  : t.startsWhenBoth}
        </span>
      </div>
      {footer}
    </Card>
  );
}

/** This device finished; the other driver hasn't yet (`otherName` missing: "the other driver"). */
export function WaitingForResult({ result, otherName }: { result: RunResult; otherName?: string }) {
  const t = useText(SCREENS_TEXT);
  return (
    <Card>
      <p className="kicker">{t.runComplete}</p>
      <p className="results-score">{t.num(result.score)}</p>
      <p className="best" aria-live="polite">
        {t.waitingToFinish(otherName)}
      </p>
    </Card>
  );
}

/** The couple of seconds between both pressing Ready and the countdown. */
export function GetReady() {
  return (
    <div className="layer nh-getready" aria-live="assertive">
      <p>{useText(SCREENS_TEXT).getReady}</p>
    </div>
  );
}

/** Room line under the lobby: the room's name or code, and the ways out. */
export function RoomLinks({ room, roomName, onNewRoom, onLeave }: { room: string; roomName?: string; onNewRoom: () => void; onLeave: () => void }) {
  const t = useText(SCREENS_TEXT);
  const soloHref = useSoloHref();
  return (
    <p className="note nh-links">
      {t.room(roomName || room)} ·{" "}
      <button type="button" className="nh-linkbtn" onClick={onNewRoom}>
        {t.newRoom}
      </button>{" "}
      · <a href={soloHref}>{t.driveSolo}</a> ·{" "}
      <button type="button" className="nh-linkbtn" onClick={onLeave}>
        {t.leaveRoom}
      </button>
    </p>
  );
}

/**
 * A matchmaking room (docs/matchmaking.md) before its first race: waiting for
 * a stranger to join (`otherName` unset), or the countdown to the race, which
 * starts by itself. `left`: the other driver gave up their seat after a race.
 */
export function MatchLobby({
  myName,
  otherName,
  status,
  left = false,
  onFindAnother,
  onLeave,
  onSolo,
}: {
  myName: string;
  otherName?: string;
  /** e.g. "Starting in 4 s". */
  status: string;
  left?: boolean;
  onFindAnother?: () => void;
  onLeave: () => void;
  /** "Drive solo": leaves the room first, so nobody waits on an empty seat. */
  onSolo: () => void;
}) {
  const t = useText(SCREENS_TEXT);
  return (
    <Card>
      <p className="kicker">{otherName ? t.matchKickerVs(myName, otherName) : t.matchKicker}</p>
      <Wordmark />
      <PhoneNote />
      <p className="lede">{left ? t.otherLeft : otherName ? t.lobbyLede(otherName) : t.lookingLede}</p>
      <div className="row">
        {onFindAnother ? (
          <button className="cta" type="button" onClick={onFindAnother}>
            {t.findAnother}
          </button>
        ) : null}
        <span className="note" role="status" aria-live="polite">
          {status}
        </span>
      </div>
      <p className="note nh-links">
        <button type="button" className="nh-linkbtn" onClick={onLeave}>
          {t.leaveRoom}
        </button>{" "}
        ·{" "}
        <button type="button" className="nh-linkbtn" onClick={onSolo}>
          {t.driveSolo}
        </button>{" "}
        · <RulesButton variant="link" />
      </p>
    </Card>
  );
}

/** The line under a matchmaking room's results: no room code or New room, just the way out. */
export function MatchLinks({ onLeave, onSolo }: { onLeave: () => void; onSolo: () => void }) {
  const t = useText(SCREENS_TEXT);
  return (
    <p className="note nh-links">
      {t.matchedOnline} ·{" "}
      <button type="button" className="nh-linkbtn" onClick={onLeave}>
        {t.leaveRoom}
      </button>{" "}
      ·{" "}
      <button type="button" className="nh-linkbtn" onClick={onSolo}>
        {t.driveSolo}
      </button>
    </p>
  );
}
