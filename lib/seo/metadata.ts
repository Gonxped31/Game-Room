import type { Metadata } from "next";
import { APP_TITLE } from "@/lib/games/registry";
import { type Lang, LANGS, localizePath, otherLang } from "@/lib/i18n/lang";
import { LOCALES } from "@/lib/i18n/text";
import { previewFor } from "./previews";

/** og:locale wants "en_CA", not "en-CA". */
const ogLocale = (lang: Lang) => LOCALES[lang].replace("-", "_");

/**
 * A public page's metadata in `lang` (docs/link-previews.md): its tab title,
 * description, canonical and hreflang links, and its Open Graph and X card.
 * `route` is the English route ("/same-page/invite"); call it from the
 * route's layout (or invite page) and its French twin. The image itself comes
 * from the route's opengraph-image.tsx, which Next adds to openGraph and, with
 * no twitter images set here, to the X card too. Relative URLs resolve
 * against the root layout's metadataBase (SITE_URL).
 */
export function pageMetadata(route: string, lang: Lang): Metadata {
  const preview = previewFor(route, lang);
  const url = localizePath(route, lang);
  const languages = Object.fromEntries(LANGS.map((l) => [l, localizePath(route, l)]));
  return {
    title: preview.title,
    description: preview.description,
    alternates: { canonical: url, languages: { ...languages, "x-default": localizePath(route, "en") } },
    openGraph: {
      type: "website",
      siteName: APP_TITLE,
      title: preview.ogTitle,
      description: preview.description,
      // The invite page's own URL, never the game page's: Facebook rescrapes og:url.
      url,
      locale: ogLocale(lang),
      alternateLocale: [ogLocale(otherLang(lang))],
    },
    twitter: { card: "summary_large_image", title: preview.ogTitle, description: preview.description },
    // An invite page is the game page again: previews yes, search results no.
    ...(preview.kind === "invite" ? { robots: { index: false, follow: true } } : {}),
  };
}
