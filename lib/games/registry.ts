import { type Lang, localizePath } from "@/lib/i18n/lang";

/** The platform's brand (formerly Game Room), the same in every language: the picker, the browser tab, link previews. */
export const APP_TITLE = "Partyfox";

/**
 * Where a game sits in the hub's Social folder
 * (references/game-room/game-room-ui-spec.md): "anywhere" games show
 * everyone what's happening; "talk" games need a call or the same room.
 * "solo" games have no rooms at all: they appear only in the Solo folder
 * (through `solo`, which they must set).
 */
export type HubSection = "anywhere" | "talk" | "solo";

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
  /**
   * A game played in modes the player picks up front (Detour: Challenge or
   * Survival): Start asks which one first and opens the page with `?mode=`,
   * and Matchmaking asks too (each mode has its own queue, `matchGames.ts`).
   */
  modes?: { key: string; label: string; detail: string }[];
  /** Also listed in the Solo folder, with a "Play solo" button that opens this page (no room). */
  solo?: { path: string; description: string; tags: string[] };
  /**
   * Heavy enough (3D) that it plays best on a computer: on a phone it may lag.
   * The hub's cards say so (a filled "Best on a computer" tag, and a notice
   * on the phone card); the game itself tells phone players too.
   */
  bestOnComputer?: boolean;
  /**
   * Leave the game off the hub's cards while keeping it fully playable by
   * link. Hidden games still get their title, colors and tile in "Your rooms"
   * and the Continue chip, since a guest may have rooms of them.
   */
  hidden?: boolean;
  /**
   * The French for the words above (docs/i18n.md): description, short
   * description, tags, modes (matched to the English ones by `key`) and the
   * solo card's words. Titles are brands and stay as they are. Read a card's
   * words through `gameText(game, lang)`, not these fields;
   * lib/games/registry.test.ts checks every game has them all.
   */
  fr?: {
    description: string;
    shortDescription: string;
    tags: string[];
    modes?: { key: string; label: string; detail: string }[];
    solo?: { description: string; tags: string[] };
  };
}

/** A game's card words in one language (`gameText`). */
export interface GameText {
  description: string;
  shortDescription: string;
  tags: string[];
  modes?: { key: string; label: string; detail: string }[];
  /** The Solo card's words. `path` is the English route: links pass it through `localizePath`. */
  solo?: { path: string; description: string; tags: string[] };
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
    fr: {
      description: "Buzze avant les autres. Chaque mauvaise réponse est barrée : la question devient plus facile, mais rapporte moins.",
      shortDescription: "Buzze vite. Les erreurs sont barrées.",
      tags: ["2 à 4 joueurs", "EN ou FR"],
    },
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
    fr: {
      description: "À tour de rôle, deux équipes remettent un mot dans l'ordre contre la montre. Les indices aident, mais coûtent des points.",
      shortDescription: "Deux équipes, des mots à démêler, vite.",
      tags: ["2 à 8 joueurs", "2 équipes"],
    },
    maxPlayers: 8,
    ink: "#2A1B12",
    textSecondary: "#5A4636",
    accentColor: "#FF7A1A",
    titleClassName: "font-[family-name:var(--font-lilita)] font-normal",
    bodyClassName: "font-[family-name:var(--font-nunito)]",
  },
  {
    slug: "lasthop",
    title: "Last Hop",
    section: "anywhere",
    description: "Slide or hop your pieces forward, on a track or a grid. Whoever can't move on their turn loses.",
    shortDescription: "Hop forward. Make the last move.",
    tags: ["2 players", "Track or Grid"],
    maxPlayers: 2,
    modes: [
      { key: "track", label: "Track", detail: "Quick and sharp. One row: every move counts." },
      { key: "grid", label: "Grid", detail: "Longer, more open. Pieces move two ways." },
    ],
    fr: {
      description: "Fais glisser ou sauter tes pions vers l'avant, sur une piste ou une grille. Qui ne peut plus bouger à son tour a perdu.",
      shortDescription: "Avance d'un bond. Joue le dernier coup.",
      tags: ["2 joueurs", "Piste ou Grille"],
      modes: [
        { key: "track", label: "Piste", detail: "Court et serré. Une seule rangée : chaque coup compte." },
        { key: "grid", label: "Grille", detail: "Plus long, plus ouvert. Les pions avancent dans deux directions." },
      ],
    },
    ink: "#1E1733",
    textSecondary: "#544A70",
    accentColor: "#FF8A4C",
    titleClassName: "font-[family-name:var(--font-rubik)] font-extrabold tracking-[-0.01em]",
    bodyClassName: "font-[family-name:var(--font-rubik)]",
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
    bestOnComputer: true,
    solo: {
      path: "/nighthighway/solo",
      description: "Just you and the road. Beat your own best distance.",
      tags: ["Just you", "Best score saved"],
    },
    fr: {
      description: "Prends la route de nuit entre amis. Qui ira le plus loin ?",
      shortDescription: "Prends la route de nuit entre amis.",
      tags: ["En solo ou entre amis"],
      solo: {
        description: "Toi et la route, rien d'autre. Bats ta meilleure distance.",
        tags: ["Rien que toi", "Record enregistré"],
      },
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
    fr: {
      description: "Classe cinq choses de la meilleure à la pire, puis devine l'ordre choisi par ton partenaire.",
      shortDescription: "Classe 5 choses. Devine l'ordre de l'autre.",
      tags: ["2 joueurs", "En direct ou en différé"],
    },
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
    fr: {
      description: "Un mystère en coopération. Chaque joueur connaît la moitié de l'histoire : il faudra se parler pour trouver la bonne paire.",
      shortDescription: "À chacun sa moitié du mystère.",
      tags: ["2 joueurs", "Coopératif"],
    },
    maxPlayers: 2,
    ink: "#1C1F3D",
    textSecondary: "#4A4F73",
    accentColor: "#FFD23A",
    titleClassName: "font-[family-name:var(--font-archivo)] font-extrabold tracking-[-0.02em]",
    bodyClassName: "font-[family-name:var(--font-archivo)]",
  },
  {
    // Solo (daily and Endless) at /regions, races at /regions/race.
    slug: "regions",
    // Rooms (races) live under the solo page, which keeps /regions for its daily players' bookmarks.
    path: "/regions/race",
    title: "Rank & File",
    section: "anywhere",
    description: "Race to place a chess piece in every row, column and colour. Fastest wins, or the slowest go home.",
    shortDescription: "Race to solve the same chess grid.",
    tags: ["2–8 players", "Challenge or Survival"],
    maxPlayers: 8,
    modes: [
      { key: "challenge", label: "Challenge", detail: "2–4 players. A few puzzles, the same for everyone: the lowest total time wins." },
      { key: "survival", label: "Survival", detail: "4–8 players. The slowest are out after each puzzle, until one is left." },
    ],
    ink: "#16261D",
    textSecondary: "#4B5A50",
    accentColor: "#7FD1A6",
    titleClassName: "font-[family-name:var(--font-fraunces)] font-extrabold tracking-[-0.01em]",
    bodyClassName: "font-[family-name:var(--font-dm-sans)]",
    solo: {
      path: "/regions",
      description: "A chess piece in every row, column and colour. None may attack another.",
      tags: ["Just you", "Endless puzzles"],
    },
    fr: {
      description: "Place une pièce d'échecs dans chaque rangée, colonne et couleur, plus vite que les autres. Le meilleur temps gagne, ou les plus lents sont éliminés.",
      shortDescription: "Course sur la même grille d'échecs.",
      tags: ["2 à 8 joueurs", "Défi ou Survie"],
      modes: [
        { key: "challenge", label: "Défi", detail: "2 à 4 joueurs. Quelques grilles, les mêmes pour tout le monde : le plus petit temps total gagne." },
        { key: "survival", label: "Survie", detail: "4 à 8 joueurs. Les plus lents sont éliminés après chaque grille, jusqu'à ce qu'il n'en reste qu'un." },
      ],
      solo: {
        description: "Une pièce d'échecs dans chaque rangée, colonne et couleur. Aucune ne doit en attaquer une autre.",
        tags: ["Rien que toi", "Grilles à l'infini"],
      },
    },
  },
  {
    slug: "borderrun",
    title: "Detour",
    section: "anywhere",
    description: "Race to link two countries by land, around the closed borders. Fastest wins, or the slowest go home.",
    shortDescription: "Race to link two countries by land.",
    tags: ["2–8 players", "Challenge or Survival"],
    maxPlayers: 8,
    modes: [
      { key: "challenge", label: "Challenge", detail: "2–4 players. A few routes, the same for everyone: the lowest total time wins." },
      { key: "survival", label: "Survival", detail: "4–8 players. The slowest are out after each route, until one is left." },
    ],
    ink: "#1D2733",
    textSecondary: "#566273",
    accentColor: "#F5C04A",
    titleClassName: "font-[family-name:var(--font-overpass)] font-extrabold tracking-[0.01em]",
    bodyClassName: "font-[family-name:var(--font-overpass)]",
    solo: {
      path: "/borderrun/solo",
      description: "Link two countries by land, around the closed borders. A new route every day.",
      tags: ["Just you", "Daily route"],
    },
    fr: {
      description: "Relie deux pays par la terre en contournant les frontières fermées, plus vite que les autres. Le meilleur temps gagne, ou les plus lents sont éliminés.",
      shortDescription: "Course pour relier deux pays par la terre.",
      tags: ["2 à 8 joueurs", "Défi ou Survie"],
      modes: [
        { key: "challenge", label: "Défi", detail: "2 à 4 joueurs. Quelques parcours, les mêmes pour tout le monde : le plus petit temps total gagne." },
        { key: "survival", label: "Survie", detail: "4 à 8 joueurs. Les plus lents sont éliminés après chaque parcours, jusqu'à ce qu'il n'en reste qu'un." },
      ],
      solo: {
        description: "Relie deux pays par la terre, en contournant les frontières fermées. Un nouveau parcours chaque jour.",
        tags: ["Rien que toi", "Parcours du jour"],
      },
    },
  },
];

/** The games shown as cards on the hub. */
export const GAMES: GameEntry[] = ALL_GAMES.filter((game) => !game.hidden);

/** Any game by slug, hidden or not - e.g. for a saved room's title and colors. */
export function gameBySlug(slug: string): GameEntry | undefined {
  return ALL_GAMES.find((game) => game.slug === slug);
}

/**
 * A game's card words in `lang`: the English fields, or their French (`fr`)
 * for "fr", falling back to English for anything missing. Titles stay brands.
 */
export function gameText(game: GameEntry, lang: Lang): GameText {
  const fr = lang === "fr" ? game.fr : undefined;
  return {
    description: fr?.description ?? game.description,
    shortDescription: fr?.shortDescription ?? game.shortDescription,
    tags: fr?.tags ?? game.tags,
    modes: game.modes?.map((mode) => fr?.modes?.find((m) => m.key === mode.key) ?? mode),
    solo: game.solo ? { path: game.solo.path, ...(fr?.solo ?? { description: game.solo.description, tags: game.solo.tags }) } : undefined,
  };
}

/**
 * A game's page route: `/same-page` for the `ftw` slug, `/<slug>` otherwise
 * (also for unknown slugs); under `/fr` in French.
 */
export function gamePath(slug: string, lang: Lang = "en"): string {
  return localizePath(gameBySlug(slug)?.path ?? `/${slug}`, lang);
}

/** The link to a room: `/<route>#<code>`, under `/fr` in French. */
export function roomHref(slug: string, code: string, lang: Lang = "en"): string {
  return `${gamePath(slug, lang)}#${code}`;
}
