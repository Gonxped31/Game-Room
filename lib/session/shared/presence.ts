import { createPathStore, serverTimestamp, setOnDisconnect, updateRoot, watchConnection } from "@/lib/store";
import { room, type PresenceEntry } from "./updates";

/**
 * Presence via the Realtime Database's own disconnect detection
 * (`.info/connected` + `onDisconnect`). Keyed by uid (`games/{room}/presence/{uid}`), not by seat, so a
 * device that has since lost its seat can never mark the seat's NEW holder
 * offline when it disconnects.
 */
export type RoomPresence = Partial<Record<string, PresenceEntry>>;

/** How long a seat's holder must have been offline before someone else may take the seat over (the rules check the same 2 minutes). */
export const TAKEOVER_AFTER_MS = 2 * 60_000;

/** A seat is online when whoever holds it has `online: true`. False for an empty seat. */
export function isSeatOnline(presence: RoomPresence | null, seats: Partial<Record<string, string>> | null, seat: string | null): boolean {
  if (!seat) return false;
  const uid = seats?.[seat];
  return Boolean(uid && presence?.[uid]?.online === true);
}

/**
 * Whether a seat held by `holderUid` can be taken over right now: its holder
 * is offline and was last seen over TAKEOVER_AFTER_MS ago. `now: null` (the
 * clock hasn't been read yet) is "no".
 */
export function canTakeOver(presence: RoomPresence | null, holderUid: string | undefined, now: number | null): boolean {
  if (!holderUid || now == null) return false;
  const entry = presence?.[holderUid];
  return entry != null && entry.online === false && now - entry.lastSeen > TAKEOVER_AFTER_MS;
}

/**
 * Marks this guest online in a room while it holds a seat there. Every time
 * the connection comes (back) up: first arm `onDisconnect` to write
 * `online: false` server-side, then write `online: true`. Also re-asserts
 * `online: true` if its own entry flips to false while still connected -
 * another tab of the same guest closing triggers ITS onDisconnect for the
 * very same uid. Returns a cleanup that marks this guest offline (keeping
 * `lastSeen`, which is what a later seat takeover is judged on).
 */
export function startPresence(code: string, uid: string): () => void {
  const path = room(code, `presence/${uid}`);
  const own = createPathStore<PresenceEntry>(path);
  let connected = false;
  let stopped = false;
  let cancelDisconnect: (() => Promise<void>) | undefined;

  const markOnline = () => updateRoot({ [path]: { online: true, lastSeen: serverTimestamp() } }).catch(() => {});

  const stopConnection = watchConnection((isUp) => {
    connected = isUp;
    if (!isUp || stopped) return;
    setOnDisconnect(path, { online: false, lastSeen: serverTimestamp() })
      .then((cancel) => {
        cancelDisconnect = cancel;
        if (!stopped) void markOnline();
      })
      .catch(() => {});
  });

  const stopOwn = own.subscribe(() => {
    if (!stopped && connected && own.getSnapshot()?.online === false) void markOnline();
  });

  return () => {
    stopped = true;
    stopConnection();
    stopOwn();
    void cancelDisconnect?.().catch(() => {});
    updateRoot({ [path]: { online: false, lastSeen: serverTimestamp() } }).catch(() => {});
  };
}
