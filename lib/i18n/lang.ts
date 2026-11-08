/**
 * The two languages Partyfox speaks (docs/i18n.md). The interface language
 * comes from the URL: `/fr/...` is French, every other page English, so a
 * link always carries its language (link-preview bots send none). A room's
 * content language (questions, words, prompts) is a separate choice stored in
 * its game state; it defaults to the creator's interface language.
 */
export type Lang = "en" | "fr";

export const LANGS: readonly Lang[] = ["en", "fr"];

export const DEFAULT_LANG: Lang = "en";

/** Each language in its own name, for a picker. */
export const LANG_LABELS: Record<Lang, string> = { en: "English", fr: "Français" };

export const isLang = (value: unknown): value is Lang => value === "en" || value === "fr";

export const otherLang = (lang: Lang): Lang => (lang === "en" ? "fr" : "en");

/**
 * localStorage key of the guest's explicit choice from the language switch.
 * Read only by the pre-paint script (headScript.ts) and the switch itself.
 */
export const LANG_CHOICE_KEY = "partyfox.lang";

/** The French prefix. English pages have none. */
export const FR_PREFIX = "/fr";

/** Paths that exist in one language only (the owner's dashboard, the API): never prefixed. */
const UNLOCALIZED = [/^\/admin(\/|$)/, /^\/api\//];

/** "fr" for `/fr` and `/fr/...`, "en" for every other path. */
export function langOfPath(pathname: string): Lang {
  return pathname === FR_PREFIX || pathname.startsWith(`${FR_PREFIX}/`) ? "fr" : "en";
}

/** Splits "/a/b?x=1#c" into its path and its "?x=1#c" tail. */
function splitPath(href: string): [string, string] {
  const at = href.search(/[?#]/);
  return at < 0 ? [href, ""] : [href.slice(0, at), href.slice(at)];
}

/** A path without its language prefix: "/fr/same-page#x" -> "/same-page#x", "/fr" -> "/". */
export function unlocalizedPath(href: string): string {
  const [path, tail] = splitPath(href);
  if (langOfPath(path) !== "fr") return href;
  return (path.slice(FR_PREFIX.length) || "/") + tail;
}

/**
 * The same page in `lang`: "/same-page#x" -> "/fr/same-page#x" for French, and
 * back for English. Only site paths (starting with "/") change; full URLs, "#"
 * and "?" links, /admin and /api come back as they are.
 */
export function localizePath(href: string, lang: Lang): string {
  if (!href.startsWith("/") || href.startsWith("//")) return href;
  const bare = unlocalizedPath(href);
  const [path, tail] = splitPath(bare);
  if (lang === "en" || UNLOCALIZED.some((re) => re.test(path))) return bare;
  return (path === "/" ? FR_PREFIX : `${FR_PREFIX}${path}`) + tail;
}

/**
 * A language from the browser's preferred languages (`navigator.languages`):
 * French if French comes first, else English. Read `navigator` in an effect or
 * an event handler, never during render.
 */
export function defaultLang(preferred: readonly string[] | undefined): Lang {
  const first = preferred?.[0]?.toLowerCase() ?? "";
  return first === "fr" || first.startsWith("fr-") ? "fr" : "en";
}
