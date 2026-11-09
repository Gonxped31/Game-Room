import { useState } from "react";
import { texts } from "@/lib/i18n/text";
import { useLang } from "@/lib/i18n/useLang";
import { ROOM_TEXT, type RoomQuestion } from "@/lib/session/shared/roomActions";
import AskDialog from "@/components/ftw/AskDialog";
import LocalLink from "@/components/LocalLink";

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

const TEXT = texts({
  en: {
    room: (room: string) => `Room: ${room}`,
    reset: "Reset game",
    newRoom: "New room",
    leave: "Leave room",
    allGames: "All games",
    resetConfirm: {
      title: "Reset the whole game?",
      message: "Scores and rounds start over. Seats stay as they are.",
      cancelLabel: "Cancel",
      confirmLabel: "Reset game",
      busyLabel: "Resetting…",
    } as RoomQuestion,
  },
  fr: {
    room: (room) => `Salon : ${room}`,
    reset: "Recommencer la partie",
    newRoom: "Nouveau salon",
    leave: "Quitter le salon",
    allGames: "Tous les jeux",
    resetConfirm: {
      title: "Recommencer toute la partie ?",
      message: "Les scores et les manches repartent de zéro. Les places ne changent pas.",
      cancelLabel: "Annuler",
      confirmLabel: "Recommencer",
      busyLabel: "On recommence…",
    },
  },
});

/** Same Page's footer (its questions use Same Page's look). Reset and New room ask first, in the app's own dialog. */
export default function Footer({ room, roomName, identity, onReset, onNewRoom, onLeave }: FooterProps) {
  const lang = useLang();
  const t = TEXT[lang];
  const [asking, setAsking] = useState<"reset" | "newRoom" | null>(null);
  const close = () => setAsking(null);
  return (
    <>
      <p className="mt-5.5 text-center text-[13px] opacity-85">
        {t.room(roomName ? `${roomName} (${room})` : room)}
        {identity ? ` · ${identity}` : null}
        <br />
        {onReset && (
          <>
            <button type="button" onClick={() => setAsking("reset")} className={linkClass}>
              {t.reset}
            </button>{" "}
            ·{" "}
          </>
        )}
        <button type="button" onClick={() => setAsking("newRoom")} className={linkClass}>
          {t.newRoom}
        </button>{" "}
        ·{" "}
        {onLeave ? (
          <button type="button" onClick={onLeave} className={linkClass}>
            {t.leave}
          </button>
        ) : (
          <LocalLink href="/" className={linkClass}>
            {t.allGames}
          </LocalLink>
        )}
      </p>
      {/* Outside the <p> (a <dialog> can't sit in one) and its opacity. */}
      {asking === "reset" && onReset && <AskDialog question={t.resetConfirm} onCancel={close} onConfirm={onReset} onDone={close} />}
      {asking === "newRoom" && <AskDialog question={ROOM_TEXT[lang].newRoomConfirm} onCancel={close} onConfirm={onNewRoom} onDone={close} />}
    </>
  );
}
