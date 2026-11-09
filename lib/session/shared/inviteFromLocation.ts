import { ALL_GAMES, gamePath } from "@/lib/games/registry";
import { langOfPath, unlocalizedPath } from "@/lib/i18n/lang";
import { inviteUrl } from "@/lib/share";

/** The parts of `window.location` an invite is built from. */
export interface PageLocation {
  origin: string;
  pathname: string;
  hash: string;
  href: string;
}

/** A code the database can address (`readRoomMeta`'s check). */
const ROOM_CODE = /^[a-z0-9]{1,12}$/;

/**
 * The game whose room page is at `pathname`, by its registry slug: "/fr/same-page"
 * and "/same-page/invite" are both "ftw". Null for a page that isn't a game's
 * room page (the hub, a solo page).
 */
export function roomSlugOfPath(pathname: string): string | null {
  let path = unlocalizedPath(pathname);
  if (path.length > 1 && path.endsWith("/")) path = path.slice(0, -1);
  if (path.endsWith("/invite")) path = path.slice(0, -"/invite".length) || "/";
  return ALL_GAMES.find((game) => gamePath(game.slug) === path)?.slug ?? null;
}

/**
 * The invite link for the room this page shows (`inviteUrl`, in the page's
 * language), worked out from the address alone so the shared invite buttons
 * need nothing from the game pages. Falls back to the address as it is when
 * the page isn't a known game's room page or has no room code.
 * Pass `window.location`, read in an event handler.
 */
export function inviteFromLocation(location: PageLocation): string {
  const slug = roomSlugOfPath(location.pathname);
  const code = location.hash.slice(1);
  if (!slug || !ROOM_CODE.test(code)) return location.href;
  return inviteUrl(location.origin, slug, code, langOfPath(location.pathname));
}
