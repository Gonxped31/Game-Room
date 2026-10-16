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
 * Every game available from the picker. Adding a game means an entry here,
 * an art panel (GamePickerCard.tsx's per-slug art map), its own
 * lib/games/<slug>/ + components/<slug>/ + app/<slug>/page.tsx, AND its own
 * node in database.rules.json (without that, every write is refused on
 * Firebase). The full checklist is the `add-game` skill
 * (.claude/skills/add-game/SKILL.md). A 3+ player game calls
 * useMultiplayerSession (lib/session/multiplayer/) instead of useGameSession.
 */
// Co-Counsel is temporarily hidden from the picker (not removed - its entry
// is commented out just below, not deleted, so re-enabling it later is a
// one-line uncomment). The game itself is untouched: lib/games/cocounsel/,
// components/cocounsel/, and app/cocounsel/page.tsx all still work exactly
// as before, reachable directly at /cocounsel - this only affects whether it
// shows as a card here. Unlike E-Card's removal (see docs/history/platform.md), nothing
// about the implementation was pulled.
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
  // {
  //   slug: "cocounsel",
  //   title: "Co-Counsel",
  //   description: "A cooperative mystery. Each of you knows half the story. Talk it out to find the matching pair.",
  //   tags: ["2 players", "Best on a call"],
  //   maxPlayers: 2,
  //   ink: "#1C1F3D",
  //   textSecondary: "#4A4F73",
  //   accentColor: "#FFD23A",
  //   titleClassName: "font-[family-name:var(--font-archivo)] font-extrabold tracking-[-0.02em]",
  //   buttonTextClassName: "font-[family-name:var(--font-archivo)] text-[18px] font-extrabold",
  // },
];
