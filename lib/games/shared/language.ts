/**
 * The language a room's content is played in (questions, words, prompts).
 * Chosen by the host per room and stored in the game's state; a new room
 * starts in its creator's interface language (`useLang()`), but the content
 * language never changes the interface's own language, nor the reverse.
 * Same type as the interface language: lib/i18n/lang.ts.
 */
export { type Lang, LANGS, LANG_LABELS, isLang, defaultLang } from "@/lib/i18n/lang";
