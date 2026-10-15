import type { ThemeMode } from "@/lib/games/cocounsel/useTheme";

interface ThemeToggleProps {
  theme: ThemeMode;
  onToggle: () => void;
}

/**
 * Co-Counsel-only light/dark switch, mirroring BackButton's fixed top-left
 * circle on the opposite corner so the two read as a matched pair.
 */
export default function ThemeToggle({ theme, onToggle }: ThemeToggleProps) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
      className="fixed right-3 top-3 z-30 flex h-9 w-9 items-center justify-center rounded-full bg-black/40 text-lg leading-none text-white"
    >
      {theme === "dark" ? "☀" : "🌙"}
    </button>
  );
}
