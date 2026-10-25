/**
 * The input and output of the invite-loop metrics. Deliberately free of
 * anything Game Room specific (no Firebase paths, no game registry): an
 * adapter turns a platform's data into a `Snapshot`, so the metrics can move
 * to another multiplayer product unchanged. Times are epoch ms.
 */

export interface RoomSnap {
  code: string;
  gameSlug: string;
  createdAt: number;
  /** Refreshed about once a minute while enough players are seated to play; absent if that never happened. */
  lastActive?: number;
  name?: string;
  seatsFilled: number;
  maxPlayers: number;
  /** Guests with a live connection to the room right now. */
  onlineUids: string[];
}

/** One guest's entry for one room: they created it, or joined it from a link. */
export interface GuestRoomSnap {
  code: string;
  gameSlug: string;
  /** When the room first landed on this guest's list. */
  addedAt: number;
  createdByMe: boolean;
}

export interface GuestSnap {
  uid: string;
  rooms: GuestRoomSnap[];
}

export interface Snapshot {
  rooms: RoomSnap[];
  guests: GuestSnap[];
  now: number;
}

/** A share, with what it's a share of, so the UI can say "3 of 40". `rate` is null when nobody qualifies yet. */
export interface Rate {
  count: number;
  of: number;
  rate: number | null;
}

export interface GameStats {
  gameSlug: string;
  liveRooms: number;
  roomsCreated30d: number;
  roomsAllTime: number;
  players30d: number;
  playersAllTime: number;
  /** Rooms that reached a playable game (had `lastActive`) and were active in the last 30 days. */
  playedRooms30d: number;
  /** Estimated play time summed over those rooms. */
  playMs30d: number;
  medianPlayMs30d: number | null;
}

export interface LiveRoom {
  code: string;
  gameSlug: string;
  name?: string;
  seatsFilled: number;
  maxPlayers: number;
  online: number;
  /** "playing" when `lastActive` is fresh, else "waiting" (someone is in the room, but no game is going). */
  status: "playing" | "waiting";
  createdAgoMs: number;
}

export interface DashboardStats {
  generatedAt: number;
  totals: {
    liveRooms: number;
    playingRooms: number;
    onlineGuests: number;
    players30d: number;
    playersAllTime: number;
    roomsCreated30d: number;
    playedRooms30d: number;
    playMs30d: number;
    medianPlayMs30d: number | null;
    /** Guests seen before today who were active on 2+ different days. */
    returning: Rate;
    /** Guests first seen 7+ days ago who came back within 7 days of their first day. */
    returnedWithin7d: Rate;
  };
  perGame: GameStats[];
  liveRooms: LiveRoom[];
}
