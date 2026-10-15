import type { ThemeMode } from "@/lib/games/cocounsel/useTheme";

interface ThemeToggleProps {
  theme: ThemeMode;
  onToggle: () => void;
  className?: string;
}

/**
 * Co-Counsel-only light/dark switch. Inline (not fixed) - paired opposite
 * BackLink in each of Co-Counsel's three header shapes (Wordmark,
 * HeaderBand, ResultsHeader), same as BackLink itself. A fixed-position
 * version used to reserve top clearance on every screen (`pt-14` on
 * `<main>`) just for this one small control, which showed as a visible
 * white gap above full-bleed colored bands (HeaderBand/ResultsHeader) once
 * the back link itself moved inline and no longer needed that clearance.
 */
export default function ThemeToggle({ theme, onToggle, className = "" }: ThemeToggleProps) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
      className={`flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-full border-0 bg-black/40 text-lg leading-none text-white ${className}`}
    >
      {theme === "dark" ? "☀" : "🌙"}
    </button>
  );
}
