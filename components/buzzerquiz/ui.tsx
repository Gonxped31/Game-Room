"use client";

import type { CSSProperties, ReactNode } from "react";
import type { SeatId } from "@/lib/session/types";

/**
 * Buzzer Quiz's building blocks, per references/buzzer-quiz/buzzer-quiz-visual-spec.md.
 * Colors are the spec's tokens, set as CSS variables on the page's root
 * (`THEME`), so components only ever say `var(--stage)` and so on.
 */

export const THEME = {
  "--stage": "#16113A",
  "--surface": "#251E5C",
  "--surface-2": "#31297A",
  "--surface-dim": "#1E1849",
  "--line-dashed": "#4A4380",
  "--text": "#FFF8EC",
  "--text-muted": "#B8B0E6",
  "--text-struck": "#8A83B8",
  "--ink": "#16113A",
  "--buzz": "#FF4B3E",
  "--buzz-ring": "#9E1B14",
  "--buzz-base": "#5C0F0B",
  "--disabled": "#3A3470",
  "--disabled-ring": "#2A245E",
  "--right": "#22C873",
  "--right-ink": "#0B2A1A",
  "--right-tint": "#1A3D3A",
  "--points": "#FFC23D",
  "--p1": "#FFC23D",
  "--p2": "#46E0A0",
  "--p3": "#59A8FF",
  "--p4": "#FF7AC0",
} as CSSProperties;

/** Display face (Bricolage Grotesque) and text face (Atkinson Hyperlegible). */
export const DISPLAY = "font-[family-name:var(--font-bricolage)]";
export const TEXT = "font-[family-name:var(--font-atkinson)]";

/** A seat's player color (seat order is join order). */
export const seatColor = (seat: SeatId) => `var(--${/^p[1-4]$/.test(seat) ? seat : "p1"})`;

export const LABEL = `${TEXT} m-0 text-[13px] font-bold uppercase tracking-[0.07em] text-[var(--text-muted)] min-[900px]:text-[15px]`;

/** Keyboard focus on the dark stage. */
export const FOCUS = "focus-visible:outline-[3px] focus-visible:outline-offset-2 focus-visible:outline-[var(--text)]";

// ---- Icons (inline stroke SVG, decorative) ---------------------------------------------

function Icon({ size = 20, children, className = "" }: { size?: number; children: ReactNode; className?: string }) {
  return (
    <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" className={`shrink-0 ${className}`}>
      {children}
    </svg>
  );
}
export const BoltIcon = (p: { size?: number }) => <Icon {...p}><path d="M13 2 4 14h7l-1 8 9-12h-7z" /></Icon>;
export const CheckIcon = (p: { size?: number }) => <Icon {...p}><path d="m5 12.5 4.5 4.5L19 7.5" /></Icon>;
export const CrossIcon = (p: { size?: number }) => <Icon {...p}><path d="M6 6l12 12M18 6 6 18" /></Icon>;
export const LockIcon = (p: { size?: number }) => (
  <Icon {...p}>
    <rect x="5" y="11" width="14" height="10" rx="2" />
    <path d="M8 11V8a4 4 0 0 1 8 0v3" />
  </Icon>
);
export const CrownIcon = (p: { size?: number }) => <Icon {...p}><path d="M3 18h18M4 8l4 4 4-7 4 7 4-4-2 10H6z" /></Icon>;
export const BackIcon = (p: { size?: number }) => <Icon {...p}><path d="M15 5l-7 7 7 7" /></Icon>;

export const TOPIC_ICONS: Record<string, ReactNode> = {
  geography: (
    <Icon size={26}>
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18M12 3c3 3.5 3 14.5 0 18M12 3c-3 3.5-3 14.5 0 18" />
    </Icon>
  ),
  cinema: (
    <Icon size={26}>
      <rect x="3" y="6" width="18" height="14" rx="2" />
      <path d="M3 10h18M7 6l2 4M12 6l2 4M17 6l2 4" />
    </Icon>
  ),
  science: (
    <Icon size={26}>
      <path d="M9 3h6M10 3v6L4.5 18.5A1.7 1.7 0 0 0 6 21h12a1.7 1.7 0 0 0 1.5-2.5L14 9V3" />
      <path d="M7 15h10" />
    </Icon>
  ),
  sport: (
    <Icon size={26}>
      <circle cx="12" cy="12" r="9" />
      <path d="m12 7 4 3-1.5 4.5h-5L8 10z" />
    </Icon>
  ),
  music: (
    <Icon size={26}>
      <path d="M9 18V5l11-2v13" />
      <circle cx="6.5" cy="18" r="2.5" />
      <circle cx="17.5" cy="16" r="2.5" />
    </Icon>
  ),
  history: (
    <Icon size={26}>
      <path d="M4 21h16M5 21V10M9.5 21V10M14.5 21V10M19 21V10M3 10h18L12 3z" />
    </Icon>
  ),
};

// ---- Avatar -----------------------------------------------------------------------------

export function Avatar({ seat, name, size = 36, locked = false }: { seat: SeatId; name: string; size?: number; locked?: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={`${DISPLAY} flex shrink-0 items-center justify-center rounded-full font-extrabold leading-none text-[var(--ink)]`}
      style={{ width: size, height: size, fontSize: size * 0.45, background: locked ? "var(--disabled)" : seatColor(seat), color: locked ? "var(--text-muted)" : undefined }}
    >
      {locked ? <LockIcon size={size * 0.5} /> : (name.trim().charAt(0) || "?").toUpperCase()}
    </span>
  );
}

// ---- Buttons ----------------------------------------------------------------------------

/** The primary button: buzzer red, ink text, hard shadow. */
export function PrimaryButton({ children, className = "", ...rest }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      className={`${DISPLAY} ${FOCUS} flex h-[60px] w-full cursor-pointer items-center justify-center rounded-2xl border-2 border-[var(--ink)] bg-[var(--buzz)] px-5 text-[20px] font-extrabold text-[var(--ink)] shadow-[0_5px_0_var(--buzz-ring)] transition-transform duration-75 enabled:active:translate-y-1 enabled:active:shadow-none disabled:cursor-not-allowed disabled:border-transparent disabled:bg-[var(--disabled)] disabled:text-[var(--text-muted)] disabled:shadow-none motion-reduce:transition-none ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
}

export function SecondaryButton({ children, className = "", ...rest }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      className={`${DISPLAY} ${FOCUS} flex h-[56px] w-full cursor-pointer items-center justify-center rounded-2xl border-2 border-[var(--text)] bg-transparent px-5 text-[18px] font-extrabold text-[var(--text)] ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
}

/** A 2-to-4-option segmented control (`role="radiogroup"`). */
export function Segmented<T extends string | number>({ label, options, value, onChange, disabled }: {
  label: string;
  options: { value: T; label: string }[];
  value: T;
  onChange?: (value: T) => void;
  disabled?: boolean;
}) {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className="flex gap-1 rounded-2xl bg-[var(--surface)] p-1"
      onKeyDown={(e) => {
        // Arrow keys move the selection, like native radios.
        const step = e.key === "ArrowRight" || e.key === "ArrowDown" ? 1 : e.key === "ArrowLeft" || e.key === "ArrowUp" ? -1 : 0;
        if (!step || disabled) return;
        e.preventDefault();
        const next = options[(options.findIndex((o) => o.value === value) + step + options.length) % options.length];
        onChange?.(next.value);
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
            disabled={disabled}
            onClick={() => onChange?.(option.value)}
            className={`${DISPLAY} ${FOCUS} h-12 flex-1 cursor-pointer rounded-xl text-[17px] font-extrabold disabled:cursor-default ${checked ? "bg-[var(--text)] text-[var(--ink)]" : "bg-transparent text-[var(--text-muted)]"}`}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

// ---- Buzzer -----------------------------------------------------------------------------

export type BuzzerState = "ready" | "pressed" | "wait" | "locked";

/** The big red buzzer. "wait" and "locked" are grey and disabled. */
export function Buzzer({ state, caption, onBuzz, small = false }: { state: BuzzerState; caption: string; onBuzz: () => void; small?: boolean }) {
  const off = state === "wait" || state === "locked";
  const size = small ? 152 : 176;
  return (
    <div className="flex flex-col items-center gap-3">
      <button
        type="button"
        aria-label={state === "locked" ? "Buzzer locked" : state === "wait" ? "Buzzer, wait" : "Buzz"}
        disabled={off || state === "pressed"}
        onPointerDown={(e) => {
          // Buzz on touch-down, not on release: every millisecond counts.
          if (e.button === 0 && !off && state === "ready") onBuzz();
        }}
        onKeyDown={(e) => {
          if ((e.key === "Enter" || e.key === " ") && !off && state === "ready") {
            e.preventDefault();
            onBuzz();
          }
        }}
        className={`${DISPLAY} ${FOCUS} relative flex cursor-pointer touch-manipulation select-none flex-col items-center justify-center rounded-full font-extrabold transition-transform duration-[80ms] disabled:cursor-default motion-reduce:transition-none`}
        style={{
          width: size,
          height: size,
          background: off ? "var(--disabled)" : "var(--buzz)",
          border: `10px solid ${off ? "var(--disabled-ring)" : "var(--buzz-ring)"}`,
          color: off ? "var(--text-muted)" : "#FFFFFF",
          fontSize: small ? 38 : 42,
          transform: state === "pressed" ? "translateY(6px)" : undefined,
          boxShadow: off ? "0 6px 0 var(--disabled-ring)" : state === "pressed" ? "0 3px 0 var(--buzz-base)" : "0 10px 0 var(--buzz-base), 0 0 0 10px rgba(255,75,62,.16)",
        }}
      >
        {state === "locked" ? <LockIcon size={28} /> : null}
        <span className="leading-none">{state === "locked" ? "LOCKED" : state === "wait" ? "WAIT" : "BUZZ"}</span>
      </button>
      <p className={`${TEXT} m-0 text-center text-[15px] text-[var(--text-muted)]`}>{caption}</p>
    </div>
  );
}

// ---- Choices ----------------------------------------------------------------------------

export type ChoiceLook = "default" | "pickable" | "struck" | "right" | "dimmed" | "answer";

export function ChoiceTile({ letter, text, look, note, myColor, onPick, compact }: {
  letter: string;
  text: string;
  look: ChoiceLook;
  /** Right-aligned note, e.g. who struck it. */
  note?: string;
  myColor: string;
  onPick?: () => void;
  compact?: boolean;
}) {
  const height = compact ? "h-[52px]" : "h-14";
  const base = `${FOCUS} flex w-full items-center gap-3 rounded-2xl px-2.5 text-left min-[900px]:h-[78px] min-[900px]:rounded-[18px] min-[900px]:px-3.5 ${height}`;
  const badge = (fill: string, color: string, content: ReactNode) => (
    <span aria-hidden="true" className={`${DISPLAY} flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-full text-[17px] font-extrabold min-[900px]:h-[42px] min-[900px]:w-[42px] min-[900px]:text-[20px]`} style={{ background: fill, color }}>
      {content}
    </span>
  );
  const label = <span className={`${TEXT} min-w-0 flex-1 text-[18px] font-bold leading-tight min-[900px]:text-[22px]`}>{text}</span>;

  if (look === "struck") {
    return (
      <div aria-label={`${text}, struck out`} className={`${base} border-2 border-dashed border-[var(--line-dashed)] text-[var(--text-struck)]`}>
        {badge("var(--buzz)", "#FFFFFF", <CrossIcon size={18} />)}
        <span className={`${TEXT} min-w-0 flex-1 text-[18px] font-bold leading-tight line-through decoration-[var(--buzz)] decoration-[3px] min-[900px]:text-[22px]`}>{text}</span>
        {note ? <span className={`${TEXT} shrink-0 text-[13px]`}>{note}</span> : null}
      </div>
    );
  }
  if (look === "right") {
    return (
      <div className={`${base} border-[3px] border-[var(--right-ink)] bg-[var(--right)] text-[var(--right-ink)]`}>
        {badge("var(--right-ink)", "var(--right)", letter)}
        {label}
        <CheckIcon size={26} />
      </div>
    );
  }
  if (look === "answer") {
    return (
      <div className={`${base} border-[3px] border-[var(--right)] bg-[var(--right-tint)] text-[var(--text)]`}>
        {badge("var(--right)", "var(--right-ink)", letter)}
        {label}
        <span className={`${TEXT} shrink-0 text-[13px] font-bold uppercase tracking-[0.06em] text-[var(--right)]`}>Answer</span>
      </div>
    );
  }
  if (look === "dimmed") {
    return (
      <div className={`${base} bg-[var(--surface)] text-[var(--text-struck)]`}>
        {badge("var(--surface-2)", "var(--text-struck)", letter)}
        {label}
      </div>
    );
  }
  if (look === "pickable") {
    return (
      <button type="button" onClick={onPick} className={`${base} cursor-pointer border-[3px] border-[var(--ink)] bg-[var(--text)] text-[var(--ink)] transition-transform duration-75 active:translate-y-1 motion-reduce:transition-none`} style={{ boxShadow: `0 5px 0 ${myColor}` }}>
        {badge("var(--ink)", "var(--text)", letter)}
        {label}
      </button>
    );
  }
  return (
    <div className={`${base} bg-[var(--text)] text-[var(--ink)]`}>
      {badge("var(--ink)", "var(--text)", letter)}
      {label}
    </div>
  );
}

// ---- Timer ring -------------------------------------------------------------------------

export function TimerRing({ seconds, fraction, paused = false, size = 44, label }: { seconds: number; fraction: number; paused?: boolean; size?: number; label: string }) {
  const stroke = 5;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  return (
    <div role="timer" aria-label={label} className="relative shrink-0 transition-opacity motion-reduce:transition-none" style={{ width: size, height: size, opacity: paused ? 0.45 : 1 }}>
      <svg aria-hidden="true" width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} stroke="var(--surface-2)" strokeWidth={stroke} fill="none" />
        <circle cx={size / 2} cy={size / 2} r={r} stroke="var(--points)" strokeWidth={stroke} fill="none" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - Math.max(0, Math.min(1, fraction)))} />
      </svg>
      <span aria-hidden="true" className={`${DISPLAY} absolute inset-0 flex items-center justify-center font-extrabold text-[var(--text)]`} style={{ fontSize: size * 0.38 }}>
        {seconds}
      </span>
    </div>
  );
}

// ---- Status banner ----------------------------------------------------------------------

export function StatusBanner({ fill, color, icon, text, side, children }: { fill: string; color: string; icon?: ReactNode; text: string; side?: ReactNode; children?: ReactNode }) {
  return (
    <div role="status" className={`${TEXT} relative min-h-12 overflow-hidden rounded-[14px] px-3.5 py-2.5 min-[900px]:min-h-[52px]`} style={{ background: fill, color }}>
      <div className="flex items-center gap-2.5">
        {icon}
        <span className="min-w-0 flex-1 text-[16px] font-bold leading-snug min-[900px]:text-[18px]">{text}</span>
        {side ? <span className="shrink-0 text-[15px] font-bold">{side}</span> : null}
      </div>
      {children}
    </div>
  );
}

// ---- Scores -----------------------------------------------------------------------------

export interface ScoreRow {
  seat: SeatId;
  name: string;
  score: number;
  isMe: boolean;
  /** Buzzed / answering: filled with the player's color. */
  active?: boolean;
  locked?: boolean;
  /** Points just scored ("+3"). */
  pop?: number;
}

/** A row of chips on phones, a column on desktop (sorted by score there). */
export function ScoreBoard({ rows }: { rows: ScoreRow[] }) {
  const sorted = [...rows].sort((a, b) => b.score - a.score);
  const chip = (row: ScoreRow, desktop: boolean) => (
    <li
      key={row.seat}
      className={`relative flex items-center rounded-xl ${desktop ? "h-[60px] gap-3 px-3" : "min-w-0 gap-1.5 px-1.5 py-1.5"}`}
      style={{
        background: row.active ? seatColor(row.seat) : row.locked ? "var(--surface-dim)" : "var(--surface)",
        opacity: row.locked ? 0.7 : 1,
        boxShadow: [row.isMe ? "inset 0 0 0 2px var(--text)" : "", row.active ? `0 0 0 4px color-mix(in srgb, ${seatColor(row.seat)} 30%, transparent)` : ""].filter(Boolean).join(", ") || undefined,
        color: row.active ? "var(--ink)" : "var(--text)",
      }}
    >
      <Avatar seat={row.seat} name={row.name} size={desktop ? 36 : 26} locked={row.locked} />
      <span className="flex min-w-0 flex-1 flex-col">
        <span className={`${TEXT} truncate font-bold ${desktop ? "text-[15px]" : "text-[12px]"}`} style={{ color: row.active ? "var(--ink)" : "var(--text-muted)" }}>
          {row.isMe ? (desktop ? `${row.name} (you)` : "You") : row.name}
        </span>
        <span className={`${DISPLAY} font-extrabold leading-none ${desktop ? "text-[24px]" : "text-[16px]"}`}>{row.score}</span>
      </span>
      {row.pop ? (
        <span className={`${DISPLAY} animate-[bq-pop_300ms_ease-out] absolute -top-3 left-1/2 -translate-x-1/2 rounded-full border-2 border-[var(--ink)] bg-[var(--text)] px-2 py-0.5 text-[14px] font-extrabold text-[var(--ink)] motion-reduce:animate-none`}>
          +{row.pop}
        </span>
      ) : null}
    </li>
  );
  return (
    <>
      <ul aria-label="Scores" className="m-0 grid list-none gap-1.5 p-0 min-[900px]:hidden" style={{ gridTemplateColumns: `repeat(${Math.max(rows.length, 2)}, minmax(0, 1fr))` }}>
        {rows.map((row) => chip(row, false))}
      </ul>
      <ul aria-label="Scores" className="m-0 hidden list-none flex-col gap-2 p-0 min-[900px]:flex">
        {sorted.map((row) => chip(row, true))}
      </ul>
    </>
  );
}
