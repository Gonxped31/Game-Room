"use client";

import { useState } from "react";
import ModeChoice, { type GameMode } from "./ModeChoice";

/** Visible focus on the white panel: a 3px teal outline (references/game-room/game-room-ui-spec.md, "Accessibility"). */
const FOCUS_RING = "focus-visible:outline-[3px] focus-visible:outline-offset-2 focus-visible:outline-[#0F7983]";

interface StartPanelProps {
  modes: GameMode[];
  /** e.g. "Border Run" - the panel is titled "Start a Border Run room". */
  gameTitle: string;
  /** id for the heading, so the surrounding dialog can be labelled by it. */
  headingId: string;
  /** In the mobile sheet the title lives in the sheet's header. */
  inSheet: boolean;
  /** Opens the new room's page in that mode. */
  onStart: (mode: string) => void;
}

/**
 * Start, for a game with modes (registry `modes`): the player picks one,
 * then the room is created in it. The host can still change it in the room's
 * lobby. Styled like the Join and Matchmaking panels.
 */
export default function StartPanel({ modes, gameTitle, headingId, inSheet, onStart }: StartPanelProps) {
  const [mode, setMode] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  const canStart = mode !== null && !starting;
  return (
    <form
      className="grid gap-2.5"
      aria-busy={starting}
      onSubmit={(e) => {
        e.preventDefault();
        if (!mode) return;
        setStarting(true);
        onStart(mode);
      }}
    >
      {inSheet ? null : (
        <h2 id={headingId} className="m-0 font-[family-name:var(--font-fredoka)] text-[17px] font-bold">
          Start a {gameTitle} room
        </h2>
      )}
      <p className="m-0 text-sm font-medium" style={{ color: "#444444" }}>
        Pick a mode. You can still change it in the room, before you start.
      </p>
      <ModeChoice modes={modes} value={mode} onChange={setMode} disabled={starting} />
      <button
        type="submit"
        disabled={!canStart}
        className={`h-12 w-full cursor-pointer rounded-xl border-0 font-[family-name:var(--font-fredoka)] text-[17px] font-bold text-white transition-transform duration-[60ms] enabled:active:translate-y-1 enabled:active:shadow-none disabled:cursor-not-allowed motion-reduce:transition-none ${FOCUS_RING}`}
        style={{
          backgroundColor: canStart || starting ? "#0F7983" : "#8FA9AC",
          boxShadow: canStart ? "0 4px 0 #0A565D" : "none",
          cursor: starting ? "progress" : undefined,
        }}
      >
        <span aria-live="polite">{starting ? "Starting…" : "Start room"}</span>
      </button>
    </form>
  );
}
