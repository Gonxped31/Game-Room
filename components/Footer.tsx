import Link from "next/link";

interface FooterProps {
  room: string;
  /** User-chosen room name, if any - shown alongside the raw code (still needed to rejoin by code). */
  roomName?: string;
  /** e.g. "Sam · Master", or undefined before a name/role is picked. */
  identity?: string;
  /** Left out where resetting can't work (a closed room): the link is hidden. */
  onReset?: () => void;
  onNewRoom: () => void;
  /** "Leave room" (gives up the seat). Unset where there's no room to leave (an error, an unknown room) or the seat isn't known yet (connecting): a plain link to the hub. */
  onLeave?: () => void;
}

const linkClass = "cursor-pointer border-0 bg-transparent text-inherit underline";

export default function Footer({ room, roomName, identity, onReset, onNewRoom, onLeave }: FooterProps) {
  return (
    <p className="mt-5.5 text-center text-[13px] opacity-85">
      Room: {roomName ? `${roomName} (${room})` : room}
      {identity ? ` · ${identity}` : null}
      <br />
      {onReset && (
        <>
          <button type="button" onClick={() => confirm("Reset the whole game?") && onReset()} className={linkClass}>
            Reset game
          </button>{" "}
          ·{" "}
        </>
      )}
      <button
        type="button"
        onClick={() => confirm("Leave this room and start a brand new one?") && onNewRoom()}
        className={linkClass}
      >
        New room
      </button>{" "}
      ·{" "}
      {onLeave ? (
        <button type="button" onClick={onLeave} className={linkClass}>
          Leave room
        </button>
      ) : (
        <Link href="/" className={linkClass}>
          All games
        </Link>
      )}
    </p>
  );
}
