import Link from "next/link";
import { useState } from "react";
import { NEW_ROOM_CONFIRM, type RoomQuestion } from "@/lib/session/shared/roomActions";
import AskDialog from "@/components/ftw/AskDialog";

interface FooterProps {
  room: string;
  /** User-chosen room name, if any - shown alongside the raw code (still needed to rejoin by code). */
  roomName?: string;
  /** e.g. "Sam · Master", or undefined before a name/role is picked. */
  identity?: string;
  /** Left out where resetting can't work (a closed room): the link is hidden. */
  onReset?: () => unknown;
  onNewRoom: () => unknown;
  /** "Leave room" (gives up the seat). Unset where there's no room to leave (an error, an unknown room) or the seat isn't known yet (connecting): a plain link to the hub. */
  onLeave?: () => void;
}

const linkClass = "cursor-pointer border-0 bg-transparent text-inherit underline";

const RESET_CONFIRM: RoomQuestion = {
  title: "Reset the whole game?",
  message: "Scores and rounds start over. Seats stay as they are.",
  cancelLabel: "Cancel",
  confirmLabel: "Reset game",
  busyLabel: "Resetting…",
};

/** Same Page's footer (its questions use Same Page's look). Reset and New room ask first, in the app's own dialog. */
export default function Footer({ room, roomName, identity, onReset, onNewRoom, onLeave }: FooterProps) {
  const [asking, setAsking] = useState<"reset" | "newRoom" | null>(null);
  const close = () => setAsking(null);
  return (
    <>
      <p className="mt-5.5 text-center text-[13px] opacity-85">
        Room: {roomName ? `${roomName} (${room})` : room}
        {identity ? ` · ${identity}` : null}
        <br />
        {onReset && (
          <>
            <button type="button" onClick={() => setAsking("reset")} className={linkClass}>
              Reset game
            </button>{" "}
            ·{" "}
          </>
        )}
        <button type="button" onClick={() => setAsking("newRoom")} className={linkClass}>
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
      {/* Outside the <p> (a <dialog> can't sit in one) and its opacity. */}
      {asking === "reset" && onReset && <AskDialog question={RESET_CONFIRM} onCancel={close} onConfirm={onReset} onDone={close} />}
      {asking === "newRoom" && <AskDialog question={NEW_ROOM_CONFIRM} onCancel={close} onConfirm={onNewRoom} onDone={close} />}
    </>
  );
}
