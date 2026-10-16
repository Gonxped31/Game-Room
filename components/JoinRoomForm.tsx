"use client";

import { useEffect, useId, useState } from "react";
import { CONNECTION_ERROR_MESSAGE, ensureGuestUid } from "@/lib/session/shared/auth";
import { findRoomByName, readRoomMeta } from "@/lib/session/shared/roomActions";

type Mode = "code" | "name";
type Status = "idle" | "checking" | "notFound" | "offline";

function JoinModeSwitch({ mode, onChange, disabled }: { mode: Mode; onChange: (mode: Mode) => void; disabled: boolean }) {
  const other: Mode = mode === "code" ? "name" : "code";
  return (
    <div
      role="radiogroup"
      aria-label="Join with"
      className="inline-flex shrink-0 items-center rounded-[10px] bg-[#E9EEEF] p-[3px]"
      onKeyDown={(e) => {
        if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
          e.preventDefault();
          onChange(other);
        }
      }}
    >
      {(["code", "name"] as const).map((m) => (
        <button
          key={m}
          type="button"
          role="radio"
          aria-checked={mode === m}
          tabIndex={mode === m ? 0 : -1}
          disabled={disabled}
          onClick={() => onChange(m)}
          className="h-9 cursor-pointer rounded-[8px] px-4 text-sm font-semibold capitalize disabled:cursor-not-allowed min-[760px]:h-[34px]"
          style={{ backgroundColor: mode === m ? "#0F7983" : "transparent", color: mode === m ? "#FFFFFF" : "#3A4547" }}
        >
          {m}
        </button>
      ))}
    </div>
  );
}

/**
 * "Already have a room?" - enter its code or its name to jump straight back
 * in, per references/game-room/game-room-ui-spec.md's "Join a room form".
 * The code/name switch only changes the placeholder/helper text/aria-label -
 * the lookup itself always tries the typed value as a room code first, then
 * as a room name (per the spec's "Behavior" section), so getting the switch
 * "wrong" still works. Room names are unique (first come, first served), so
 * a name leads to at most one room.
 */
export default function JoinRoomForm() {
  const [mode, setMode] = useState<Mode>("code");
  const [codeValue, setCodeValue] = useState("");
  const [nameValue, setNameValue] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [destination, setDestination] = useState<string | null>(null);
  const errorId = useId();

  const value = mode === "code" ? codeValue : nameValue;
  const setValue = mode === "code" ? setCodeValue : setNameValue;
  const busy = status === "checking";

  // A hard navigation (window.location, not next/navigation's router.push) -
  // deliberately NOT a client-side transition, triggered from an effect
  // reacting to `destination` rather than mutating window.location directly
  // in the click/submit handler. Two reasons for the hard navigation itself:
  // (1) the destination game page's own "am I this room's creator"
  // detection (app/cocounsel/page.tsx's isCreator) reads
  // window.location.hash synchronously on its very first render, which a
  // client-side push from a different route doesn't reliably guarantee is
  // already settled by then - confirmed live, joining this way could show
  // Co-Counsel's case-selection screen to a joiner. (2) belt-and-suspenders
  // against the "Joining…" button getting stuck forever if this exact
  // component instance were ever reused (not remounted) across a visit to
  // the room and back - a genuine page load leaves nothing to reuse.
  useEffect(() => {
    if (destination) window.location.href = destination;
  }, [destination]);

  const goTo = (room: string, gameSlug: string) => {
    setDestination(`/${gameSlug}#${room}`);
    setStatus("idle");
  };

  const changeMode = (next: Mode) => {
    setMode(next);
    setStatus("idle");
  };

  const join = async (e: React.FormEvent) => {
    e.preventDefault();
    const typed = value.trim();
    if (!typed) return;

    setStatus("checking");
    // Rooms are only readable by a signed-in guest.
    try {
      await ensureGuestUid();
    } catch {
      setStatus("offline");
      return;
    }

    // Accept a pasted invite link, not just a bare code.
    const asCode = (typed.includes("#") ? typed.slice(typed.lastIndexOf("#") + 1) : typed).toLowerCase();
    try {
      const meta = await readRoomMeta(asCode);
      if (meta) {
        goTo(asCode, meta.gameSlug);
        return;
      }
      const match = await findRoomByName(typed);
      if (match) {
        goTo(match.room, match.meta.gameSlug);
        return;
      }
      setStatus("notFound");
    } catch {
      setStatus("offline"); // couldn't reach the database - not the same as "no such room"
    }
  };

  return (
    <form
      onSubmit={join}
      aria-busy={busy}
      className="mt-6 grid gap-2.5 rounded-[18px] bg-white p-4 text-black shadow-[0_4px_0_rgba(0,0,0,.22)] min-[760px]:mx-auto min-[760px]:mt-6 min-[760px]:mb-5 min-[760px]:w-[520px] min-[760px]:p-[18px]"
    >
      <div className="flex items-center justify-between gap-3">
        <h2 className="m-0 font-[family-name:var(--font-fredoka)] text-[17px] font-bold">Already have a room?</h2>
        <JoinModeSwitch mode={mode} onChange={changeMode} disabled={busy} />
      </div>

      <p className="m-0 text-sm font-medium" style={{ color: "#444444" }}>
        Enter its {mode} to jump back in.
      </p>

      <input
        type="text"
        value={value}
        disabled={busy}
        onChange={(e) => {
          setValue(e.target.value);
          setStatus("idle");
        }}
        placeholder={mode === "code" ? "Room code" : "Room name"}
        aria-label={mode === "code" ? "Room code" : "Room name"}
        aria-invalid={status === "notFound"}
        aria-describedby={status === "notFound" || status === "offline" ? errorId : undefined}
        autoCapitalize="off"
        autoCorrect="off"
        spellCheck={false}
        className="h-12 w-full rounded-xl border-2 px-3.5 font-[family-name:var(--font-fredoka)] text-base font-semibold text-black outline-none disabled:bg-[#F1F4F4]"
        style={{ borderColor: status === "notFound" ? "#B3261E" : busy ? "#C9D1D2" : "#7C8A8C" }}
      />

      {status === "notFound" ? (
        <p id={errorId} role="alert" className="m-0 flex items-center gap-1.5 text-sm font-semibold" style={{ color: "#B3261E" }}>
          <span aria-hidden="true">⚠</span>
          We can&apos;t find that room. Check the {mode} and try again.
        </p>
      ) : status === "offline" ? (
        <p id={errorId} role="alert" className="m-0 flex items-center gap-1.5 text-sm font-semibold" style={{ color: "#B3261E" }}>
          <span aria-hidden="true">⚠</span>
          {CONNECTION_ERROR_MESSAGE}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={busy || !value.trim()}
        className="h-12 w-full cursor-pointer rounded-xl font-[family-name:var(--font-fredoka)] text-[17px] font-bold text-white disabled:cursor-not-allowed"
        style={{
          backgroundColor: busy ? "#8FA9AC" : !value.trim() ? "#8FA9AC" : "#0F7983",
          boxShadow: !value.trim() || busy ? "none" : "0 4px 0 #0A565D",
          cursor: busy ? "progress" : undefined,
        }}
      >
        {busy ? "Joining…" : "Join"}
      </button>
    </form>
  );
}
