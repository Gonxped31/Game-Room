"use client";

import { type ButtonHTMLAttributes, type ComponentType, type CSSProperties, type ReactNode, useEffect, useId, useRef, useState } from "react";

type ButtonComponent = ComponentType<ButtonHTMLAttributes<HTMLButtonElement>>;

/** A game's look for its How to play: the trigger, the panel and its buttons, in the game's own colours and type. */
export interface HowToPlayLook {
  /** The round "?" button (the header's). */
  iconClassName: string;
  /** The text button ("How to play") in a lobby or setup screen. */
  linkClassName: string;
  /** The dialog's panel: background, text colour, font, radius. */
  panelClassName: string;
  panelStyle?: CSSProperties;
  /** The panel's title row (its bottom border too, if any). */
  headerClassName?: string;
  titleClassName?: string;
  /** The × in the title row. */
  closeClassName: string;
  /** "Got it", at the end of the rules: the game's primary button. */
  DoneButton: ButtonComponent;
}

/**
 * "How to play" (docs/how-to-play.md): a button that opens a game's rules in a
 * modal <dialog>. Every game has one (`components/<slug>/Rules.tsx` wraps this
 * with its look and its rules as `children`). It never opens by itself.
 * Escape, the backdrop, × and "Got it" close it; it opens focused on the rules,
 * so they scroll with the keyboard.
 *
 * `variant`: "icon" is the header's round ? button, "link" a text button for a
 * lobby or setup screen (`label`, "How to play" by default).
 */
export default function HowToPlay({
  look,
  variant = "icon",
  label = "How to play",
  title = "How to play",
  children,
}: {
  look: HowToPlayLook;
  variant?: "icon" | "link";
  label?: string;
  title?: string;
  /** The game's rules: its sections, in the order the spec gives. */
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      {variant === "icon" ? (
        <button type="button" aria-label={title} title={title} onClick={() => setOpen(true)} className={look.iconClassName}>
          ?
        </button>
      ) : (
        <button type="button" onClick={() => setOpen(true)} className={look.linkClassName}>
          {label}
        </button>
      )}
      {open ? (
        <RulesDialog look={look} title={title} onClose={() => setOpen(false)}>
          {children}
        </RulesDialog>
      ) : null}
    </>
  );
}

function RulesDialog({ look, title, onClose, children }: { look: HowToPlayLook; title: string; onClose: () => void; children: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  const body = useRef<HTMLDivElement>(null);
  const titleId = useId();
  useEffect(() => {
    const dialog = ref.current;
    dialog?.showModal();
    // showModal focuses the first button (×): focus the rules instead.
    body.current?.focus();
    return () => dialog?.close();
  }, []);
  const { DoneButton } = look;
  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      // The backdrop is the <dialog> itself (the panel is its only child, filling it).
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      className="m-auto max-h-[min(88dvh,820px)] w-[min(40rem,calc(100%-2rem))] max-w-none overflow-hidden rounded-2xl border-0 bg-transparent p-0 backdrop:bg-black/60"
    >
      <div className={`flex max-h-[min(88dvh,820px)] flex-col ${look.panelClassName}`} style={look.panelStyle}>
        <div className={`flex items-center justify-between gap-3 px-5 py-3.5 ${look.headerClassName ?? ""}`}>
          <h2 id={titleId} className={`m-0 ${look.titleClassName ?? ""}`}>
            {title}
          </h2>
          <button type="button" aria-label="Close" onClick={onClose} className={look.closeClassName}>
            ×
          </button>
        </div>
        <div ref={body} tabIndex={-1} className="overflow-y-auto px-5 py-4 outline-none">
          {children}
          <DoneButton className="mt-5" onClick={onClose}>
            Got it
          </DoneButton>
        </div>
      </div>
    </dialog>
  );
}
