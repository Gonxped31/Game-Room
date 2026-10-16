import type { FirebaseOptions } from "firebase/app";
import { createFirebaseStore } from "./firebaseStore";
import { createLocalStore } from "./localStore";
import type { Store } from "./types";

const firebaseConfig: FirebaseOptions = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  databaseURL: process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

const hasFirebaseConfig = Object.values(firebaseConfig).every((v) => typeof v === "string" && v.length > 0);

// A silent localStorage fallback produces a very confusing live symptom -
// "I picked a role and the other device never sees it, even after waiting
// and reloading" - that's exactly what happens when two separate browser
// profiles/devices (which can never share localStorage) both silently fall
// back to it. This surfaces that mismatch immediately in the console instead
// of leaving it to be mistaken for a sync bug.
if (typeof window !== "undefined" && !hasFirebaseConfig) {
  console.warn("[first-to-worst] No NEXT_PUBLIC_FIREBASE_* env vars detected - using the localStorage fallback, which only syncs across tabs in the SAME browser profile, never across separate browsers/profiles/devices.");
}

/**
 * Picks the backend for a room's shared game state: Firebase when all
 * NEXT_PUBLIC_FIREBASE_* env vars are set, otherwise the localStorage
 * fallback (so two browser tabs on one machine still work for testing).
 * Generic over any game's state shape - every game on this platform shares
 * this store layer unchanged.
 *
 * The game slug is nested UNDER the room code (`games/{room}/{slug}`, not
 * `games/{slug}/{room}`) so the existing Firebase rule
 * (`games/$roomId: { ".read": true, ".write": true }`) already covers it via
 * RTDB's rule cascade - no console changes needed to add a game. This also
 * keeps two different games started under the same room code (unlikely, but
 * possible if someone edits the URL path while keeping the hash) from
 * clobbering each other's state.
 */
export function createGameStore<T>(room: string, gameSlug: string): Store<T> {
  if (hasFirebaseConfig) {
    return createFirebaseStore<T>(`games/${room}/${gameSlug}`, firebaseConfig);
  }
  return createLocalStore<T>(`game:${gameSlug}:${room}`);
}

/**
 * A room-name -> set-of-room-codes index, used by "join a room by name"
 * (lib/session/roomMeta.ts) - a separate top-level path from `games/`, not
 * nested under any room, so it needs its own Firebase rule (see README's
 * "Database rules" section) rather than riding on the existing
 * `games/$roomId` cascade. Deliberately NOT built on top of
 * `createGameStore` (different path shape, different localStorage key
 * scheme) to avoid touching that already-working function.
 */
export function createRoomNameIndexStore(normalizedName: string): Store<Record<string, true>> {
  if (hasFirebaseConfig) {
    return createFirebaseStore<Record<string, true>>(`roomsByName/${normalizedName}`, firebaseConfig);
  }
  return createLocalStore<Record<string, true>>(`roomsByName:${normalizedName}`);
}

export type { Store } from "./types";
