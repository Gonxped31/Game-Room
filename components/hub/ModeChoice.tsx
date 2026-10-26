"use client";

import { useRef, type KeyboardEvent } from "react";
import type { GameEntry } from "@/lib/games/registry";

/** Visible focus on the white panel: a 3px teal outline (references/game-room/game-room-ui-spec.md, "Accessibility"). */
const FOCUS_RING = "focus-visible:outline-[3px] focus-visible:outline-offset-2 focus-visible:outline-[#0F7983]";

export type GameMode = NonNullable<GameEntry["modes"]>[number];

/**
 * A game's modes as radio cards (registry `modes`): its name and one line
 * on it. Nothing is picked until the player picks: Start and Matchmaking
 * both wait for a choice. Arrow keys move the choice, as in the other
 * switches.
 */
export default function ModeChoice({ modes, value, onChange, disabled }: { modes: GameMode[]; value: string | null; onChange: (key: string) => void; disabled?: boolean }) {
  const buttons = useRef<(HTMLButtonElement | null)[]>([]);
  const onKeyDown = (event: KeyboardEvent, index: number) => {
    const step = event.key === "ArrowDown" || event.key === "ArrowRight" ? 1 : event.key === "ArrowUp" || event.key === "ArrowLeft" ? -1 : 0;
    if (!step) return;
    event.preventDefault();
    const next = (index + step + modes.length) % modes.length;
    onChange(modes[next].key);
    buttons.current[next]?.focus();
  };
  return (
    <div role="radiogroup" aria-label="Mode" className="grid gap-2">
      {modes.map((mode, index) => {
        const picked = mode.key === value;
        return (
          <button
            key={mode.key}
            ref={(el) => {
              buttons.current[index] = el;
            }}
            type="button"
            role="radio"
            aria-checked={picked}
            // With nothing picked yet, the first card takes the tab stop.
            tabIndex={picked || (value === null && index === 0) ? 0 : -1}
            disabled={disabled}
            onClick={() => onChange(mode.key)}
            onKeyDown={(event) => onKeyDown(event, index)}
            className={`grid cursor-pointer gap-0.5 rounded-xl border-2 px-3.5 py-2.5 text-left disabled:cursor-not-allowed disabled:opacity-60 ${FOCUS_RING}`}
            style={{ borderColor: picked ? "#0F7983" : "#C9D1D2", backgroundColor: picked ? "#E3F2F3" : "#FFFFFF" }}
          >
            <span className="flex items-center gap-2 text-base font-bold text-black">
              <span aria-hidden="true" className="grid h-4 w-4 shrink-0 place-items-center rounded-full border-2" style={{ borderColor: picked ? "#0F7983" : "#7C8A8C" }}>
                {picked ? <span className="h-2 w-2 rounded-full bg-[#0F7983]" /> : null}
              </span>
              {mode.label}
            </span>
            <span className="text-sm font-medium leading-snug" style={{ color: "#444444" }}>
              {mode.detail}
            </span>
          </button>
        );
      })}
    </div>
  );
}
