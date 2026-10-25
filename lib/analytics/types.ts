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
  /** Minutes a game was in progress, counted once a minute; absent for rooms from before the counter existed. */
  activeMinutes?: number;
  name?: string;
  seatsFilled: number;
  maxPlayers: number;
  /** Guests with a live connection to the room right now. */
  onlineUids: string[];
  /** Set when the owner closed the room: it still counts in history, never as live. */
  closedAt?: number;
  /** Filled by matchmaking with strangers, not by invites: left out of the invite loop. */
  matchmade?: boolean;
  /** The room itself was deleted; this is the summary kept for history. */
  deleted?: boolean;
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
  /** Times the guest was in a room, at most one a day; counts toward the days they were active. */
  visits?: number[];
}

export interface Snapshot {
  rooms: RoomSnap[];
  guests: GuestSnap[];
  now: number;
  /**
   * The owner cleared the stats at this time: history counts only rooms
   * created, and guest activity, from then on. Live rooms and the room list
   * are unaffected.
   */
  statsSince?: number;
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
  /** Play time summed over those rooms (counted minutes, else the estimate). */
  playMs30d: number;
  medianPlayMs30d: number | null;
}

/** How invites grow the player base, over private rooms (last 30 days). */
export interface InviteLoop {
  /** Rooms created in the window where at least one other guest took a seat. */
  converted: Rate;
  /** Distinct guests who joined those rooms from a link. */
  invitedGuests: number;
  /** Distinct guests who created those rooms. */
  creators: number;
  /** Guests whose first room was one they were invited to (in the window) who later created a room of their own. */
  loop: Rate;
}

/**
 * - playing: someone is online and the game moved in the last 2 minutes;
 * - waiting: someone is online, but no game is going;
 * - idle: nobody is online;
 * - closed: the owner closed it.
 */
export type RoomStatus = "playing" | "waiting" | "idle" | "closed";

/** One room in the dashboard's room list. Deleted rooms aren't listed. */
export interface RoomRow {
  code: string;
  gameSlug: string;
  name?: string;
  /** Seats taken: the people in the room, online or not. */
  seatsFilled: number;
  maxPlayers: number;
  online: number;
  status: RoomStatus;
  createdAgoMs: number;
  /** Since the game last moved; absent if it never reached a playable game. */
  lastActiveAgoMs?: number;
  closedAgoMs?: number;
}

export interface DashboardStats {
  generatedAt: number;
  /** When the stats were last cleared; "all time" numbers count from here. */
  statsSince?: number;
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
    /** Of `playedRooms30d`, those without counted minutes, whose play time is estimated. */
    estimatedPlayRooms30d: number;
    /** Guests seen before today who were active (joined a room, or came back to one) on 2+ different days. */
    returning: Rate;
    /** Guests first seen 7+ days ago who came back within 7 days of their first day. */
    returnedWithin7d: Rate;
  };
  perGame: GameStats[];
  inviteLoop: InviteLoop;
  /** Every room that still exists: live ones first (playing, then waiting), then idle, then closed; most recent first within each. */
  rooms: RoomRow[];
}
