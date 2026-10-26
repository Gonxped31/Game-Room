import type { MatchGame } from "@/lib/session/shared/findMatch";
import { newRace as newBorderRun } from "./borderrun/race";
import { PLAYERS, type Mode } from "./race/race";
import { newRace as newGridRace } from "./regions/race";
import { publicGame } from "./buzzerquiz/game";
import { GAME_SLUG as BUZZERQUIZ, MAX_PLAYERS as BUZZERQUIZ_PLAYERS } from "./buzzerquiz/constants";
import { newGame as newRace } from "./nighthighway/game";
import { isLang } from "./shared/language";
import { newGame as newScramble } from "./wordscramble/game";
import { GAME_SLUG as WORDSCRAMBLE, MAX_PLAYERS as WORDSCRAMBLE_PLAYERS } from "./wordscramble/constants";

const NIGHTHIGHWAY = "nighthighway";

/**
 * The games strangers can be matched into ("Matchmaking" on the hub,
 * docs/matchmaking.md), with how a fresh public room of each starts. The
 * rules only accept `meta.publicLang` for these slugs.
 */
export const BUZZERQUIZ_MATCH: MatchGame = {
  gameSlug: BUZZERQUIZ,
  maxPlayers: BUZZERQUIZ_PLAYERS,
  lobbyPhase: "lobby",
  languages: true,
  publicState: (lang) => publicGame(isLang(lang) ? lang : "en"),
};
export const WORDSCRAMBLE_MATCH: MatchGame = {
  gameSlug: WORDSCRAMBLE,
  maxPlayers: WORDSCRAMBLE_PLAYERS,
  lobbyPhase: "lobby",
  languages: true,
  publicState: (lang) => newScramble(isLang(lang) ? lang : "en"),
};
/** A 1v1 race with no words: one queue for everyone, default switches. */
export const NIGHTHIGHWAY_MATCH: MatchGame = { gameSlug: NIGHTHIGHWAY, maxPlayers: 2, lobbyPhase: "LOBBY", languages: false, publicState: () => newRace() };

/**
 * The races (lib/games/race/) queue by mode, not language (Border Run's names
 * show in each player's own language; Checkmate Grid has no words): a public
 * room is a Challenge (4 seats) or a Survival (8), and stays one; changing
 * means leaving and searching the other queue.
 */
const raceMatch = (gameSlug: string, publicState: (mode: Mode) => unknown): Record<Mode, MatchGame> => ({
  challenge: { gameSlug, maxPlayers: PLAYERS.challenge.max, lobbyPhase: "lobby", languages: false, queue: "challenge", publicState: () => publicState("challenge") },
  survival: { gameSlug, maxPlayers: PLAYERS.survival.max, lobbyPhase: "lobby", languages: false, queue: "survival", publicState: () => publicState("survival") },
});
export const BORDERRUN_MATCH = raceMatch("borderrun", newBorderRun);
export const REGIONS_MATCH = raceMatch("regions", newGridRace);

/** Games whose Matchmaking asks for a mode first (registry `modes`): each mode's own queue. */
export const MATCH_MODES: Partial<Record<string, Partial<Record<string, MatchGame>>>> = {
  borderrun: BORDERRUN_MATCH,
  regions: REGIONS_MATCH,
};

export const MATCH_GAMES: Partial<Record<string, MatchGame>> = {
  [BUZZERQUIZ]: BUZZERQUIZ_MATCH,
  [WORDSCRAMBLE]: WORDSCRAMBLE_MATCH,
  [NIGHTHIGHWAY]: NIGHTHIGHWAY_MATCH,
};
