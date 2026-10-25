import { ALL_GAMES, type GameEntry } from "./registry";

/**
 * Solo games as one HTML file that plays offline: scripts/export-solo.mjs
 * builds exports/<slug>/ into downloads/<slug>.html before each
 * `next build`, and only the signed-in admin can download it, from
 * app/api/admin/downloads/[slug].
 */
export const SOLO_GAMES: GameEntry[] = ALL_GAMES.filter((game) => game.solo);

/** Where the built file is kept (git-ignored; never in public/, so only the admin route serves it). */
export const SOLO_DOWNLOADS_DIR = "downloads";

/** The admin route that serves it. */
export const soloDownloadHref = (slug: string) => `/api/admin/downloads/${slug}`;

/** The name it's saved under. */
export const soloDownloadName = (game: GameEntry) => `${game.title}.html`;
