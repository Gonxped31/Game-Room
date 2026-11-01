import type { Lang } from "@/lib/games/shared/language";

export const GAME_SLUG = "buzzerquiz";
export const GAME_TITLE = "Buzzer Quiz";

export const MIN_PLAYERS = 2;
export const MAX_PLAYERS = 4;

/** Every question has exactly this many choices; the right one is `choices[0]` in the bank. */
export const CHOICES = 4;

export const LENGTHS = [5, 10, 15, 20] as const;
export type GameLength = (typeof LENGTHS)[number];
export const DEFAULT_LENGTH: GameLength = 10;

export const TOPICS = ["geography", "cinema", "science", "sport", "music", "history"] as const;
export type TopicId = (typeof TOPICS)[number];

export const TOPIC_LABELS: Record<TopicId, Record<Lang, string>> = {
  geography: { en: "Geography", fr: "Géographie" },
  cinema: { en: "Cinema & TV", fr: "Cinéma & télé" },
  science: { en: "Science", fr: "Sciences" },
  sport: { en: "Sport", fr: "Sport" },
  music: { en: "Music", fr: "Musique" },
  history: { en: "History", fr: "Histoire" },
};

/** The 3-2-1 before each question. */
export const COUNTDOWN_MS = 3000;
/** How long a question stays open for buzzing; paused while someone is answering. */
export const QUESTION_MS = 15_000;
/** After the first buzz, how long other buzzes still count - the fastest reaction within it wins. */
export const BUZZ_WINDOW_MS = 300;
/** How long the buzzer has to pick. */
export const ANSWER_MS = 5000;
/** How long the result of a question stays up before the next countdown. */
export const RESULT_MS = 3000;

/**
 * Power cards (the host's switch, off by default; never in matchmaking):
 * each player is dealt HAND_SIZE different ones per game and may play one
 * per question, during the countdown or before buzzing.
 * - freeze: the others can't buzz for the first FREEZE_MS of the question (countdown only);
 * - double: a right answer scores double;
 * - fifty: two wrong choices disappear, on that player's screen only;
 * - steal: if someone else is right, take 1 of their points;
 * - shield: a wrong answer (or running out of time) doesn't lock you out.
 */
export const CARDS = ["freeze", "double", "fifty", "steal", "shield"] as const;
export type Card = (typeof CARDS)[number];
export const HAND_SIZE = 3;
export const FREEZE_MS = 2000;
