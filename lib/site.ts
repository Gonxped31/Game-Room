/**
 * The site's public address: link previews' absolute URLs (og:image, og:url)
 * and canonical links. NEXT_PUBLIC_SITE_URL overrides it (e.g. to try
 * previews on another host); production is partyfox.io.
 */
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || "https://partyfox.io").replace(/\/+$/, "");
