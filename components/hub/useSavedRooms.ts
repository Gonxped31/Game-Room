"use client";

import { useEffect, useState } from "react";
import { createPathStore, updateRoot } from "@/lib/store";
import { useGuestAuth } from "@/lib/session/shared/auth";
import { readRoomMeta } from "@/lib/session/shared/roomActions";
import type { UserRoomEntry } from "@/lib/session/shared/updates";

/** Rooms not active for this long drop off the list (they stay in the guest's data). */
const SHOW_ACTIVE_WITHIN_MS = 30 * 24 * 60 * 60 * 1000;

export interface SavedRoom {
  code: string;
  gameSlug: string;
  name?: string;
  createdByMe: boolean;
  /** When the room was last active (epoch ms): `lastActive`, else when it was created. */
  activeAt: number;
}

/**
 * Loads this guest's room list (`users/{uid}/rooms`), newest activity first,
 * keeping rooms active in the last 30 days. Each room's live meta and
 * `lastActive` are read alongside its entry. A room whose meta is gone
 * (cleaned up) is dropped from the list - and removed from the guest's data -
 * silently. A room that merely couldn't be read right now (offline) is skipped
 * this time, never removed.
 */
async function loadRooms(uid: string, now: number): Promise<SavedRoom[]> {
  const entries = (await createPathStore<Record<string, UserRoomEntry>>(`users/${uid}/rooms`).readOnce()) ?? {};
  const rows = await Promise.all(
    Object.entries(entries).map(async ([code, entry]): Promise<SavedRoom | null> => {
      try {
        const [meta, lastActive] = await Promise.all([readRoomMeta(code), createPathStore<number>(`games/${code}/lastActive`).readOnce()]);
        if (!meta) {
          updateRoot({ [`users/${uid}/rooms/${code}`]: null }).catch(() => {});
          return null;
        }
        return {
          code,
          gameSlug: meta.gameSlug,
          name: meta.name,
          createdByMe: Boolean(entry.createdByMe),
          activeAt: lastActive ?? meta.createdAt ?? entry.addedAt,
        };
      } catch {
        return null;
      }
    }),
  );
  return rows
    .filter((row): row is SavedRoom => row != null && now - row.activeAt <= SHOW_ACTIVE_WITHIN_MS)
    .sort((a, b) => b.activeAt - a.activeAt);
}

/**
 * The guest's saved rooms for the hub's Continue chip and "Your rooms", plus
 * the moment they were loaded (`loadedAt`) - "12 min ago" labels are computed
 * against that, so render never reads the clock. Empty until loaded.
 */
export function useSavedRooms(): { rooms: SavedRoom[]; loadedAt: number } {
  const auth = useGuestAuth();
  const uid = auth.status === "ready" ? auth.uid : null;
  const [state, setState] = useState<{ rooms: SavedRoom[]; loadedAt: number }>({ rooms: [], loadedAt: 0 });

  useEffect(() => {
    if (!uid) return;
    let cancelled = false;
    const now = Date.now();
    loadRooms(uid, now)
      .then((rooms) => {
        if (!cancelled) setState({ rooms, loadedAt: now });
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [uid]);

  return state;
}
