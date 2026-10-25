import GameTile from "@/components/gameRoom/GameTile";
import HomeScreenTip from "@/components/HomeScreenTip";
import { gameBySlug, roomHref } from "@/lib/games/registry";
import { formatLastActive } from "@/lib/hub/lastActive";
import type { SavedRoom } from "./useSavedRooms";

interface YourRoomsListProps {
  rooms: SavedRoom[];
  /** When the list was loaded - "12 min ago" is computed against this, never the live clock. */
  loadedAt: number;
  /** In the desktop popover the content carries its own heading; the mobile sheet has it in its header. */
  heading?: { id: string } | null;
}

/**
 * "Your rooms" content (references/game-room/game-room-ui-spec.md): one link
 * per room, newest activity first, then the footer note - and, on iPhone
 * Safari outside Home Screen mode, the tip to add Game Room to the Home
 * Screen (Safari wipes a site's storage, and with it this list, after ~7 days
 * without a visit).
 */
export default function YourRoomsList({ rooms, loadedAt, heading }: YourRoomsListProps) {
  return (
    <div className="grid gap-3">
      {heading ? (
        <h2 id={heading.id} className="m-0 font-[family-name:var(--font-fredoka)] text-[17px] font-bold">
          Your rooms
        </h2>
      ) : null}
      <ul className="m-0 grid list-none gap-2 p-0">
        {rooms.map((room) => {
          const game = gameBySlug(room.gameSlug);
          return (
            <li key={room.code}>
              {/* A plain link, not next/link: a full page load, so the game page
                  sees its #code on its very first render (Co-Counsel's
                  creator check depends on it). */}
              <a
                data-autofocus={room === rooms[0] ? true : undefined}
                href={roomHref(room.gameSlug, room.code)}
                className="flex min-h-16 items-center gap-3 rounded-[14px] border-2 border-[#E1E6E7] px-3 py-2.5 text-black no-underline hover:border-[#0F7983] focus-visible:border-[#0F7983] focus-visible:outline-[3px] focus-visible:outline-offset-2 focus-visible:outline-[#0F7983]"
              >
                <GameTile slug={room.gameSlug} />
                <span className="min-w-0 flex-1">
                  <span className="flex min-w-0 items-center gap-2">
                    <span className="truncate font-[family-name:var(--font-fredoka)] text-base font-bold">{room.name || room.code}</span>
                    {room.createdByMe ? (
                      <span className="shrink-0 rounded-full border-[1.5px] border-[#0F7983] px-2 py-px text-xs font-semibold text-[#0F7983]">Yours</span>
                    ) : null}
                  </span>
                  <span className="block truncate text-[13px]" style={{ color: "#4F5B5D" }}>
                    {game?.title ?? room.gameSlug} · {formatLastActive(room.activeAt, loadedAt)}
                  </span>
                </span>
                <svg aria-hidden="true" width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="#0F7983" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
                  <path d="M4 10h12M11 5l5 5-5 5" />
                </svg>
              </a>
            </li>
          );
        })}
      </ul>
      <p className="m-0 text-[13px]" style={{ color: "#5B6668" }}>
        Rooms active in the last 30 days, saved on this device.
      </p>
      <HomeScreenTip />
    </div>
  );
}
