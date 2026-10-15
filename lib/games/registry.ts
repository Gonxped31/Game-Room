/** The platform's overall brand - shown on the picker and in the browser tab there. */
export const APP_TITLE = "Game Room";

export interface GameEntry {
  slug: string;
  title: string;
  tagline: string;
  emoji: string;
}

/**
 * Every game available from the picker. Adding a new 1v1 game later is just:
 * an entry here, its own lib/games/<slug>/ + components/<slug>/, and an
 * app/<slug>/page.tsx calling useGameSession - nothing shared needs to change.
 */
export const GAMES: GameEntry[] = [
  {
    slug: "ftw",
    title: "First to Worst",
    tagline: "Rank topics 1-to-5, then guess how your partner ranked them.",
    emoji: "🏆",
  },
];
