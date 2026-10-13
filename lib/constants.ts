/** Working title used everywhere in the UI. Change this before any public release. */
export const GAME_TITLE = "First to Worst";

/** Every round always has exactly this many topic cards and number cards. */
export const ITEMS_PER_ROUND = 5;

/** Gradient stops for each number card, 1-indexed by position in this array. */
export const NUMBER_GRADIENTS: readonly [string, string][] = [
  ["#2DE0F5", "#1B5BD6"],
  ["#9BE564", "#14934A"],
  ["#FFF06A", "#FFB800"],
  ["#FFC25C", "#FF6A13"],
  ["#FF9CC4", "#E6287E"],
];

export type Role = "p1" | "p2";
