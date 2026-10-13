import type { FirebaseOptions } from "firebase/app";
import type { GameState } from "@/lib/game";
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

/**
 * Picks the backend for a room's shared game state: Firebase when all
 * NEXT_PUBLIC_FIREBASE_* env vars are set, otherwise the localStorage
 * fallback (so two browser tabs on one machine still work for testing).
 */
export function createGameStore(room: string): Store<GameState> {
  if (hasFirebaseConfig) {
    return createFirebaseStore<GameState>(`games/${room}`, firebaseConfig);
  }
  return createLocalStore<GameState>(`ftw:${room}`);
}

export type { Store } from "./types";
