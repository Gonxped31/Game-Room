import type { MetadataRoute } from "next";
import { type Lang, LANGS, localizePath } from "@/lib/i18n/lang";
import { PREVIEW_ROUTES } from "@/lib/seo/previews";
import { SITE_URL } from "@/lib/site";

/**
 * The public pages for search engines, each with its French twin as an
 * alternate (docs/link-previews.md). Invite pages are left out: they're the
 * game pages again, marked noindex.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const url = (route: string, lang: Lang) => `${SITE_URL}${route === "/" && lang === "en" ? "" : localizePath(route, lang)}`;
  return PREVIEW_ROUTES.filter((p) => p.kind !== "invite").flatMap(({ route }) =>
    LANGS.map((lang) => ({ url: url(route, lang), alternates: { languages: Object.fromEntries(LANGS.map((l) => [l, url(route, l)])) } })),
  );
}
