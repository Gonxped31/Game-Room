import type { ButtonHTMLAttributes, CSSProperties, ReactNode } from "react";

/**
 * Same Page's building blocks, per references/ftw/first-to-worst-game-design.md.
 * Colors are the spec's tokens, set as CSS variables on the page's root
 * (`THEME`), so components only ever say `var(--desk)` and so on.
 */

export const THEME = {
  "--desk": "#B9A7FF",
  "--paper": "#FFFDF5",
  "--rule": "#C9DDF7",
  "--margin": "#FF6B6B",
  "--ink": "#1D2240",
  "--ink-shadow": "#0A0C22",
  "--muted": "#565C85",
  "--match": "rgba(124,245,176,.85)",
  "--match-ink": "#127A47",
  "--miss": "#C8302F",
  "--slot": "#8EA9D6",
} as CSSProperties;

/** Rank note fills, 1 (best) to 5 (worst). The number is always printed on the note too. */
export const NOTE_COLORS = ["#FFE94A", "#7CF5B0", "#6FD3FF", "#FFB25C", "#FF8FC7"] as const;

/** Player colors: the room's creator is yellow, the other player pink. */
export const CREATOR_COLOR = "#FFE94A";
export const PARTNER_COLOR = "#FF8FC7";

export const DISPLAY = "font-[family-name:var(--font-bagel)] font-normal";
export const HAND = "font-[family-name:var(--font-kalam)] font-bold";
export const TEXT = "font-[family-name:var(--font-dm-sans)]";
export const FOCUS = "focus-visible:outline-[3px] focus-visible:outline-offset-2 focus-visible:outline-[var(--ink)]";

/** Each row's (or hand slot's) small tilt, so the notes look hand-placed. */
export const TILTS = [-3, 2.5, -1.5, 3.5, -2.5] as const;

/** A sticky note's size, in px or any CSS length (the hand shrinks its notes to fit 375px). */
type NoteSize = number | string;
const cssSize = (size: NoteSize) => (typeof size === "number" ? `${size}px` : size);

/**
 * A square rank note: its color, the number in Kalam at 66% of its size
 * (nudged 1/14 down to sit optically centered), and a curled bottom-right
 * corner. `n: null` is a face-down note (the other player's progress: placed,
 * number hidden).
 */
export function StickyNote({ n, size, tilt = 0, className = "", style }: { n: number | null; size: NoteSize; tilt?: number; className?: string; style?: CSSProperties }) {
  const s = cssSize(size);
  return (
    <span
      aria-hidden="true"
      className={`${HAND} flex shrink-0 items-center justify-center leading-none text-[var(--ink)] shadow-[0_2px_0_rgba(29,34,64,.14),0_6px_12px_rgba(29,34,64,.16)] ${className}`}
      style={{
        width: s,
        height: s,
        fontSize: `calc(${s} * 0.66)`,
        paddingTop: `calc(${s} / 14)`,
        borderRadius: `3px 3px calc(${s} / 5) 3px`,
        background: n == null ? "repeating-linear-gradient(135deg, #D9D2F7 0 6px, #CEC5F2 6px 12px)" : NOTE_COLORS[n - 1],
        transform: tilt ? `rotate(${tilt}deg)` : undefined,
        ...style,
      }}
    >
      {n ?? ""}
    </span>
  );
}

/** Full-width, 58px, ink fill with a hard shadow. Disabled: faded, no shadow, and the label says what's missing. */
export function PrimaryButton({ className = "", ...rest }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      className={`${TEXT} flex h-[58px] w-full cursor-pointer items-center justify-center rounded-2xl border-0 bg-[var(--ink)] px-4 text-[18px] font-bold text-white shadow-[0_5px_0_var(--ink-shadow)] transition-transform duration-[60ms] enabled:active:translate-y-[5px] enabled:active:shadow-none disabled:cursor-not-allowed disabled:bg-[rgba(29,34,64,.18)] disabled:text-[rgba(29,34,64,.6)] disabled:shadow-none motion-reduce:transition-none ${FOCUS} ${className}`}
      {...rest}
    />
  );
}

/** A small white button for secondary actions (Shuffle prompt, Use this prompt). */
export function SmallButton({ className = "", ...rest }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      className={`${TEXT} cursor-pointer rounded-xl border-2 border-[var(--ink)] bg-white px-3.5 py-2 text-sm font-bold text-[var(--ink)] shadow-[0_3px_0_var(--ink)] active:translate-y-[3px] active:shadow-none ${FOCUS} ${className}`}
      {...rest}
    />
  );
}

/** A player's 10px color square with a 1.5px ink outline. */
export function PlayerSquare({ color, size = 10 }: { color: string; size?: number }) {
  return <span aria-hidden="true" className="shrink-0 rounded-[2px] border-[1.5px] border-[var(--ink)]" style={{ width: size, height: size, backgroundColor: color }} />;
}

// ---- Icons (inline SVG, decorative) ---------------------------------------------------

function Icon({ size = 20, strokeWidth = 2.4, children }: { size?: number; strokeWidth?: number; children: ReactNode }) {
  return (
    <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
      {children}
    </svg>
  );
}
export const PenIcon = (p: { size?: number }) => (
  <Icon {...p}>
    <path d="M4 20h4L19 9l-4-4L4 16z" />
    <path d="M13.5 6.5l4 4" />
  </Icon>
);
export const EyeIcon = (p: { size?: number }) => (
  <Icon {...p}>
    <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" />
    <circle cx="12" cy="12" r="3" />
  </Icon>
);
export const CheckIcon = (p: { size?: number; strokeWidth?: number }) => (
  <Icon {...p}>
    <path d="m5 12.5 4.5 4.5L19 7.5" />
  </Icon>
);
