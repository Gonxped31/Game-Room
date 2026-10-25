import { useState } from "react";
import { COLOR } from "@/lib/games/cocounsel/theme";
import { NEW_ROOM_CONFIRM, type RoomQuestion } from "@/lib/session/shared/roomActions";
import AskDialog from "./AskDialog";

interface FooterProps {
  room: string;
  /** User-chosen room name, if any - shown alongside the raw code (still needed to rejoin by code). */
  roomName?: string;
  identity?: string;
  /** Left out where resetting can't work (a closed room): the link is hidden. */
  onReset?: () => unknown;
  onNewRoom: () => unknown;
  /** "Leave room" (gives up the seat). */
  onLeave: () => void;
}

const linkClass = "cursor-pointer border-0 bg-transparent p-0 underline";

const RESET_CONFIRM: RoomQuestion = {
  title: "Reset the whole case?",
  message: "The case starts over from Part 1. Seats stay as they are.",
  cancelLabel: "Cancel",
  confirmLabel: "Reset case",
  busyLabel: "Resetting…",
};

/** Same function as the shared components/Footer.tsx (room, reset, new room, leave room), in Co-Counsel's own palette since the rest of its UI doesn't reuse FTW's visual language. Reset and New room ask first, in the app's own dialog. */
export default function Footer({ room, roomName, identity, onReset, onNewRoom, onLeave }: FooterProps) {
  const [asking, setAsking] = useState<"reset" | "newRoom" | null>(null);
  const close = () => setAsking(null);
  return (
    <>
      <p className="mt-6 px-4 text-center font-[family-name:var(--font-archivo)] text-[13px]" style={{ color: COLOR.text2 }}>
        Room: {roomName ? `${roomName} (${room})` : room}
        {identity ? ` · ${identity}` : null}
        <br />
        {onReset && (
          <>
            <button type="button" onClick={() => setAsking("reset")} className={linkClass} style={{ color: COLOR.text2 }}>
              Reset case
            </button>{" "}
            ·{" "}
          </>
        )}
        <button
          type="button"
          onClick={() => setAsking("newRoom")}
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
      {/* Outside the <p>: a <dialog> can't sit in one. */}
      {asking === "reset" && onReset && <AskDialog question={RESET_CONFIRM} onCancel={close} onConfirm={onReset} onDone={close} />}
      {asking === "newRoom" && <AskDialog question={NEW_ROOM_CONFIRM} onCancel={close} onConfirm={onNewRoom} onDone={close} />}
    </>
  );
}
