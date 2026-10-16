import type { ThemeMode } from "@/lib/games/cocounsel/useTheme";

interface ThemeToggleProps {
  theme: ThemeMode;
  onToggle: () => void;
  className?: string;
}

/**
 * Co-Counsel-only light/dark switch. Inline (not fixed) - paired opposite
 * BackLink in each of Co-Counsel's three header shapes (Wordmark,
 * HeaderBand, ResultsHeader), same as BackLink itself, so no screen has to
 * reserve top clearance for it - full-bleed colored bands stay flush with
 * the top of the viewport.
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
