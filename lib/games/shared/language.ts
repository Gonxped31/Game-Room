/**
 * The language a room's content is played in (questions, words). Chosen by
 * the host per room and stored in the game's state; it never changes the
 * interface's own language.
 */
export type Lang = "en" | "fr";

export const LANGS: readonly Lang[] = ["en", "fr"];

export const LANG_LABELS: Record<Lang, string> = { en: "English", fr: "Français" };

export const isLang = (value: unknown): value is Lang => value === "en" || value === "fr";

/**
 * The default for a new room, from the browser's preferred languages
 * (`navigator.languages`): French if French comes first, else English. Read
 * `navigator` in an effect or event handler, never during render.
 */
export function defaultLang(preferred: readonly string[] | undefined): Lang {
  const first = preferred?.[0]?.toLowerCase() ?? "";
  return first === "fr" || first.startsWith("fr-") ? "fr" : "en";
}
