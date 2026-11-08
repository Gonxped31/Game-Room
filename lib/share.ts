import { gamePath } from "@/lib/games/registry";
import { type Lang, localizePath } from "@/lib/i18n/lang";

/**
 * The links the app hands out, so each one carries what the receiving side
 * needs (docs/tracking.md, docs/link-previews.md):
 * - the sharer's language (`/fr/...`), so the link preview and the page open
 *   in it;
 * - its source tag (`utm_source=invite|daily` + `utm_campaign=<slug>`), read
 *   once on arrival and then removed from the address bar;
 * - for a room, its invite page (`<room page>/invite`), whose link preview
 *   says "You're invited to a <Game> room". The #code stays in the hash: it
 *   never reaches a server or a preview.
 * `origin` is `window.location.origin`, read in an effect or event handler.
 */

/** The link that invites someone into a room. */
export function inviteUrl(origin: string, slug: string, code: string, lang: Lang): string {
  return `${origin}${gamePath(slug, lang)}/invite?utm_source=invite&utm_campaign=${encodeURIComponent(slug)}#${code}`;
}

/** The link a daily puzzle's Share button sends, to that game's daily page. */
export function dailyShareUrl(origin: string, slug: string, path: string, lang: Lang): string {
  return `${origin}${localizePath(path, lang)}?utm_source=daily&utm_campaign=${encodeURIComponent(slug)}`;
}
