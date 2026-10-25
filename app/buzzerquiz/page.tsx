"use client";

import { type CSSProperties, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSession } from "@/lib/session/useSession";
import { startingSeats, usePublicRoom } from "@/lib/session/usePublicRoom";
import { CONNECTION_ERROR_MESSAGE } from "@/lib/session/shared/auth";
import { leaveToHub, ROOM_MISSING_MESSAGE } from "@/lib/session/shared/roomActions";
import { secondsLeft } from "@/lib/session/shared/deadline";
import { useDeadline, useServerClock, useTicker } from "@/lib/session/shared/serverClock";
import { defaultLang } from "@/lib/games/shared/language";
import { BUZZERQUIZ_MATCH } from "@/lib/games/matchGames";
import { ANSWER_MS, COUNTDOWN_MS, GAME_SLUG, MAX_PLAYERS, MIN_PLAYERS, QUESTION_MS, RESULT_MS } from "@/lib/games/buzzerquiz/constants";
import {
  advance,
  backToSetup,
  buzz,
  choiceOrder,
  dueAt,
  newGame,
  newTopics,
  normalize,
  pick,
  pickQuestions,
  type QuizState,
  ranking,
  rematch,
  reveal,
  setLang,
  setLength,
  start,
  toggleTopic,
  toLobby,
} from "@/lib/games/buzzerquiz/game";
import { getQuestion, QUESTIONS } from "@/lib/games/buzzerquiz/questions";
import InAppBrowserBanner from "@/components/InAppBrowserBanner";
import QuestionScreen, { type QuestionView } from "@/components/buzzerquiz/QuestionScreen";
import { Countdown, Final, InviteCard, Lobby, Message, NameEntry, Setup } from "@/components/buzzerquiz/Screens";
import { THEME, type ScoreRow } from "@/components/buzzerquiz/ui";

const randomSeed = () => Math.floor(Math.random() * 2 ** 31);

/**
 * Buzzer Quiz (references/buzzer-quiz/): 2-4 players race to buzz in on
 * multiple-choice questions. The whole game lives in `games/{room}/buzzerquiz`;
 * every timed step is applied by whichever device sees its deadline pass
 * first (`useDeadline` + the state machine's `advance`).
 */
export default function BuzzerQuizPage() {
  const createInitialState = useCallback((): QuizState => newGame(defaultLang(typeof navigator === "undefined" ? undefined : navigator.languages)), []);
  const session = useSession<QuizState>({ gameSlug: GAME_SLUG, maxPlayers: MAX_PLAYERS, minPlayers: MIN_PLAYERS, createInitialState });
  const { room, me, seats, names, isHost, hostSeat, transact, pickIdentity } = session;
  const raw = session.game;
  const game = useMemo(() => (raw ? normalize(raw) : null), [raw]);
  const serverNow = useServerClock();
  const [watching, setWatching] = useState(false);

  // Timed steps: whoever's device sees the deadline pass applies it.
  useDeadline(game ? dueAt(game) : undefined, serverNow, () => transact((current) => advance(current, serverNow())));

  const timed = game != null && ["countdown", "question", "buzzing", "answering", "result"].includes(game.phase);
  const now = useTicker(timed, serverNow, 100);

  // The countdown's end shows the question on every device at once, even
  // before a device has committed `reveal`.
  const revealed = game?.phase === "countdown" && game.deadline != null && now != null && now >= game.deadline;

  // Reaction time: measured on this device, from when it showed the question
  // (or reopened buzzing after a wrong answer) to the tap.
  const roundKey = game && (game.phase === "question" || revealed) ? `${game.index}:${game.phase === "countdown" ? 0 : game.round}` : null;
  const shownAt = useRef(0);
  useEffect(() => {
    if (roundKey) shownAt.current = performance.now();
  }, [roundKey]);
  const [buzzedRound, setBuzzedRound] = useState<string | null>(null);

  const onBuzz = useCallback(() => {
    if (!me || !roundKey || buzzedRound === roundKey) return;
    const ms = Math.min(QUESTION_MS, Math.max(0, Math.round(performance.now() - shownAt.current)));
    setBuzzedRound(roundKey);
    transact((current) => {
      const t = serverNow();
      const open = current.phase === "countdown" ? reveal(current, t) : current;
      return buzz(open, me, ms, t);
    });
  }, [me, roundKey, buzzedRound, transact, serverNow]);

  const onPick = useCallback((bank: number) => {
    if (me) transact((current) => pick(current, me, bank, serverNow()));
  }, [me, transact, serverNow]);

  useEffect(() => {
    document.title = "Buzzer Quiz";
  }, []);

  const startGame = (fromFinal: boolean) =>
    transact((current) => {
      const g = normalize(current);
      const players = startingSeats(session);
      const opts = { players, questionIds: pickQuestions(QUESTIONS, g.settings, Math.random), seed: randomSeed(), now: serverNow() };
      return fromFinal ? rematch(g, opts) : start(g, opts);
    });

  // A public room (matchmaking): no host; it starts by itself once enough players are online.
  const publicRoom = usePublicRoom({
    session,
    game: BUZZERQUIZ_MATCH,
    inLobby: game?.phase === "lobby",
    ready: session.onlineSeats.length >= MIN_PLAYERS,
    onStart: () => startGame(false),
    serverNow,
  });
  const lobbyNow = useTicker(publicRoom.autoStartAt != null, serverNow, 250);
  const hosting = isHost && !publicRoom.isPublic;
  // Leave room shows only between games (name entry, setup, lobby, final), so it never asks first.
  const leave = publicRoom.isPublic ? publicRoom.leave : () => void leaveToHub(session.leave);

  let screen;
  if (session.connectionError || session.roomMissing) {
    screen = <Message text={session.connectionError ? CONNECTION_ERROR_MESSAGE : ROOM_MISSING_MESSAGE} />;
  } else if (!game) {
    screen = <Message text="Connecting to the room…" />;
  } else if (!me && !watching) {
    const underway = !["setup", "lobby", "final"].includes(game.phase);
    screen = <NameEntry seats={seats} names={names} canTakeOver={session.canTakeOver} onPick={(seat, name) => void pickIdentity(seat, name)} watching={underway || session.allJoined ? () => setWatching(true) : undefined} onLeave={leave} />;
  } else if (game.phase === "setup" && hosting) {
    screen = (
      <Setup
        settings={game.settings}
        onLang={(lang) => transact((s) => setLang(s, lang))}
        onTopic={(topic) => transact((s) => toggleTopic(s, topic))}
        onLength={(length) => transact((s) => setLength(s, length))}
        onContinue={() => transact(toLobby)}
        onLeave={leave}
      />
    );
  } else if (game.phase === "setup" || game.phase === "lobby") {
    screen = (
      <Lobby
        room={room}
        seats={seats}
        names={names}
        me={me}
        hostSeat={publicRoom.isPublic ? null : hostSeat}
        isHost={hosting}
        settings={game.settings}
        inSetup={game.phase === "setup"}
        invite={
          publicRoom.isPublic ? null : (
            <InviteCard room={room} roomName={session.roomName} onRename={session.canRenameRoom ? session.setRoomName : undefined} nameError={session.roomNameError} />
          )
        }
        match={
          publicRoom.isPublic
            ? {
                status:
                  publicRoom.autoStartAt != null && lobbyNow != null
                    ? `Starting in ${Math.max(1, secondsLeft(publicRoom.autoStartAt, lobbyNow))} s`
                    : session.onlineSeats.length < MIN_PLAYERS
                      ? "Waiting for more players…"
                      : "Getting ready…",
                onLeave: publicRoom.leave,
              }
            : undefined
        }
        onEdit={() => transact(backToSetup)}
        onStart={() => startGame(false)}
        onLeave={leave}
      />
    );
  } else {
    const nameOf = (seat: string) => names[seat] ?? "Player";
    const pop = game.phase === "result" && game.outcome?.kind === "right" ? game.outcome : undefined;
    const scores: ScoreRow[] = game.players.map((seat) => ({
      seat,
      name: nameOf(seat),
      score: game.scores[seat] ?? 0,
      isMe: seat === me,
      active: game.phase === "answering" && game.buzzer === seat,
      locked: game.locked.includes(seat),
      pop: pop?.seat === seat ? pop.points : undefined,
    }));
    const question = getQuestion(game.questionIds[game.index] ?? "");

    if (game.phase === "final") {
      screen = (
        <Final
          rows={ranking(game).map((row) => ({ ...row, name: nameOf(row.seat) }))}
          me={me}
          canRematch={me != null && session.enoughJoined}
          isHost={hosting}
          onRematch={() => startGame(true)}
          onNewTopics={() => transact(newTopics)}
          onLeave={leave}
        />
      );
    } else if (game.phase === "countdown" && !revealed) {
      const t = now ?? (game.deadline ?? 0) - COUNTDOWN_MS;
      screen = <Countdown seconds={secondsLeft(game.deadline ?? 0, t)} index={game.index} total={game.questionIds.length} topic={question?.topic} scores={scores} />;
    } else {
      const t = now ?? 0;
      const phase = game.phase === "countdown" ? "question" : (game.phase as QuestionView["phase"]);
      const questionEnd = game.phase === "countdown" ? (game.deadline ?? 0) + QUESTION_MS : game.questionEnd;
      const questionLeftMs = questionEnd != null ? Math.max(0, questionEnd - t) : (game.timeLeft ?? 0);
      const answerLeftMs = game.phase === "answering" && game.deadline != null ? Math.max(0, game.deadline - t) : 0;
      const order = choiceOrder(game.seed, game.index);
      const view: QuestionView = {
        phase,
        index: game.index,
        total: game.questionIds.length,
        topic: question?.topic,
        question: question?.question ?? "",
        choices: order.map((bank) => ({ bank, text: question?.choices[bank] ?? "" })),
        struck: game.struck,
        lastPick: game.lastPick,
        outcome: game.outcome,
        buzzer: game.buzzer,
        locked: game.locked,
        me,
        playing: me != null && game.players.includes(me),
        names,
        scores,
        questionSeconds: Math.ceil(questionLeftMs / 1000),
        questionFraction: questionLeftMs / QUESTION_MS,
        answerSeconds: Math.ceil(answerLeftMs / 1000),
        answerFraction: answerLeftMs / ANSWER_MS,
        nextSeconds: game.phase === "result" && game.deadline != null ? Math.min(RESULT_MS / 1000, Math.max(1, secondsLeft(game.deadline, t))) : 0,
        buzzedHere: roundKey != null && buzzedRound === roundKey,
      };
      screen = <QuestionScreen view={view} onBuzz={onBuzz} onPick={onPick} />;
    }
  }

  return (
    <div style={THEME as CSSProperties} className="min-h-screen bg-[var(--stage)]">
      <InAppBrowserBanner />
      {screen}
    </div>
  );
}
