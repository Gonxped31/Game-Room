/** Working title used everywhere in the UI. Change this before any public release. */
export const GAME_TITLE = "First to Worst";

/** Every round always has exactly this many topic cards and number cards. */
export const ITEMS_PER_ROUND = 5;

/**
 * Length caps on a round's free text - enforced by database.rules.json's
 * `ftw` .validate as well, so a custom prompt over either limit would be
 * rejected by the database anyway. The built-in bank sits well under both.
 */
export const MAX_PROMPT_LENGTH = 120;
export const MAX_ITEM_LENGTH = 60;

/**
 * The page's responsive max-width, shared by the main wrapper and
 * RoundBoard's fixed bottom bar (a separate `position:fixed` stacking
 * context that can't inherit the page's width, so it needs the same class
 * applied directly to stay aligned). Mobile stays at the original 520px;
 * wider viewports get noticeably more room on a computer without stretching
 * into an empty-looking full-desktop-width layout - the same growth pattern
 * Co-Counsel's own CONTAINER_MAX_WIDTH_CLASS uses, duplicated here rather
 * than imported since it's a per-game layout choice, not shared platform
 * infrastructure.
 */
export const CONTAINER_MAX_WIDTH_CLASS = "max-w-[520px] sm:max-w-[600px] md:max-w-[680px] lg:max-w-[760px]";

/** Gradient stops for each number card, 1-indexed by position in this array. */
export const NUMBER_GRADIENTS: readonly [string, string][] = [
  ["#2DE0F5", "#1B5BD6"],
  ["#9BE564", "#14934A"],
  ["#FFF06A", "#FFB800"],
  ["#FFC25C", "#FF6A13"],
  ["#FF9CC4", "#E6287E"],
];
