"use client";

import { useEffect, useId, useState } from "react";
import { CONNECTION_ERROR_MESSAGE, ensureGuestUid } from "@/lib/session/shared/auth";
import { findRoomByName, readRoomMeta } from "@/lib/session/shared/roomActions";
import { roomHref } from "@/lib/games/registry";

type Mode = "code" | "name";
type Status = "idle" | "checking" | "notFound" | "offline";

/** Visible focus on the white panel: a 3px teal outline (references/game-room/game-room-ui-spec.md, "Accessibility"). */
const FOCUS_RING = "focus-visible:outline-[3px] focus-visible:outline-offset-2 focus-visible:outline-[#0F7983]";

function JoinModeSwitch({ mode, onChange, disabled }: { mode: Mode; onChange: (mode: Mode) => void; disabled: boolean }) {
  const other: Mode = mode === "code" ? "name" : "code";
  return (
    <div
      role="radiogroup"
      aria-label="Join with"
      className="inline-flex shrink-0 items-center self-start justify-self-start rounded-[10px] bg-[#E9EEEF] p-[3px]"
      onKeyDown={(e) => {
        if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
          e.preventDefault();
          onChange(other);
          // Keep focus in the switch, on the newly selected segment.
          const next = e.currentTarget.querySelector<HTMLButtonElement>(`[data-mode="${other}"]`);
          next?.focus();
        }
      }}
    >
      {(["code", "name"] as const).map((m) => (
        <button
          key={m}
          type="button"
          role="radio"
          data-mode={m}
          aria-checked={mode === m}
          tabIndex={mode === m ? 0 : -1}
          disabled={disabled}
          onClick={() => onChange(m)}
          className={`h-9 cursor-pointer rounded-[8px] px-4 text-sm font-semibold capitalize disabled:cursor-not-allowed disabled:opacity-60 min-[760px]:h-[34px] ${FOCUS_RING}`}
          style={{ backgroundColor: mode === m ? "#0F7983" : "transparent", color: mode === m ? "#FFFFFF" : "#3A4547" }}
        >
          {m}
        </button>
      ))}
    </div>
  );
}

interface JoinPanelProps {
  /** e.g. "Same Page" - the panel is titled "Join a Same Page room". */
  gameTitle: string;
  /** id for the heading, so the surrounding dialog can be labelled by it. */
  headingId: string;
  /** In the mobile sheet the title lives in the sheet's header and the switch gets its own row. */
  inSheet: boolean;
}

/**
 * The join form inside a game card's Join popover (desktop) or sheet (mobile),
 * per references/game-room/game-room-ui-spec.md's "Join a room form". The
 * Code/Name switch only changes the placeholder, helper text and label - the
 * lookup always tries the typed value as a room code first, then as a room
 * name, so getting the switch "wrong" still works. A room of the other game
 * opens anyway: routing follows the room's own `meta.gameSlug`.
 */
export default function JoinPanel({ gameTitle, headingId, inSheet }: JoinPanelProps) {
  const [mode, setMode] = useState<Mode>("code");
  const [codeValue, setCodeValue] = useState("");
  const [nameValue, setNameValue] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [destination, setDestination] = useState<string | null>(null);
  const errorId = useId();

  const value = mode === "code" ? codeValue : nameValue;
  const setValue = mode === "code" ? setCodeValue : setNameValue;
  const busy = status === "checking";
  const hasError = status === "notFound" || status === "offline";

  // A hard navigation (window.location, not router.push), set from an effect
  // per this repo's react-hooks/immutability lint rule: the game page reads
  // window.location.hash on its very first render (Co-Counsel's creator
  // check), which only a real page load guarantees.
  useEffect(() => {
    if (destination) window.location.href = destination;
  }, [destination]);

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
        setDestination(roomHref(meta.gameSlug, asCode));
        return;
      }
      const match = await findRoomByName(typed);
      if (match) {
        setDestination(roomHref(match.meta.gameSlug, match.room));
        return;
      }
      setStatus("notFound");
    } catch {
      setStatus("offline"); // couldn't reach the database - not the same as "no such room"
    }
  };

  const navigating = destination != null;
  const disabled = busy || navigating;
  const inputBorder = status === "notFound" ? "border-[#B3261E]" : disabled ? "border-[#C9D1D2]" : "border-[#7C8A8C] focus:border-[#0F7983]";

  return (
    <form onSubmit={join} aria-busy={disabled} className="grid gap-2.5">
      {inSheet ? (
        <JoinModeSwitch mode={mode} onChange={changeMode} disabled={disabled} />
      ) : (
        <div className="flex items-center justify-between gap-3">
          <h2 id={headingId} className="m-0 font-[family-name:var(--font-fredoka)] text-[17px] font-bold">
            Join a {gameTitle} room
          </h2>
          <JoinModeSwitch mode={mode} onChange={changeMode} disabled={disabled} />
        </div>
      )}

      <p className="m-0 text-sm font-medium" style={{ color: "#444444" }}>
        Enter its {mode} to jump back in.
      </p>

      <input
        data-autofocus
        type="text"
        value={value}
        disabled={disabled}
        onChange={(e) => {
          setValue(e.target.value);
          setStatus("idle");
        }}
        placeholder={mode === "code" ? "Room code" : "Room name"}
        aria-label={mode === "code" ? "Room code" : "Room name"}
        aria-invalid={status === "notFound"}
        aria-describedby={hasError ? errorId : undefined}
        autoCapitalize="off"
        autoCorrect="off"
        spellCheck={false}
        className={`h-12 w-full rounded-xl border-2 bg-white px-3.5 font-[family-name:var(--font-fredoka)] text-base font-semibold text-black outline-none disabled:bg-[#F1F4F4] disabled:text-black/60 ${inputBorder}`}
      />

      {hasError ? (
        <p id={errorId} role="alert" className="m-0 flex items-center gap-1.5 text-sm font-semibold" style={{ color: "#B3261E" }}>
          <svg aria-hidden="true" width="18" height="16" viewBox="0 0 18 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round">
            <path d="M9 1.5 16.8 15H1.2L9 1.5Z" />
            <path d="M9 6v4.2M9 12.4v.3" strokeLinecap="round" />
          </svg>
          {status === "notFound" ? `We can't find that room. Check the ${mode} and try again.` : CONNECTION_ERROR_MESSAGE}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={disabled || !value.trim()}
        className={`h-12 w-full cursor-pointer rounded-xl border-0 font-[family-name:var(--font-fredoka)] text-[17px] font-bold text-white transition-transform duration-[60ms] enabled:active:translate-y-1 enabled:active:shadow-none disabled:cursor-not-allowed motion-reduce:transition-none ${FOCUS_RING}`}
        style={{
          backgroundColor: disabled || !value.trim() ? "#8FA9AC" : "#0F7983",
          boxShadow: disabled || !value.trim() ? "none" : "0 4px 0 #0A565D",
          cursor: disabled ? "progress" : undefined,
        }}
      >
        {disabled ? "Joining…" : "Join"}
      </button>
    </form>
  );
}
