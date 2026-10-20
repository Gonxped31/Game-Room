"use client";

import type { CSSProperties, ReactNode } from "react";
import type { SeatId } from "@/lib/session/types";
import type { Team } from "@/lib/games/wordscramble/teams";

/**
 * Word Scramble's building blocks, per references/scramble/word-scramble-visual-spec.md.
 * Colors are the spec's tokens, set as CSS variables on the page's root
 * (`THEME`), so components only ever say `var(--table)` and so on.
 */

export const THEME = {
  "--table": "#FFF3DF",
  "--board": "#FBE9C8",
  "--panel": "#F6E2B8",
  "--line": "#E9D3AE",
  "--slot": "#C9A26B",
  "--ink": "#2A1B12",
  "--muted": "#6E5847",
  "--tile": "#F2CF8D",
  "--tile-edge": "#B98535",
  "--team-a": "#FF7A1A",
  "--team-a-edge": "#A8480A",
  "--team-a-soft": "#FFE2C9",
  "--team-b": "#3446D8",
  "--team-b-edge": "#1F2C99",
  "--team-b-soft": "#DCE1FF",
  "--team-b-wash": "#EEF0FF",
  "--right": "#2FA866",
  "--right-edge": "#1C7346",
  "--right-tint": "#DDF3E6",
  "--right-ink": "#145A36",
  "--wrong": "#B3261E",
  "--warn": "#FFE7B3",
  "--warn-edge": "#B27300",
  "--warn-ink": "#5C3A00",
  "--disabled": "#E8D6B8",
  "--disabled-ink": "#7A6450",
} as CSSProperties;

export const DISPLAY = "font-[family-name:var(--font-lilita)] font-normal";
export const TEXT = "font-[family-name:var(--font-nunito)]";
export const LABEL = `${TEXT} m-0 text-[13px] font-extrabold uppercase tracking-[0.08em] text-[var(--muted)] min-[900px]:text-[14px]`;
export const FOCUS = "focus-visible:outline-[3px] focus-visible:outline-offset-2 focus-visible:outline-[var(--ink)]";

export const teamColor = (team: Team) => (team === "A" ? "var(--team-a)" : "var(--team-b)");
export const teamEdge = (team: Team) => (team === "A" ? "var(--team-a-edge)" : "var(--team-b-edge)");
export const teamSoft = (team: Team) => (team === "A" ? "var(--team-a-soft)" : "var(--team-b-soft)");
/** Ink on orange, white on indigo. */
export const teamText = (team: Team) => (team === "A" ? "var(--ink)" : "#FFFFFF");

// ---- Icons (inline stroke SVG, decorative) ---------------------------------------------

function Icon({ size = 20, children }: { size?: number; children: ReactNode }) {
  return (
    <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
      {children}
    </svg>
  );
}
export const BulbIcon = (p: { size?: number }) => <Icon {...p}><path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2.1h5c0-.9.4-1.6 1-2.1A6 6 0 0 0 12 3z" /></Icon>;
export const EyeIcon = (p: { size?: number }) => <Icon {...p}><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" /><circle cx="12" cy="12" r="3" /></Icon>;
export const LockIcon = (p: { size?: number }) => <Icon {...p}><rect x="5" y="11" width="14" height="10" rx="2" /><path d="M8 11V8a4 4 0 0 1 8 0v3" /></Icon>;
export const SendIcon = (p: { size?: number }) => <Icon {...p}><path d="M5 12h14M13 6l6 6-6 6" /></Icon>;
export const CheckIcon = (p: { size?: number }) => <Icon {...p}><path d="m5 12.5 4.5 4.5L19 7.5" /></Icon>;
export const CrownIcon = (p: { size?: number }) => <Icon {...p}><path d="M3 18h18M4 8l4 4 4-7 4 7 4-4-2 10H6z" /></Icon>;
export const BackIcon = (p: { size?: number }) => <Icon {...p}><path d="M15 5l-7 7 7 7" /></Icon>;

// ---- Avatar -----------------------------------------------------------------------------

export function Avatar({ team, name, size = 32 }: { team?: Team; name: string; size?: number }) {
  return (
    <span
      aria-hidden="true"
      className={`${DISPLAY} flex shrink-0 items-center justify-center rounded-full border-2 border-[var(--ink)] leading-none text-[var(--ink)]`}
      style={{ width: size, height: size, fontSize: size * 0.48, background: team ? teamSoft(team) : "var(--panel)" }}
    >
      {(name.trim().charAt(0) || "?").toUpperCase()}
    </span>
  );
}

// ---- Buttons ----------------------------------------------------------------------------

/** Hard-shadowed, ink-bordered: the game's buttons. `team` picks the fill (default orange). */
export function ChunkyButton({ children, team = "A", className = "", white = false, ...rest }: React.ButtonHTMLAttributes<HTMLButtonElement> & { team?: Team; white?: boolean }) {
  return (
    <button
      type="button"
      className={`${TEXT} ${FOCUS} flex min-h-[52px] cursor-pointer items-center justify-center gap-2 rounded-2xl border-[3px] border-[var(--ink)] px-5 text-[18px] font-extrabold shadow-[0_5px_0_var(--ink)] transition-transform duration-75 enabled:active:translate-y-1 enabled:active:shadow-none disabled:cursor-not-allowed disabled:border-[var(--disabled)] disabled:bg-[var(--disabled)] disabled:text-[var(--disabled-ink)] disabled:shadow-none motion-reduce:transition-none ${className}`}
      // Inline colors would beat the disabled: classes, so a disabled button gets its own.
      style={rest.disabled ? undefined : white ? { background: "#FFFFFF", color: "var(--ink)" } : { background: teamColor(team), color: teamText(team) }}
      {...rest}
    >
      {children}
    </button>
  );
}

export function Segmented<T extends string | number>({ label, options, value, onChange }: {
  label: string;
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className="flex gap-1 rounded-2xl border-2 border-[var(--line)] bg-white p-1"
      onKeyDown={(e) => {
        const step = e.key === "ArrowRight" || e.key === "ArrowDown" ? 1 : e.key === "ArrowLeft" || e.key === "ArrowUp" ? -1 : 0;
        if (!step) return;
        e.preventDefault();
        const next = options[(options.findIndex((o) => o.value === value) + step + options.length) % options.length];
        onChange(next.value);
        e.currentTarget.querySelectorAll<HTMLButtonElement>("[role=radio]")[options.indexOf(next)]?.focus();
      }}
    >
      {options.map((option) => {
        const checked = option.value === value;
        return (
          <button
            key={String(option.value)}
            type="button"
            role="radio"
            aria-checked={checked}
            tabIndex={checked ? 0 : -1}
            onClick={() => onChange(option.value)}
            className={`${TEXT} ${FOCUS} h-11 flex-1 cursor-pointer rounded-xl text-[16px] font-extrabold ${checked ? "bg-[var(--ink)] text-white" : "bg-transparent text-[var(--muted)]"}`}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

export function Stepper({ label, value, min, max, onChange }: { label: string; value: number; min: number; max: number; onChange: (value: number) => void }) {
  const btn = `${DISPLAY} ${FOCUS} flex h-11 w-11 cursor-pointer items-center justify-center rounded-xl border-2 border-[var(--ink)] bg-white text-[24px] leading-none text-[var(--ink)] disabled:cursor-not-allowed disabled:opacity-40`;
  return (
    <div className="flex items-center justify-between gap-3">
      <span className={`${TEXT} text-[16px] font-bold text-[var(--ink)]`}>{label}</span>
      <div className="flex items-center gap-3">
        <button type="button" aria-label="Fewer turns" disabled={value <= min} onClick={() => onChange(value - 1)} className={btn}>
          −
        </button>
        <span aria-live="polite" className={`${DISPLAY} w-6 text-center text-[24px] text-[var(--ink)]`}>
          {value}
        </span>
        <button type="button" aria-label="More turns" disabled={value >= max} onClick={() => onChange(value + 1)} className={btn}>
          +
        </button>
      </div>
    </div>
  );
}

// ---- Tiles ------------------------------------------------------------------------------

export type TileLook = "wood" | "used" | "team" | "right" | "revealed";

/** One letter tile. `size` is the face (56 phone, 76 desktop). */
export function Tile({ letter, look, team = "A", tilt = 0, size, lift = 0, hintMark = false }: {
  letter: string;
  look: TileLook;
  team?: Team;
  tilt?: number;
  size: number;
  lift?: number;
  hintMark?: boolean;
}) {
  const edge = size >= 70 ? 8 : 6;
  const styles: Record<TileLook, CSSProperties> = {
    wood: { background: "var(--tile)", boxShadow: `0 ${edge}px 0 var(--tile-edge)` },
    used: { background: "var(--tile)", boxShadow: `0 ${edge}px 0 var(--tile-edge)`, opacity: 0.35 },
    team: { background: teamColor(team), boxShadow: `0 ${edge}px 0 ${teamEdge(team)}`, color: teamText(team) },
    right: { background: "var(--right)", boxShadow: `0 ${edge}px 0 var(--right-edge)`, color: "#FFFFFF" },
    revealed: { background: "#FFFFFF", border: "3px solid var(--ink)" },
  };
  return (
    <span
      aria-hidden="true"
      className={`${DISPLAY} relative flex shrink-0 items-center justify-center rounded-[12px] text-[var(--ink)] transition-transform duration-200 motion-reduce:transition-none`}
      style={{ width: size, height: size, fontSize: size * 0.6, transform: `translateY(${lift}px) rotate(${tilt}deg)`, ...styles[look] }}
    >
      {letter}
      {hintMark ? (
        <span className="absolute right-0.5 top-0.5 opacity-80">
          <BulbIcon size={size * 0.24} />
        </span>
      ) : null}
    </span>
  );
}

/** An empty answer slot. */
export function Slot({ size }: { size: number }) {
  return <span aria-hidden="true" className="shrink-0 rounded-[12px] border-[3px] border-dashed border-[var(--slot)]" style={{ width: size, height: size }} />;
}

// ---- Timer ------------------------------------------------------------------------------

export function TimerRing({ seconds, fraction, team, size = 46, label }: { seconds: number; fraction: number; team: Team; size?: number; label: string }) {
  const stroke = size > 50 ? 6 : 5;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  return (
    <div role="timer" aria-label={label} className="relative shrink-0 rounded-full bg-white" style={{ width: size, height: size }}>
      <svg aria-hidden="true" width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} stroke="var(--line)" strokeWidth={stroke} fill="none" />
        <circle cx={size / 2} cy={size / 2} r={r} stroke={teamColor(team)} strokeWidth={stroke} fill="none" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - Math.max(0, Math.min(1, fraction)))} />
      </svg>
      <span aria-hidden="true" className={`${DISPLAY} absolute inset-0 flex items-center justify-center`} style={{ fontSize: size * 0.4, color: seconds === 0 ? "var(--wrong)" : "var(--ink)" }}>
        {seconds}
      </span>
    </div>
  );
}

// ---- Scores and progress -----------------------------------------------------------------

export function ScorePill({ team, score, glow }: { team: Team; score: number; glow?: boolean }) {
  return (
    <span
      className={`${DISPLAY} flex h-[34px] items-center gap-2 rounded-full border-2 border-[var(--ink)] px-3 text-[18px] min-[900px]:h-[38px] min-[900px]:text-[20px]`}
      style={{ background: teamColor(team), color: teamText(team), boxShadow: glow ? `0 0 0 4px color-mix(in srgb, ${teamColor(team)} 30%, transparent)` : undefined }}
      aria-label={`Team ${team}: ${score} points`}
    >
      {team === "A" ? (
        <>
          <span>A</span>
          <span>{score}</span>
        </>
      ) : (
        <>
          <span>{score}</span>
          <span>B</span>
        </>
      )}
    </span>
  );
}

/** One bar per turn, in the color of the team that played it. */
export function TurnProgress({ total, played }: { total: number; played: number }) {
  return (
    <div aria-hidden="true" className="flex flex-wrap gap-1.5">
      {Array.from({ length: total }, (_, i) => (
        <span key={i} className="h-2 w-[22px] rounded-full min-[900px]:h-2.5 min-[900px]:w-[34px]" style={{ background: i < played ? teamColor(i % 2 === 0 ? "A" : "B") : "var(--line)" }} />
      ))}
    </div>
  );
}

export function TeamCard({ team, score, names, children, loser = false }: { team: Team; score?: number; names: string[]; children?: ReactNode; loser?: boolean }) {
  const fill = loser ? "#FFFFFF" : teamColor(team);
  const color = loser ? "var(--team-b)" : teamText(team);
  return (
    <section className="flex flex-col gap-2 rounded-[22px] border-[3px] border-[var(--ink)] p-4 shadow-[0_6px_0_var(--ink)] min-[900px]:shadow-[0_8px_0_var(--ink)]" style={{ background: fill, color }}>
      <div className="flex items-baseline justify-between gap-2">
        <h2 className={`${DISPLAY} m-0 text-[24px]`}>Team {team}</h2>
        {score != null ? <span className={`${DISPLAY} text-[64px] leading-none min-[900px]:text-[96px]`}>{score}</span> : null}
      </div>
      <p className={`${TEXT} m-0 text-[15px] font-bold opacity-90`}>{names.join(" · ") || "—"}</p>
      {children}
    </section>
  );
}

export const seatName = (names: Partial<Record<SeatId, string>>, seat: SeatId) => names[seat] ?? "Player";
