/** The platform's overall brand - shown on the picker and in the browser tab there. */
export const APP_TITLE = "Game Room";

export interface GameEntry {
  slug: string;
  title: string;
  tagline: string;
  emoji: string;
  /** How many players this game needs. Defaults to 2 (1v1) when omitted. */
  maxPlayers?: number;
  /** Path (under public/) to the card's header illustration. */
  image: string;
  /** Short descriptive pills shown under the tagline, e.g. "2 players". */
  tags: string[];
  /** "Start a room" pill's colors - mirrors the per-game accent props already
   * passed to InviteLinkBanner, so the two pink/yellow "buttons" a player
   * sees (picker card, then invite screen) read as the same brand. */
  accentColor: string;
  accentShadowColor: string;
  accentTextColor: string;
}

/**
 * Every game available from the picker. Adding a new 1v1 game later is just:
 * an entry here, its own lib/games/<slug>/ + components/<slug>/, and an
 * app/<slug>/page.tsx calling useGameSession - nothing shared needs to change.
 * A 3+ player game instead calls useMultiplayerSession
 * (lib/session/multiplayer/) - see CLAUDE.md's "Multi-game architecture"
 * section for how that backend differs from the 1v1 one.
 */
export const GAMES: GameEntry[] = [
  {
    slug: "ftw",
    title: "First to Worst",
    tagline: "Rank topics from 1 (best) to 5 (worst), then guess how your partner ranked them.",
    emoji: "🏆",
    maxPlayers: 2,
    image: "/games/ftw-card.png",
    tags: ["2 players", "Live or anytime"],
    accentColor: "#FF3D8F",
    accentShadowColor: "#a3125b",
    accentTextColor: "#000000",
  },
  {
    slug: "cocounsel",
    title: "Co-Counsel",
    tagline: "A cooperative mystery. Each of you knows half the story. Talk it out to find the matching pair.",
    emoji: "⚖️",
    maxPlayers: 2,
    image: "/games/cocounsel-card.png",
    tags: ["2 players", "Best on a call"],
    accentColor: "#FFD23A",
    accentShadowColor: "#1C1F3D",
    accentTextColor: "#1C1F3D",
  },
];
