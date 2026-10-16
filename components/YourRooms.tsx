"use client";

import { useEffect, useState } from "react";
import { GAMES } from "@/lib/games/registry";
import { createPathStore, updateRoot } from "@/lib/store";
import { useGuestAuth } from "@/lib/session/shared/auth";
import { readRoomMeta } from "@/lib/session/shared/roomActions";
import type { UserRoomEntry } from "@/lib/session/shared/updates";
import HomeScreenTip from "./HomeScreenTip";

/** Rooms not active for this long drop off the list (they stay in the guest's data). */
const SHOW_ACTIVE_WITHIN_MS = 30 * 24 * 60 * 60 * 1000;

interface RoomRow {
  code: string;
  gameSlug: string;
  name?: string;
  createdByMe: boolean;
  activeAt: number;
}

function gameTitle(slug: string): string {
  return GAMES.find((g) => g.slug === slug)?.title ?? slug;
}

/**
 * Loads this guest's room list (`users/{uid}/rooms`), newest activity first.
 * Each room's live meta and `lastActive` are read alongside its entry: a room
 * whose meta is gone (cleaned up) is dropped from the list - and removed from
 * the guest's data - silently. A room that merely couldn't be read right now
 * (offline) is skipped this time, never removed.
 */
async function loadRooms(uid: string, now: number): Promise<RoomRow[]> {
  const entries = (await createPathStore<Record<string, UserRoomEntry>>(`users/${uid}/rooms`).readOnce()) ?? {};
  const rows = await Promise.all(
    Object.entries(entries).map(async ([code, entry]): Promise<RoomRow | null> => {
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
    .filter((row): row is RoomRow => row != null && now - row.activeAt <= SHOW_ACTIVE_WITHIN_MS)
    .sort((a, b) => b.activeAt - a.activeAt);
}

/**
 * "Your rooms" on the hub: every room this guest created or joined, so it
 * can jump back in without the link. Hidden while empty. Deliberately
 * simple - a designed version comes later.
 */
export default function YourRooms() {
  const auth = useGuestAuth();
  const uid = auth.status === "ready" ? auth.uid : null;
  const [rooms, setRooms] = useState<RoomRow[]>([]);

  useEffect(() => {
    if (!uid) return;
    let cancelled = false;
    loadRooms(uid, Date.now())
      .then((rows) => {
        if (!cancelled) setRooms(rows);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [uid]);

  if (rooms.length === 0) return null;

  return (
    <>
      <section
        aria-labelledby="your-rooms-heading"
        className="mt-5 grid gap-2.5 rounded-[18px] bg-white p-4 text-black shadow-[0_4px_0_rgba(0,0,0,.22)] min-[760px]:mx-auto min-[760px]:w-[520px] min-[760px]:p-[18px]"
      >
        <h2 id="your-rooms-heading" className="m-0 font-[family-name:var(--font-fredoka)] text-[17px] font-bold">
          Your rooms
        </h2>
        <ul className="m-0 grid list-none gap-2 p-0">
          {rooms.map((room) => (
            <li key={room.code}>
              {/* A plain link, not next/link: a full page load, so the game page
                  sees its #code on its very first render (Co-Counsel's
                  creator detection depends on it - see JoinRoomForm). */}
              <a
                href={`/${room.gameSlug}#${room.code}`}
                className="flex items-center justify-between gap-3 rounded-xl border-2 border-[#E1E7E8] px-3.5 py-2.5 text-black no-underline hover:border-[#0F7983] focus-visible:border-[#0F7983]"
              >
                <span className="min-w-0">
                  <span className="block truncate font-[family-name:var(--font-fredoka)] text-base font-semibold">{room.name || room.code}</span>
                  <span className="block text-[13px]" style={{ color: "#444444" }}>
                    {gameTitle(room.gameSlug)}
                    {room.createdByMe ? " · Created by you" : ""}
                  </span>
                </span>
                <span aria-hidden="true" className="shrink-0 font-bold text-[#0F7983]">
                  →
                </span>
              </a>
            </li>
          ))}
        </ul>
      </section>
      <HomeScreenTip />
    </>
  );
}
