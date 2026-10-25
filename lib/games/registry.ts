/** The platform's overall brand - shown on the picker and in the browser tab there. */
export const APP_TITLE = "Game Room";

/**
 * Where a game sits in the hub's Social folder
 * (references/game-room/game-room-ui-spec.md): "anywhere" games show
 * everyone what's happening; "talk" games need a call or the same room.
 */
export type HubSection = "anywhere" | "talk";

export interface GameEntry {
  /** The data slug: `meta.gameSlug`, the state node `games/{room}/{slug}` and its rules. Never changes once rooms exist. */
  slug: string;
  /**
   * The page route, if not `/<slug>` - e.g. Same Page lives at `/same-page`
   * while its rooms keep the `ftw` slug (next.config.ts redirects `/ftw`).
   */
  path?: string;
  title: string;
  section: HubSection;
  /** The desktop card's description (up to 3 lines at 300px). */
  description: string;
  /** The mobile compact card's description (2 lines at most). */
  shortDescription: string;
  /** Outlined pills under the description; the mobile card shows only the first (the player count). */
  tags: string[];
  /** How many players this game needs. Defaults to 2 (1v1) when omitted. */
  maxPlayers?: number;
  /** Title color, chip border color, and the card buttons' border/shadow/text color. */
  ink: string;
  /** Description text color. */
  textSecondary: string;
  /** Start button fill. */
  accentColor: string;
  /** The game's color square in the Continue chip, if not `accentColor`. */
  continueColor?: string;
  /** Tailwind classes for the title's font family/weight/tracking - the button labels reuse the same family. */
  titleClassName: string;
  /** Tailwind class for the card's body font (description, chips). */
  bodyClassName: string;
  /** Also listed in the Solo folder, with a "Play solo" button that opens this page (no room). */
  solo?: { path: string; description: string; tags: string[] };
  /**
   * Leave the game off the hub's cards while keeping it fully playable by
   * link. Hidden games still get their title, colors and tile in "Your rooms"
   * and the Continue chip, since a guest may have rooms of them.
   */
  hidden?: boolean;
}

/**
 * Every game on the platform, in hub order within each section. Adding a game
 * means an entry here, an art panel, mini art and list tile
 * (components/gameRoom/), its own lib/games/<slug>/ + components/<slug>/ +
 * app/<slug>/page.tsx, AND its own node in database.rules.json (without that,
 * every write is refused on Firebase). The full checklist is the `add-game`
 * skill (.claude/skills/add-game/SKILL.md). A 1v1 game's page calls
 * useGameSession; a bigger one calls useSession (lib/session/useSession.ts)
 * with its own maxPlayers.
 */
export const ALL_GAMES: GameEntry[] = [
  {
    slug: "buzzerquiz",
    title: "Buzzer Quiz",
    section: "anywhere",
    description: "Race to buzz in. Wrong answers get struck out, so the question gets easier but worth less.",
    shortDescription: "Buzz first. Wrong answers get struck out.",
    tags: ["2–4 players", "EN or FR"],
    maxPlayers: 4,
    ink: "#16113A",
    textSecondary: "#4A4570",
    accentColor: "#FF4B3E",
    titleClassName: "font-[family-name:var(--font-bricolage)] font-extrabold tracking-[-0.01em]",
    bodyClassName: "font-[family-name:var(--font-atkinson)]",
  },
  {
    slug: "wordscramble",
    title: "Word Scramble",
    section: "anywhere",
    description: "Two teams take turns unscrambling a word against the clock. Hints help, but cost points.",
    shortDescription: "Two teams race to unscramble words.",
    tags: ["2–8 players", "2 teams"],
    maxPlayers: 8,
    ink: "#2A1B12",
    textSecondary: "#5A4636",
    accentColor: "#FF7A1A",
    titleClassName: "font-[family-name:var(--font-lilita)] font-normal",
    bodyClassName: "font-[family-name:var(--font-nunito)]",
  },
  {
    // Art, copy, chips and colors are placeholders until it has its own hub design.
    slug: "nighthighway",
    title: "Night Highway",
    section: "anywhere",
    description: "Drive through the night with friends. Who makes it furthest?",
    shortDescription: "Drive through the night with friends.",
    tags: ["Solo or with friends"],
    maxPlayers: 2,
    ink: "#14163A",
    textSecondary: "#4B4E72",
    accentColor: "#FFD34D",
    titleClassName: "font-[family-name:var(--font-fredoka)] font-bold",
    bodyClassName: "font-[family-name:var(--font-fredoka)]",
    solo: {
      path: "/nighthighway/solo",
      description: "Just you and the road. Beat your own best distance.",
      tags: ["Just you", "Best score saved"],
    },
  },
  {
    slug: "ftw",
    path: "/same-page",
    title: "Same Page",
    section: "talk",
    description: "Rank five things from best to worst, then guess how your partner ranked them.",
    shortDescription: "Rank 5 things. Guess your partner's order.",
    tags: ["2 players", "Live or anytime"],
    maxPlayers: 2,
    ink: "#1D2240",
    textSecondary: "#565C85",
    accentColor: "#FF8FC7",
    continueColor: "#B9A7FF",
    titleClassName: "font-[family-name:var(--font-bagel)] font-normal",
    bodyClassName: "font-[family-name:var(--font-dm-sans)]",
  },
  {
    slug: "cocounsel",
    title: "Co-Counsel",
    section: "talk",
    description: "A cooperative mystery. Each of you knows half the story. Talk it out to find the matching pair.",
    shortDescription: "Each of you knows half of a mystery.",
    tags: ["2 players", "Cooperative"],
    maxPlayers: 2,
    ink: "#1C1F3D",
    textSecondary: "#4A4F73",
    accentColor: "#FFD23A",
    titleClassName: "font-[family-name:var(--font-archivo)] font-extrabold tracking-[-0.02em]",
    bodyClassName: "font-[family-name:var(--font-archivo)]",
  },
];

/** The games shown as cards on the hub. */
export const GAMES: GameEntry[] = ALL_GAMES.filter((game) => !game.hidden);

/** Any game by slug, hidden or not - e.g. for a saved room's title and colors. */
export function gameBySlug(slug: string): GameEntry | undefined {
  return ALL_GAMES.find((game) => game.slug === slug);
}

/** A game's page route: `/same-page` for the `ftw` slug, `/<slug>` otherwise (also for unknown slugs). */
export function gamePath(slug: string): string {
  return gameBySlug(slug)?.path ?? `/${slug}`;
}

/** The link to a room: `/<route>#<code>`. */
export function roomHref(slug: string, code: string): string {
  return `${gamePath(slug)}#${code}`;
}
