// Presence is the same for every room size - keyed by guest ID, with a seat
// online when its holder is (see lib/session/shared/presence.ts).
export { canTakeOver, isSeatOnline, TAKEOVER_AFTER_MS, type RoomPresence as MultiplayerPresence } from "../shared/presence";
