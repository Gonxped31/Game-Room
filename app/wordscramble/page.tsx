"use client";

import { type CSSProperties, useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { useSession } from "@/lib/session/useSession";
import { startingSeats, usePublicRoom } from "@/lib/session/usePublicRoom";
import { leaveToHub, roomProblemMessage } from "@/lib/session/shared/roomActions";
import { secondsLeft } from "@/lib/session/shared/deadline";
import { useDeadline, useServerClock, useTicker } from "@/lib/session/shared/serverClock";
import { createPathStore, serverTimestamp } from "@/lib/store";
import { defaultLang, LANG_LABELS } from "@/lib/games/shared/language";
import { WORDSCRAMBLE_MATCH } from "@/lib/games/matchGames";
import { GAME_SLUG, MAX_PLAYERS, MIN_PLAYERS, RESULT_MS, SCOREBOARD_MS, STEAL_MS, STEAL_OFFER_MS, TURN_MS } from "@/lib/games/wordscramble/constants";
import {
  advance,
  canHint,
  claimSteal,
  guess,
  hint,
  newGame,
  type NextWord,
  normalize,
  pickTeam,
  pickWord,
  plain,
  playingTeam,
  scramble,
  type ScrambleState,
  setLang,
  setMode,
  setTarget,
  setTurnsPerTeam,
  shuffle,
  start,
  stealGuess,
  stealValue,
  winner,
  worth,
} from "@/lib/games/wordscramble/game";
import { balanceTeams, members, otherTeam, suggestTeam, type Team } from "@/lib/games/wordscramble/teams";
import { getWord, WORDS } from "@/lib/games/wordscramble/words";
import InAppBrowserBanner from "@/components/InAppBrowserBanner";
import TurnScreen, { type TurnView } from "@/components/wordscramble/TurnScreen";
import { End, GetReady, InviteRow, Lobby, Message, NameEntry, Scoreboard } from "@/components/wordscramble/Screens";
import { seatName, THEME } from "@/components/wordscramble/ui";

const randomSeed = () => Math.floor(Math.random() * 2 ** 31);
/** The word for the turn about to start: the next one after a scoreboard, else the first. */
const drawNext = (game: ScrambleState): NextWord => ({
  wordId: pickWord(WORDS, game, game.phase === "scoreboard" ? game.turn + 1 : 0, Math.random).id,
  seed: randomSeed(),
});

/** How often this device tells its teammates it's typing, and how long "is typing…" lasts. */
const TYPING_EVERY_MS = 2000;
const TYPING_SHOWN_MS = 3000;

type Typing = Partial<Record<string, { at: number }>>;

/**
 * Word Scramble (references/scramble/): two teams take turns unscrambling a
 * word against the clock. The game lives in `games/{room}/wordscramble`;
 * every timed step is applied by whichever device sees its deadline pass
 * first. "Is typing…" goes through `wordscrambleTyping/{seat}`, each seat
 * writing only its own.
 */
export default function WordScramblePage() {
  const createInitialState = useCallback((): ScrambleState => newGame(defaultLang(typeof navigator === "undefined" ? undefined : navigator.languages)), []);
  const session = useSession<ScrambleState>({ gameSlug: GAME_SLUG, maxPlayers: MAX_PLAYERS, minPlayers: MIN_PLAYERS, createInitialState });
  const { room, me, seats, names, isHost, hostSeat, transact, pickIdentity, joinedSeats } = session;
  const raw = session.game;
  const game = useMemo(() => (raw ? normalize(raw) : null), [raw]);
  const serverNow = useServerClock();
  const [watching, setWatching] = useState(false);

  useDeadline(game && game.phase !== "lobby" && game.phase !== "end" ? game.deadline : undefined, serverNow, () =>
    transact((current) => advance(current, serverNow(), drawNext(normalize(current)), getWord(current.wordId)?.word ?? "")),
  );
  const timed = game != null && game.phase !== "lobby" && game.phase !== "end";
  const now = useTicker(timed, serverNow, 200);

  // A newcomer in the lobby joins the smaller team.
  const myTeam = me && game ? game.teams[me] : undefined;
  useEffect(() => {
    if (me && game?.phase === "lobby" && !myTeam) transact((s) => pickTeam(s, me, suggestTeam(normalize(s).teams, joinedSeats)));
  }, [me, game?.phase, myTeam, transact, joinedSeats]);

  // "Is typing…": this seat's signal, and everyone's.
  // Only once the room has loaded: the guest is signed in and the #code is real.
  const loaded = game != null;
  const typingStore = useMemo(() => (loaded ? createPathStore<Typing>(`games/${room}/wordscrambleTyping`) : null), [loaded, room]);
  const subscribeTyping = useCallback((cb: () => void) => typingStore?.subscribe(cb) ?? (() => {}), [typingStore]);
  const typing = useSyncExternalStore(subscribeTyping, () => typingStore?.getSnapshot() ?? null, () => null);
  const lastTyped = useRef(0);
  const onTyping = useCallback(() => {
    if (!me || !room) return;
    const t = Date.now();
    if (t - lastTyped.current < TYPING_EVERY_MS) return;
    lastTyped.current = t;
    void createPathStore<{ at: unknown }>(`games/${room}/wordscrambleTyping/${me}`).set({ at: serverTimestamp() });
  }, [me, room]);

  useEffect(() => {
    document.title = "Word Scramble";
  }, []);

  const word = getWord(game?.wordId);

  const onGuess = useCallback(
    (text: string) => {
      if (!me || !word) return false;
      transact((s) => (s.phase === "stealing" ? stealGuess(s, me, text, word.word, serverNow()) : guess(s, me, text, word.word, serverNow())));
      return plain(text) === plain(word.word);
    },
    [me, word, transact, serverNow],
  );
  const onSteal = useCallback(() => {
    if (me) transact((s) => claimSteal(s, me, serverNow()));
  }, [me, transact, serverNow]);
  const onHint = useCallback(() => {
    if (me && word) transact((s) => hint(s, me, word.word, serverNow()));
  }, [me, word, transact, serverNow]);

  // A public room starts with whoever is online, the teams evened out among them.
  const startGame = () =>
    transact((s) => {
      const current = normalize(s);
      const seated = startingSeats(session);
      const teamed = session.publicLang ? { ...current, teams: balanceTeams(current.teams, seated) } : current;
      return start(teamed, { seated, next: drawNext(current), now: serverNow() });
    });

  // A public room (matchmaking): no host; it starts by itself once an even number of players (2+) is online.
  const online = session.onlineSeats.length;
  const publicRoom = usePublicRoom({
    session,
    game: WORDSCRAMBLE_MATCH,
    inLobby: game?.phase === "lobby",
    ready: online >= MIN_PLAYERS && online % 2 === 0,
    onStart: startGame,
    serverNow,
  });
  const lobbyNow = useTicker(publicRoom.autoStartAt != null, serverNow, 250);
  // Leave room shows only between games (name entry, lobby, end), so it never asks first.
  const leave = publicRoom.isPublic ? publicRoom.leave : () => void leaveToHub(session.leave);

  let screen;
  const problem = roomProblemMessage(session);
  if (problem) {
    screen = <Message text={problem} />;
  } else if (!game) {
    screen = <Message text="Connecting to the room…" />;
  } else if (!me && !watching) {
    const underway = game.phase !== "lobby" && game.phase !== "end";
    screen = <NameEntry seats={seats} names={names} canTakeOver={session.canTakeOver} onPick={(seat, name) => void pickIdentity(seat, name)} watching={underway || session.allJoined ? () => setWatching(true) : undefined} onLeave={leave} />;
  } else {
    const teamNames: Record<Team, string[]> = {
      A: members(game.teams, joinedSeats, "A").map((s) => seatName(names, s)),
      B: members(game.teams, joinedSeats, "B").map((s) => seatName(names, s)),
    };
    const total = game.settings.mode === "turns" ? game.settings.turnsPerTeam * 2 : null;
    const turnLabel = total ? `Turn ${game.turn + 1} of ${total}` : `Turn ${game.turn + 1} · first to ${game.settings.target}`;
    const words = (id: string) => getWord(id)?.word ?? "";
    const t = now ?? 0;

    if (game.phase === "lobby") {
      screen = (
        <Lobby
          room={room}
          seats={seats}
          joined={joinedSeats}
          names={names}
          teams={game.teams}
          me={me}
          hostSeat={publicRoom.isPublic ? null : hostSeat}
          isHost={isHost && !publicRoom.isPublic}
          settings={game.settings}
          invite={
            publicRoom.isPublic ? null : <InviteRow room={room} roomName={session.roomName} onRename={session.canRenameRoom ? session.setRoomName : undefined} nameError={session.roomNameError} />
          }
          match={
            publicRoom.isPublic
              ? {
                  status:
                    publicRoom.autoStartAt != null && lobbyNow != null
                      ? `Starting in ${Math.max(1, secondsLeft(publicRoom.autoStartAt, lobbyNow))} s`
                      : online < MIN_PLAYERS
                        ? "Waiting for more players…"
                        : online % 2 === 1
                          ? "Waiting for one more player to even the teams…"
                          : "Getting ready…",
                  onLeave: publicRoom.leave,
                }
              : undefined
          }
          onPickTeam={(team) => me && transact((s) => pickTeam(s, me, team))}
          onSettings={{
            lang: (lang) => transact((s) => setLang(s, lang)),
            mode: (mode) => transact((s) => setMode(s, mode)),
            turns: (n) => transact((s) => setTurnsPerTeam(s, n)),
            target: (n) => transact((s) => setTarget(s, n)),
          }}
          onStart={startGame}
          onLeave={leave}
        />
      );
    } else if (game.phase === "end") {
      const found = { A: game.history.filter((h) => h.team === "A" && h.points > 0).length, B: game.history.filter((h) => h.team === "B" && h.points > 0).length };
      screen = (
        <End
          winner={winner(game)}
          scores={game.scores}
          teamNames={teamNames}
          found={found}
          summary={`${game.turn + 1} turns · ${LANG_LABELS[game.settings.lang]}`}
          canRematch={me != null && session.enoughJoined}
          onRematch={startGame}
          onShuffle={() => transact((s) => shuffle(s, joinedSeats, Math.random))}
          onLeave={leave}
        />
      );
    } else if (game.phase === "scoreboard") {
      const left = secondsLeft(game.deadline ?? 0, t);
      screen = (
        <Scoreboard
          turn={game.turn}
          total={total}
          totalLabel={turnLabel}
          scores={game.scores}
          teamNames={teamNames}
          history={game.history}
          words={words}
          nextTeam={otherTeam(playingTeam(game.turn))}
          seconds={Math.min(SCOREBOARD_MS / 1000, Math.max(1, left))}
          fraction={Math.max(0, (game.deadline ?? 0) - t) / SCOREBOARD_MS}
        />
      );
    } else if (game.phase === "turn" && game.startAt != null && now != null && now < game.startAt) {
      const team = playingTeam(game.turn);
      screen = <GetReady team={team} seconds={Math.max(1, secondsLeft(game.startAt, now))} mine={myTeam === team} />;
    } else if (word) {
      const team = playingTeam(game.turn);
      const answer = [...plain(word.word)];
      const typingNames = Object.entries(typing ?? {})
        .filter(([seat, v]) => seat !== me && game.teams[seat] === team && v && t - v.at < TYPING_SHOWN_MS)
        .map(([seat]) => seatName(names, seat));
      const leftMs = game.phase === "result" ? 0 : Math.max(0, (game.deadline ?? 0) - t);
      const phaseMs = game.phase === "stealOffer" ? STEAL_OFFER_MS : game.phase === "stealing" ? STEAL_MS : TURN_MS;
      const points = game.phase === "result" ? game.history.at(-1)?.points ?? 0 : worth(word.word, game.hints);
      const view: TurnView = {
        phase: game.phase === "result" || game.phase === "stealOffer" || game.phase === "stealing" ? game.phase : "turn",
        team,
        playing: myTeam === team,
        myTeam,
        teamNames: teamNames[team],
        turnLabel,
        scores: game.scores,
        scrambled: scramble(word.word, game.seed),
        answer,
        word: word.word,
        hints: game.hints,
        worth: worth(word.word, game.hints),
        canHint: canHint(word.word, game.hints),
        guesses: game.guesses.map((g) => ({ name: seatName(names, g.seat), text: g.text })),
        typing: typingNames,
        found: game.found ? { name: seatName(names, game.found.seat), seconds: Math.round(game.found.ms / 1000), points } : undefined,
        seconds: Math.ceil(leftMs / 1000),
        fraction: leftMs / phaseMs,
        nextTeam: otherTeam(team),
        nextSeconds: game.phase === "result" ? Math.min(RESULT_MS / 1000, Math.max(1, secondsLeft(game.deadline ?? 0, t))) : 0,
        stealValue: stealValue(word.word, game.hints),
        stealerName: game.stealer ? seatName(names, game.stealer) : undefined,
        isStealer: me != null && game.stealer === me,
        stolen: game.stolen ? { name: seatName(names, game.stolen.seat), points: game.stolen.points } : undefined,
        pointsLine: `+${points} Team ${team} · ${answer.length} letters${game.hints ? ` − ${game.hints} hint${game.hints > 1 ? "s" : ""}` : ""}`,
      };
      screen = <TurnScreen view={view} onGuess={onGuess} onHint={onHint} onTyping={onTyping} onSteal={onSteal} />;
    } else {
      screen = <Message text="Loading the word…" />;
    }
  }

  return (
    <div style={THEME as CSSProperties} className="min-h-screen bg-[var(--table)]">
      <InAppBrowserBanner />
      {screen}
    </div>
  );
}
