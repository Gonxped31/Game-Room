/**
 * The game's name everywhere in the UI. It was "First to Worst"; its rooms
 * keep the `ftw` slug (references/ftw/first-to-worst-game-design.md,
 * "Migration notes").
 */
export const GAME_TITLE = "Same Page";

/** Every round always has exactly this many items and rank notes. */
export const ITEMS_PER_ROUND = 5;

/**
 * Length caps on a round's free text - enforced by database.rules.json's
 * `ftw` .validate as well, so a custom prompt over either limit would be
 * rejected by the database anyway. The built-in bank sits well under both.
 */
export const MAX_PROMPT_LENGTH = 120;
export const MAX_ITEM_LENGTH = 60;
