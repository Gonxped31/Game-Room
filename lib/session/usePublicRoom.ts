"use client";

import { useCallback, useEffect, useEffectEvent, useMemo, useRef, useSyncExternalStore } from "react";
import { createPathStore, emptyStore, serverTimestamp, updateRoot } from "@/lib/store";
import { tryJoinRoom, type MatchGame } from "./shared/findMatch";
import { betterRoom, nextAutoStart, type Queue, QUEUE_REFRESH_MS, queuePath } from "./shared/matchmaking";
import { useDeadline } from "./shared/serverClock";
import { leaveRoomUpdate, queueEntryUpdate, queueRemoveUpdate, room as roomPath } from "./shared/updates";
import type { Session } from "./useSession";
import type { SeatId, WithMultiplayerIdentity } from "./types";

/** How often a player waiting alone looks for another waiting room to join. */
const MERGE_CHECK_MS = 8_000;
/** Marks the history entry `usePublicRoom` adds so Back leaves the room; holds the room code. */
const BACK_ENTRY = "publicRoomBack";

export interface PublicRoom {
  /** This room was made by matchmaking: no host, fixed settings, it starts by itself. */
  isPublic: boolean;
  /** When the game starts by itself (server ms), or null while waiting for players. */
  autoStartAt: number | null;
  /** Gives up this guest's seat and goes back to the hub. */
  leave: () => void;
  /** Gives up this guest's seat, then goes to `href` (Night Highway's "Drive solo"). */
  leaveTo: (href: string) => void;
}

/** What the hook needs from a session: `useSession`'s, or the 1v1 `useGameSession`'s. */
export type PublicRoomSession = Pick<Session<WithMultiplayerIdentity>, "room" | "me" | "uid" | "publicLang" | "onlineSeats" | "joinedSeats" | "names" | "leave">;

/**
 * Runs a public room (docs/matchmaking.md) on every seated device; a no-op
 * in a private room. There's no host and no server, so:
 *
 * - The "keeper" - the lowest online seat - keeps the room's queue entry
 *   fresh while the game is in the lobby with room to spare, takes it out of
 *   the queue otherwise, and keeps `games/{room}/autoStart` in line with
 *   `nextAutoStart`.
 * - Every seated device starts the game when `autoStart` passes (`onStart`
 *   must be a transaction that throws outside the lobby, so only the first
 *   one counts).
 * - A player waiting alone moves to another waiting room (`betterRoom`), so
 *   two people who searched at once end up together.
 */
export function usePublicRoom(opts: {
  session: PublicRoomSession;
  game: MatchGame;
  /** The game is in its lobby (not started, not over). */
  inLobby: boolean;
  /** The game could start with the online players right now (enough of them; even teams for a team game). */
  ready: boolean;
  /** Starts the game with `session.onlineSeats`. */
  onStart: () => void;
  serverNow: () => number;
  /** The browser's Back button leaves the room (default: while `inLobby`). Pass it where "Leave room" shows outside the lobby. */
  leaveOnBack?: boolean;
}): PublicRoom {
  const { session, game, inLobby, ready, onStart, serverNow, leaveOnBack } = opts;
  const { room, me, uid, publicLang: lang, onlineSeats, joinedSeats, names } = session;
  const isPublic = lang != null;
  const active = isPublic && me != null;
  const keeper = active && onlineSeats[0] === me;
  const players = onlineSeats.length;
  const full = players >= game.maxPlayers;
  const listed = inLobby && !full;

  const autoStartStore = useMemo(() => (active ? createPathStore<number>(roomPath(room, "autoStart")) : emptyStore<number>()), [active, room]);
  const autoStartAt = useSyncExternalStore(autoStartStore.subscribe, autoStartStore.getSnapshot, () => null);

  // The queue entry: refreshed while listed, removed once full or under way.
  useEffect(() => {
    if (!keeper || !lang) return;
    const write = () =>
      updateRoot(
        listed ? queueEntryUpdate({ code: room, gameSlug: game.gameSlug, lang, players, ts: serverTimestamp() }) : queueRemoveUpdate({ code: room, gameSlug: game.gameSlug, lang }),
      ).catch(() => {});
    void write();
    if (!listed) return;
    const id = setInterval(write, QUEUE_REFRESH_MS);
    return () => clearInterval(id);
  }, [keeper, listed, players, room, lang, game.gameSlug]);

  // The auto-start deadline, kept by the keeper.
  useEffect(() => {
    if (!keeper) return;
    const want = (current: number | null) => (inLobby ? nextAutoStart({ current, ready, full, now: serverNow() }) : null);
    if (want(autoStartAt) === autoStartAt) return;
    void autoStartStore.transaction((current) => {
      const next = want(current ?? null);
      return next === (current ?? null) ? undefined : (next as number);
    });
  }, [keeper, inLobby, ready, full, autoStartAt, autoStartStore, serverNow]);

  useDeadline(active && inLobby && autoStartAt != null ? autoStartAt : undefined, serverNow, onStart);

  // Alone in the lobby: move to a room with company, if one is waiting.
  const name = me ? names[me] : undefined;
  const moving = useRef(false);
  const alone = active && inLobby && joinedSeats.length === 1 && players === 1;
  useEffect(() => {
    if (!alone || !lang || !uid || !me || !name) return;
    const check = async () => {
      if (moving.current) return;
      const now = serverNow();
      const queue = await createPathStore<Queue>(queuePath(game.gameSlug, lang)).readOnce().catch(() => null);
      const target = betterRoom(queue, { mine: room, now, maxPlayers: game.maxPlayers });
      if (!target || moving.current) return;
      moving.current = true;
      try {
        if (await tryJoinRoom({ code: target, uid, name, lang, game, now })) {
          await updateRoot({ ...leaveRoomUpdate({ code: room, uid, seat: me }), ...queueRemoveUpdate({ code: room, gameSlug: game.gameSlug, lang }) }).catch(() => {});
          // Replaces this entry, so Back from the new room doesn't return to the old one.
          window.location.replace(`#${target}`);
        }
      } finally {
        moving.current = false;
      }
    };
    const id = setInterval(() => void check(), MERGE_CHECK_MS);
    return () => clearInterval(id);
  }, [alone, lang, uid, me, name, room, game, serverNow]);

  // Someone not seated (name entry, watching) has nothing to give up and can't unlist the room.
  const leaveRoom = useCallback(async () => {
    if (active && lang && players <= 1) await updateRoot(queueRemoveUpdate({ code: room, gameSlug: game.gameSlug, lang })).catch(() => {});
    await session.leave();
  }, [active, lang, players, room, game.gameSlug, session]);

  const leaveTo = useCallback(
    (href: string) => {
      void leaveRoom().then(() => {
        window.location.href = href;
      });
    },
    [leaveRoom],
  );
  const leave = useCallback(() => leaveTo("/"), [leaveTo]);

  // Back = "Leave room": one extra history entry keeps Back on this page,
  // which gives up the seat, then goes to the hub (leaving anyway if the
  // write fails: Back was pressed).
  const onBack = useEffectEvent(() => {
    void leaveRoom()
      .catch(() => {})
      .then(() => window.location.replace("/"));
  });
  const backLeaves = active && (leaveOnBack ?? inLobby);
  useEffect(() => {
    if (!backLeaves) return;
    if (window.history.state?.[BACK_ENTRY] !== room) window.history.pushState({ [BACK_ENTRY]: room }, "", window.location.href);
    const onPopState = () => {
      // Back from our entry lands on the one before it, still in this room. A merge's move to another room isn't Back.
      if (window.history.state?.[BACK_ENTRY] !== room && window.location.hash.slice(1) === room) onBack();
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, [backLeaves, room]);

  return { isPublic, autoStartAt: active ? autoStartAt : null, leave, leaveTo };
}

/** The seats a public game starts with: the online ones (a stranger who closed the tab doesn't hold the game up). */
export const startingSeats = (session: { publicLang: string | undefined; onlineSeats: SeatId[]; joinedSeats: SeatId[] }): SeatId[] =>
  session.publicLang ? session.onlineSeats : session.joinedSeats;
