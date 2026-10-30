"use client";

import type { ButtonHTMLAttributes, CSSProperties } from "react";
import type { Role } from "@/lib/session/types";
import type { Pawn } from "@/lib/games/lasthop/constants";
import { PawnShape } from "./pawns";

/**
 * Last Hop's look: a night-violet stage with rounded wells, each player's
 * pieces in their own colour (tangerine for p1, mint for p2) and the pawn
 * they picked (`pawns.tsx`), whichever side they play that round. Colours
 * are CSS variables on the page's root (`THEME`).
 */
export const THEME = {
  "--stage": "#1E1733",
  "--surface": "#2B2247",
  "--surface-2": "#372D5A",
  "--well": "#140F26",
  "--well-rim": "#3D3266",
  "--text": "#FFF6EA",
  "--muted": "#B9AFD9",
  "--ink": "#1E1733",
  "--p1": "#FF8A4C",
  "--p1-shade": "#B4511E",
  "--p2": "#43D6B5",
  "--p2-shade": "#1D8A70",
  "--target": "#FFE066",
  "--danger": "#FF5A6E",
} as CSSProperties;

export const FONT = "font-[family-name:var(--font-rubik)]";

export const seatColor = (seat: Role) => `var(--${seat})`;
export const seatShade = (seat: Role) => `var(--${seat}-shade)`;
/** A player's pawn in small, in their colour, beside their name. */
export function PieceMark({ seat, pawn, size = 20 }: { seat: Role; pawn: Pawn; size?: number }) {
  return <PawnShape pawn={pawn} fill={seatColor(seat)} className="shrink-0" style={{ width: size, height: size }} />;
}

/** Keyboard focus on the dark stage. */
export const FOCUS = "focus-visible:outline-[3px] focus-visible:outline-offset-2 focus-visible:outline-[var(--text)]";

const BUTTON = `${FONT} flex h-[54px] w-full cursor-pointer items-center justify-center rounded-2xl border-0 px-5 text-[18px] font-bold transition-transform duration-[60ms] enabled:active:translate-y-[4px] enabled:active:shadow-none disabled:cursor-not-allowed disabled:opacity-60 motion-reduce:transition-none ${FOCUS}`;

/** The tangerine call to action. */
export function PrimaryButton({ className = "", ...rest }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return <button type="button" className={`${BUTTON} bg-[var(--p1)] text-[var(--ink)] shadow-[0_4px_0_var(--p1-shade)] ${className}`} {...rest} />;
}

export function SecondaryButton({ className = "", ...rest }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return <button type="button" className={`${BUTTON} bg-[var(--surface-2)] text-[var(--text)] shadow-[0_4px_0_var(--well)] ${className}`} {...rest} />;
}

/** "1:05", or "8.4" under 10 s. */
export function formatClock(ms: number): string {
  if (ms < 10_000) return (Math.max(0, Math.floor(ms / 100)) / 10).toFixed(1);
  const seconds = Math.ceil(ms / 1000);
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}
