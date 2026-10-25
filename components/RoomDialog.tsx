"use client";

import { type ButtonHTMLAttributes, type ComponentType, type CSSProperties, useEffect, useId, useRef, useState } from "react";
import type { RoomQuestion } from "@/lib/session/shared/roomActions";

type ButtonComponent = ComponentType<ButtonHTMLAttributes<HTMLButtonElement>>;

export interface RoomDialogProps {
  question: RoomQuestion;
  /** Closes the box without doing anything. */
  onCancel: () => void;
  /** The action; the box shows `busyLabel` until it settles. */
  onConfirm: () => unknown;
  /** After the action (even a failed one). Left out where it navigates away (Leave room): the box stays until the page goes. */
  onDone?: () => void;
}

interface RoomDialogLook {
  /** The game's own look: the panel, its title, and its two buttons. */
  className: string;
  style?: CSSProperties;
  titleClassName?: string;
  CancelButton: ButtonComponent;
  ConfirmButton: ButtonComponent;
}

/**
 * A room's question before an action (Leave room, New room, Reset), in place
 * of the browser's confirm(), which shows the site's address and looks like a
 * warning from the browser. Games wrap it in their own look (`ftw/AskDialog`,
 * `cocounsel/AskDialog`). A modal <dialog>, mounted only while asking: it
 * opens on the cancel button (the safe choice, first in the DOM), and Escape
 * or a click on the backdrop cancels too, except while the action runs.
 */
export default function RoomDialog({ question, onCancel, onConfirm, onDone, className, style, titleClassName = "", CancelButton, ConfirmButton }: RoomDialogProps & RoomDialogLook) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const dialog = ref.current;
    dialog?.showModal();
    return () => dialog?.close();
  }, []);

  const cancel = () => {
    if (!busy) onCancel();
  };
  const confirm = async () => {
    setBusy(true);
    await Promise.resolve()
      .then(onConfirm)
      .catch(() => {});
    onDone?.();
  };

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      onCancel={(e) => {
        e.preventDefault();
        cancel();
      }}
      // The backdrop is the <dialog> itself (the panel is its only child, filling it).
      onClick={(e) => {
        if (e.target === e.currentTarget) cancel();
      }}
      className="m-auto w-[min(26rem,calc(100%-2rem))] max-w-none border-0 bg-transparent p-0 opacity-100 transition-opacity duration-150 backdrop:bg-black/40 starting:open:opacity-0 motion-reduce:transition-none"
    >
      <div className={className} style={style}>
        <h2 id={titleId} className={`m-0 ${titleClassName}`}>
          {question.title}
        </h2>
        <p className="m-0 mt-2 leading-relaxed">{question.message}</p>
        <div className="mt-5 grid grid-cols-2 gap-3">
          <CancelButton onClick={cancel} disabled={busy}>
            {question.cancelLabel}
          </CancelButton>
          <ConfirmButton onClick={() => void confirm()} disabled={busy}>
            {busy ? question.busyLabel : question.confirmLabel}
          </ConfirmButton>
        </div>
      </div>
    </dialog>
  );
}
