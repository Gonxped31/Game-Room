import { COLOR } from "@/lib/games/cocounsel/theme";

interface FooterProps {
  room: string;
  /** User-chosen room name, if any - shown alongside the raw code (still needed to rejoin by code). */
  roomName?: string;
  identity?: string;
  /** Left out where resetting can't work (a closed room): the link is hidden. */
  onReset?: () => void;
  onNewRoom: () => void;
  /** "Leave room" (gives up the seat). */
  onLeave: () => void;
}

const linkClass = "cursor-pointer border-0 bg-transparent p-0 underline";

/** Same function as the shared components/Footer.tsx (room, reset, new room, leave room), in Co-Counsel's own palette since the rest of its UI doesn't reuse FTW's visual language. */
export default function Footer({ room, roomName, identity, onReset, onNewRoom, onLeave }: FooterProps) {
  return (
    <p className="mt-6 px-4 text-center font-[family-name:var(--font-archivo)] text-[13px]" style={{ color: COLOR.text2 }}>
      Room: {roomName ? `${roomName} (${room})` : room}
      {identity ? ` · ${identity}` : null}
      <br />
      {onReset && (
        <>
          <button type="button" onClick={() => confirm("Reset the whole case?") && onReset()} className={linkClass} style={{ color: COLOR.text2 }}>
            Reset case
          </button>{" "}
          ·{" "}
        </>
      )}
      <button
        type="button"
        onClick={() => confirm("Leave this room and start a brand new one?") && onNewRoom()}
        className={linkClass}
        style={{ color: COLOR.text2 }}
      >
        New room
      </button>{" "}
      ·{" "}
      <button type="button" onClick={onLeave} className={linkClass} style={{ color: COLOR.text2 }}>
        Leave room
      </button>
    </p>
  );
}
