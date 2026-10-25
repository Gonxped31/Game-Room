import { ALL_GAMES, type GameEntry } from "./registry";

/**
 * Solo games as one HTML file that plays offline: scripts/export-solo.mjs
 * builds exports/<slug>/ into public/downloads/<slug>.html before each
 * `next build`, and /admin offers it for download.
 */
export const SOLO_GAMES: GameEntry[] = ALL_GAMES.filter((game) => game.solo);

/** Where the built file is served. */
export const soloDownloadHref = (slug: string) => `/downloads/${slug}.html`;

/** The name it's saved under. */
export const soloDownloadName = (game: GameEntry) => `${game.title}.html`;
