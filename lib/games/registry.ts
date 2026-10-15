/** The platform's overall brand - shown on the picker and in the browser tab there. */
export const APP_TITLE = "Game Room";

export interface GameEntry {
  slug: string;
  title: string;
  description: string;
  /** Short descriptive pills shown under the description, e.g. "2 players". */
  tags: string[];
  /** How many players this game needs. Defaults to 2 (1v1) when omitted. */
  maxPlayers?: number;
  /** Title color, chip border color, and the "Start a room" button's border/shadow/text color - see references/game-room/game-room-ui-spec.md. */
  ink: string;
  /** Description text color. */
  textSecondary: string;
  /** "Start a room" button's fill color. */
  accentColor: string;
  /** Tailwind classes for the title's font family/weight/tracking - the button label reuses the same family. */
  titleClassName: string;
  /** Tailwind classes for the button label specifically (size/weight differ from the title per spec). */
  buttonTextClassName: string;
}

/**
 * Every game available from the picker. Adding a new 1v1 game later is just:
 * an entry here (plus a custom art panel - see GamePickerCard.tsx's
 * per-slug art map), its own lib/games/<slug>/ + components/<slug>/, and an
 * app/<slug>/page.tsx calling useGameSession - nothing else shared needs to
 * change. A 3+ player game instead calls useMultiplayerSession
 * (lib/session/multiplayer/) - see CLAUDE.md's "Multi-game architecture"
 * section for how that backend differs from the 1v1 one.
 */
export const GAMES: GameEntry[] = [
  {
    slug: "ftw",
    title: "First to Worst",
    description: "Rank topics from 1 (best) to 5 (worst), then guess how your partner ranked them.",
    tags: ["2 players", "Live or anytime"],
    maxPlayers: 2,
    ink: "#000000",
    textSecondary: "#333333",
    accentColor: "#FF3D8F",
    titleClassName: "font-bold",
    buttonTextClassName: "text-[19px] font-bold",
  },
  {
    slug: "cocounsel",
    title: "Co-Counsel",
    description: "A cooperative mystery. Each of you knows half the story. Talk it out to find the matching pair.",
    tags: ["2 players", "Best on a call"],
    maxPlayers: 2,
    ink: "#1C1F3D",
    textSecondary: "#4A4F73",
    accentColor: "#FFD23A",
    titleClassName: "font-[family-name:var(--font-archivo)] font-extrabold tracking-[-0.02em]",
    buttonTextClassName: "font-[family-name:var(--font-archivo)] text-[18px] font-extrabold",
  },
];
