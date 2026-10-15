import { useEffect, useState } from "react";

export type ThemeMode = "light" | "dark";

const STORAGE_KEY = "cocounsel-theme";

/**
 * Co-Counsel-only manual light/dark toggle, backed by localStorage under a
 * game-specific key so a future game's own toggle can't collide with it.
 *
 * Unlike app/cocounsel/page.tsx's `isCreator` (a lazy-useState read of
 * `window` that's safe because the JSX depending on it stays gated behind
 * `!game`), the theme is applied as a `data-theme` attribute on the page's
 * root wrapper div, which renders unconditionally from the very first paint.
 * A lazy initializer there would read the real stored value during the
 * client's hydration pass while the server-rendered HTML always has no
 * window to read, i.e. a guaranteed hydration mismatch. So this starts at
 * "light" on every render (server and client's first paint alike) and only
 * reads the real stored value inside an effect, via `setTimeout(fn, 0)` -
 * the same deferred-first-setState pattern useGameSession's `now` tick uses
 * - so any theme switch for a returning dark-mode visitor happens as a
 * same-tick-after-mount correction, not a server/client mismatch.
 */
export function useTheme() {
  const [theme, setTheme] = useState<ThemeMode>("light");

  useEffect(() => {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored === "dark") {
      const id = setTimeout(() => setTheme("dark"), 0);
      return () => clearTimeout(id);
    }
  }, []);

  const toggleTheme = () => {
    const next: ThemeMode = theme === "dark" ? "light" : "dark";
    setTheme(next);
    window.localStorage.setItem(STORAGE_KEY, next);
  };

  return { theme, toggleTheme };
}
