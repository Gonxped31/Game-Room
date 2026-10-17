"use client";

import { type ReactNode, useState } from "react";
import type { Role } from "@/lib/session/types";
import { formatSurvived, rankFor } from "@/lib/games/iai/rules";
import type { GameState } from "@/lib/games/iai/coop";

/**
 * Iaï's co-op screens, drawn over the field in the original title card's
 * ink-on-paper style (classes in ./iai.css). The engine runs the fight; these
 * are the room's lobby around it.
 */

const fmt = (n: number) => n.toLocaleString("en-US");

function Screen({ eyebrow, children }: { eyebrow: string; children: ReactNode }) {
  return (
    <section className="iai-screen">
      <div className="iai-card">
        <div className="eyebrow">{eyebrow}</div>
        <h1 className="logo">IAÏ</h1>
        {children}
      </div>
    </section>
  );
}

export function Message({ text }: { text: string }) {
  return (
    <Screen eyebrow="Side by side">
      <p role="alert" className="tag">
        {text}
      </p>
    </Screen>
  );
}

/** Take a seat by typing a name - or, with both seats held, take over one whose samurai has been gone a while. */
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
  const other = names.p1 ?? names.p2;
  const submit = () => {
    const name = draft.trim();
    if (!name) return setError("Enter your name to stand together.");
    setError("");
    if (open) onPick(open, name);
  };
  return (
    <Screen eyebrow="Two blades · One field">
      {open ? (
        <>
          <p className="tag">{other ? `${other} waits on the field. What's your name?` : "Fight side by side against endless foes. What's your name?"}</p>
          <form
            className="iai-row"
            onSubmit={(e) => {
              e.preventDefault();
              submit();
            }}
          >
            <input
              className="iai-field"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="Your name"
              maxLength={24}
              aria-label="Your name"
              aria-invalid={error ? true : undefined}
              aria-describedby={error ? "iai-name-error" : undefined}
              autoComplete="nickname"
            />
            <button type="submit" className="seal-btn small">
              参<span>Join</span>
            </button>
          </form>
          {error ? (
            <p id="iai-name-error" role="alert" className="iai-note iai-error">
              {error}
            </p>
          ) : null}
        </>
      ) : (
        <>
          <p className="tag">{canTakeOver.p1 || canTakeOver.p2 ? "Welcome back! Which samurai are you on this device?" : "Both places are taken. One frees up 2 minutes after its samurai goes offline."}</p>
          <div className="iai-row">
            {(["p1", "p2"] as Role[]).map((role) => (
              <button key={role} type="button" className="ghost" disabled={!canTakeOver[role]} onClick={() => onPick(role, names[role]!)}>
                {canTakeOver[role] ? `I'm ${names[role]}` : `${names[role]} is fighting`}
              </button>
            ))}
          </div>
        </>
      )}
      <p className="iai-note">
        Or <a href="/iai/solo">fight alone</a>.
      </p>
    </Screen>
  );
}

/** Seated, waiting for the partner: the invite link (the shared InviteLinkBanner, passed in). */
export function WaitingForPartner({ invite }: { invite: ReactNode }) {
  return (
    <Screen eyebrow="Waiting for your partner">
      <p className="tag">Send them the link. You fight on the same field, back to back, until you both fall.</p>
      <div className="iai-invite">{invite}</div>
      <p className="iai-note">
        Waiting a while? <a href="/iai/solo">Train alone</a> meanwhile.
      </p>
    </Screen>
  );
}

/** Between runs: the last run's result, the room's best, and Ready. */
export function Lobby({
  game,
  me,
  other,
  names,
  otherOnline,
  onReady,
  footer,
}: {
  game: GameState;
  me: Role;
  other: Role;
  names: Partial<Record<Role, string>>;
  otherOnline: boolean;
  onReady: (ready: boolean) => void;
  footer: ReactNode;
}) {
  const otherName = names[other] ?? "Your partner";
  const r = game.phase === "DONE" ? game.result : undefined;
  const iAmReady = Boolean(game.ready[me]);
  const theyAreReady = Boolean(game.ready[other]);
  return (
    <Screen eyebrow={r ? `${rankFor(r.score)[1]} · ${rankFor(r.score)[2]}` : "Two blades · One field"}>
      {r ? (
        <>
          <p className="tag">
            Together you scored <b>{fmt(r.score)}</b> and held out {formatSurvived(r.survived)}.
          </p>
          <div className="iai-results">
            <div>
              <b>{r.kills}</b>
              <span>foes cut down</span>
            </div>
            <div>
              <b>{r.perfect}%</b>
              <span>perfect cuts</span>
            </div>
            <div>
              <b>{r.oni}</b>
              <span>oni slain</span>
            </div>
          </div>
        </>
      ) : (
        <p className="tag">Back to back with {otherName}. Cut at the perfect moment, guard each other&apos;s side, and outlast the oni.</p>
      )}
      <p className="iai-note">Room best: {game.best ? fmt(game.best) : "—"}</p>
      <div className="iai-row">
        <button type="button" className="seal-btn small" aria-pressed={iAmReady} onClick={() => onReady(!iAmReady)}>
          {iAmReady ? (
            <>
              待<span>Not ready</span>
            </>
          ) : (
            <>
              抜刀<span>{r ? "Again" : "Ready"}</span>
            </>
          )}
        </button>
        <span className="iai-note" aria-live="polite">
          {!otherOnline
            ? `${otherName} is offline.`
            : iAmReady && theyAreReady
              ? "Drawing…"
              : iAmReady
                ? `Waiting for ${otherName}…`
                : theyAreReady
                  ? `${otherName} is ready.`
                  : "The fight starts when you're both ready."}
        </span>
      </div>
      {footer}
    </Screen>
  );
}

export function GetReady() {
  return (
    <div className="iai-getready" aria-live="assertive">
      構え · Ready
    </div>
  );
}

/** The host's screen runs the fight; without it the run can't go on. */
export function HostLeft({ hostName, onBack }: { hostName: string; onBack: () => void }) {
  return (
    <Screen eyebrow="The wind falls still">
      <p className="tag">{hostName} left the field, and their screen was running the fight.</p>
      <div className="iai-row">
        <button type="button" className="seal-btn small" onClick={onBack}>
          戻<span>Back to the lobby</span>
        </button>
      </div>
    </Screen>
  );
}

export function RoomLinks({ room, roomName, onNewRoom }: { room: string; roomName?: string; onNewRoom: () => void }) {
  return (
    <p className="iai-note">
      Room {roomName || room} ·{" "}
      <button type="button" className="iai-link" onClick={onNewRoom}>
        New room
      </button>{" "}
      · <a href="/iai/solo">Fight alone</a>
    </p>
  );
}
