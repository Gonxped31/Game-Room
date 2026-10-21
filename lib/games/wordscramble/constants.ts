export const GAME_SLUG = "wordscramble";
export const GAME_TITLE = "Word Scramble";

export const MIN_PLAYERS = 2;
export const MAX_PLAYERS = 8;

/** Words are 4 to 8 letters. */
export const MIN_WORD = 4;
export const MAX_WORD = 8;

export const TURNS_PER_TEAM = { min: 3, max: 10, default: 5 } as const;
export const TARGETS = [20, 30, 40] as const;
/** In target-score games, the game ends after this many turns per team even if nobody got there. */
export const TARGET_TURN_CAP = 20;

/** Before the first word: everyone gets ready. */
export const START_LEAD_MS = 3000;
export const TURN_MS = 30_000;
/** "Got it!" or "Time's up", then the scoreboard, then the next turn. */
export const RESULT_MS = 3000;
export const SCOREBOARD_MS = 3000;
/** After time runs out, how long the other team has to tap Steal. */
export const STEAL_OFFER_MS = 3000;
/** How long the stealing player has to confirm one word. */
export const STEAL_MS = 10_000;

/** A turn keeps at most this many wrong guesses, each at most this long. */
export const MAX_GUESSES = 30;
export const MAX_GUESS_LENGTH = 12;
/** A hint is refused when it would leave fewer letters than this to find. */
export const MIN_LETTERS_LEFT = 2;
