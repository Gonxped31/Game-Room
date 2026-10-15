"use client";

import { useId, useState } from "react";
import { useRouter } from "next/navigation";
import { GAMES } from "@/lib/games/registry";
import { findRoomsByName, readRoomMeta, type RoomMeta } from "@/lib/session/roomMeta";

type Mode = "code" | "name";
type Status = "idle" | "checking" | "notFound";

function gameTitle(slug: string): string {
  return GAMES.find((g) => g.slug === slug)?.title ?? slug;
}

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
 * "wrong" still works. A room whose name matches more than one real room
 * (not covered by the spec, which assumes a single match) renders an inline
 * disambiguation list instead of guessing which one to open.
 */
export default function JoinRoomForm() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("code");
  const [codeValue, setCodeValue] = useState("");
  const [nameValue, setNameValue] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [candidates, setCandidates] = useState<{ room: string; meta: RoomMeta }[] | null>(null);
  const errorId = useId();

  const value = mode === "code" ? codeValue : nameValue;
  const setValue = mode === "code" ? setCodeValue : setNameValue;
  const busy = status === "checking";

  const goTo = (room: string, gameSlug: string) => router.push(`/${gameSlug}#${room}`);

  const changeMode = (next: Mode) => {
    setMode(next);
    setStatus("idle");
    setCandidates(null);
  };

  const join = async (e: React.FormEvent) => {
    e.preventDefault();
    setCandidates(null);
    const typed = value.trim();
    if (!typed) return;

    setStatus("checking");

    // Accept a pasted invite link, not just a bare code.
    const asCode = (typed.includes("#") ? typed.slice(typed.lastIndexOf("#") + 1) : typed).toLowerCase();
    const meta = await readRoomMeta(asCode);
    if (meta) {
      goTo(asCode, meta.gameSlug);
      return;
    }

    const matches = await findRoomsByName(typed);
    if (matches.length === 1) {
      goTo(matches[0].room, matches[0].meta.gameSlug);
      return;
    }
    if (matches.length > 1) {
      setStatus("idle");
      setCandidates(matches);
      return;
    }
    setStatus("notFound");
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
          setCandidates(null);
        }}
        placeholder={mode === "code" ? "Room code" : "Room name"}
        aria-label={mode === "code" ? "Room code" : "Room name"}
        aria-invalid={status === "notFound"}
        aria-describedby={status === "notFound" ? errorId : undefined}
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
      ) : null}

      {candidates ? (
        <div className="grid gap-1.5">
          <p className="m-0 text-sm font-semibold">Multiple rooms named &quot;{nameValue.trim()}&quot; - which one?</p>
          {candidates.map(({ room, meta }) => (
            <button
              key={room}
              type="button"
              onClick={() => goTo(room, meta.gameSlug)}
              className="cursor-pointer rounded-lg border border-black/15 px-2.5 py-2 text-left text-sm"
            >
              <span className="font-bold">{gameTitle(meta.gameSlug)}</span> <span className="opacity-60">· {room}</span>
            </button>
          ))}
        </div>
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
