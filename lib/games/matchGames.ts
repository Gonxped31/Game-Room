import type { MatchGame } from "@/lib/session/shared/findMatch";
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

export const MATCH_GAMES: Partial<Record<string, MatchGame>> = {
  [BUZZERQUIZ]: BUZZERQUIZ_MATCH,
  [WORDSCRAMBLE]: WORDSCRAMBLE_MATCH,
  [NIGHTHIGHWAY]: NIGHTHIGHWAY_MATCH,
};
