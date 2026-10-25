import type { MatchGame } from "@/lib/session/shared/findMatch";
import { publicGame } from "./buzzerquiz/game";
import { GAME_SLUG as BUZZERQUIZ, MAX_PLAYERS as BUZZERQUIZ_PLAYERS } from "./buzzerquiz/constants";
import { isLang } from "./shared/language";
import { newGame as newScramble } from "./wordscramble/game";
import { GAME_SLUG as WORDSCRAMBLE, MAX_PLAYERS as WORDSCRAMBLE_PLAYERS } from "./wordscramble/constants";

/**
 * The games strangers can be matched into ("Play online" on the hub,
 * docs/matchmaking.md), with how a fresh public room of each starts. The
 * rules only accept `meta.publicLang` for these slugs.
 */
export const BUZZERQUIZ_MATCH: MatchGame = { gameSlug: BUZZERQUIZ, maxPlayers: BUZZERQUIZ_PLAYERS, publicState: (lang) => publicGame(isLang(lang) ? lang : "en") };
export const WORDSCRAMBLE_MATCH: MatchGame = { gameSlug: WORDSCRAMBLE, maxPlayers: WORDSCRAMBLE_PLAYERS, publicState: (lang) => newScramble(isLang(lang) ? lang : "en") };

export const MATCH_GAMES: Partial<Record<string, MatchGame>> = { [BUZZERQUIZ]: BUZZERQUIZ_MATCH, [WORDSCRAMBLE]: WORDSCRAMBLE_MATCH };
