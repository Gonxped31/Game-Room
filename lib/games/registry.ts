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
  /**
   * Where the hub's Start goes, if not the room page (`/<slug>`, which creates
   * a room) - e.g. a game whose default is a solo page.
   */
  startPath?: string;
  /** Title color, chip border color, and the card buttons' border/shadow/text color - see references/game-room/game-room-ui-spec.md. */
  ink: string;
  /** Description text color. */
  textSecondary: string;
  /** Start button fill - also the game's color square in the hub's Continue chip. */
  accentColor: string;
  /** Tailwind classes for the title's font family/weight/tracking - the button label reuses the same family. */
  titleClassName: string;
  /** Tailwind classes for the button labels specifically (size/weight differ from the title per spec). */
  buttonTextClassName: string;
  /**
   * Leave the game off the hub's cards while keeping it fully playable by
   * link. Hidden games still get their title, colors and tile in "Your rooms"
   * and the Continue chip, since a guest may have rooms of them.
   */
  hidden?: boolean;
}

/**
 * Every game on the platform. Adding a game means an entry here, an art panel
 * and list tile (components/hub/GameArt.tsx), its own lib/games/<slug>/ +
 * components/<slug>/ + app/<slug>/page.tsx, AND its own node in
 * database.rules.json (without that, every write is refused on Firebase). The
 * full checklist is the `add-game` skill (.claude/skills/add-game/SKILL.md). A
 * 3+ player game calls useMultiplayerSession (lib/session/multiplayer/)
 * instead of useGameSession.
 */
export const ALL_GAMES: GameEntry[] = [
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
  {
    slug: "nighthighway",
    title: "Night Highway",
    description: "Race a friend down the same freeway after midnight. Same traffic, same 60 seconds, highest score wins.",
    tags: ["2 players", "Live", "Solo too"],
    maxPlayers: 2,
    ink: "#04070F",
    textSecondary: "#3A4560",
    accentColor: "#FF2B45",
    titleClassName: "font-[family-name:var(--font-big-shoulders)] font-black uppercase tracking-[0.01em]",
    buttonTextClassName: "font-[family-name:var(--font-big-shoulders)] text-[20px] font-extrabold uppercase tracking-[0.04em]",
  },
  {
    slug: "iai",
    title: "Iaï",
    description: "One blade against endless foes. Cut at the perfect moment, alone or side by side with a friend.",
    tags: ["Solo", "2-player co-op"],
    maxPlayers: 2,
    // Solo is the default; co-op lives at the room page (/iai), opened from the solo screen or joined by code.
    startPath: "iai/solo",
    ink: "#0C0D1C",
    textSecondary: "#4A4536",
    // The game's gold (its seal red is too dark for ink-coloured button text).
    accentColor: "#C9A24F",
    titleClassName: "font-[family-name:var(--font-cormorant)] font-bold tracking-[0.12em]",
    buttonTextClassName: "font-[family-name:var(--font-cormorant)] text-[20px] font-bold tracking-[0.08em]",
  },
];

/** The games shown as cards on the hub. */
export const GAMES: GameEntry[] = ALL_GAMES.filter((game) => !game.hidden);

/** Any game by slug, hidden or not - e.g. for a saved room's title and colors. */
export function gameBySlug(slug: string): GameEntry | undefined {
  return ALL_GAMES.find((game) => game.slug === slug);
}
