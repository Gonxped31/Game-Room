import type { GameState } from "@/lib/game";
import { createLocalStore } from "./localStore";
import type { Store } from "./types";

/**
 * Picks the backend for a room's game state. Firebase support (used when
 * NEXT_PUBLIC_FIREBASE_* env vars are set) lands in Stage 3 - for now this
 * always returns the localStorage implementation.
 */
export function createGameStore(room: string): Store<GameState> {
  return createLocalStore<GameState>(`ftw:${room}`);
}

export type { Store } from "./types";
