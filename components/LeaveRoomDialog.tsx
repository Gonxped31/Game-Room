"use client";

import { type ButtonHTMLAttributes, type ComponentType, type CSSProperties, useEffect, useId, useRef, useState } from "react";
import { LEAVE_CONFIRM } from "@/lib/session/shared/roomActions";

type ButtonComponent = ComponentType<ButtonHTMLAttributes<HTMLButtonElement>>;

interface LeaveRoomDialogProps {
  /** Closes the box: the player stays seated. */
  onStay: () => void;
  /** Gives up the seat and goes to the hub (`leaveToHub`). */
  onLeave: () => Promise<void>;
  /** The game's own look: the panel, its title, and its two buttons. */
  className: string;
  style?: CSSProperties;
  titleClassName?: string;
  StayButton: ButtonComponent;
  LeaveButton: ButtonComponent;
}

/**
 * "Leave room"'s question in a private room mid-game, in place of the
 * browser's confirm(), which shows the site's address and looks like a
 * warning from the browser. A modal <dialog>, mounted only while asking: it
 * opens on Stay (the safe choice, first in the DOM), and Escape or a click
 * on the backdrop stays too, except while leaving.
 */
export default function LeaveRoomDialog({ onStay, onLeave, className, style, titleClassName = "", StayButton, LeaveButton }: LeaveRoomDialogProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    const dialog = ref.current;
    dialog?.showModal();
    return () => dialog?.close();
  }, []);

  const stay = () => {
    if (!leaving) onStay();
  };
  const leave = () => {
    setLeaving(true);
    void onLeave();
  };

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      onCancel={(e) => {
        e.preventDefault();
        stay();
      }}
      // The backdrop is the <dialog> itself (the panel is its only child, filling it).
      onClick={(e) => {
        if (e.target === e.currentTarget) stay();
      }}
      className="m-auto w-[min(26rem,calc(100%-2rem))] max-w-none border-0 bg-transparent p-0 opacity-100 transition-opacity duration-150 backdrop:bg-black/40 starting:open:opacity-0 motion-reduce:transition-none"
    >
      <div className={className} style={style}>
        <h2 id={titleId} className={`m-0 ${titleClassName}`}>
          {LEAVE_CONFIRM.title}
        </h2>
        <p className="m-0 mt-2 leading-relaxed">{LEAVE_CONFIRM.message}</p>
        <div className="mt-5 grid grid-cols-2 gap-3">
          <StayButton onClick={stay} disabled={leaving}>
            Stay
          </StayButton>
          <LeaveButton onClick={leave} disabled={leaving}>
            {leaving ? "Leaving…" : "Leave room"}
          </LeaveButton>
        </div>
      </div>
    </dialog>
  );
}
