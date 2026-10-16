"use client";

import { type ReactNode, useEffect, useLayoutEffect, useRef } from "react";

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])';
const POPOVER_WIDTH = 420;
const VIEWPORT_MARGIN = 16;
const CARET_GAP = 12;

export type OverlayPlacement = "above-center" | "below-right";

interface HubOverlayProps {
  /** The button that opened it: the popover anchors to it, and focus returns to it on close. */
  anchor: HTMLElement | null;
  /** Desktop (760px and up): an anchored popover. Mobile: a bottom sheet over a scrim. */
  desktop: boolean;
  /** "above-center" for a card's Join button, "below-right" for the Your rooms button. */
  placement: OverlayPlacement;
  /** The sheet's header title. In the popover, the content shows its own heading. */
  title: string;
  /** id of the element naming the dialog (the sheet title, or the content's own heading in the popover). */
  labelledBy: string;
  /**
   * Tallest the mobile sheet may grow (its content scrolls beyond that).
   * The rooms list is capped at 75% of the screen per spec; the join form
   * gets more room so its button never sits flush against the bottom.
   */
  sheetMaxHeightClass?: string;
  onClose: () => void;
  children: ReactNode;
}

/**
 * The hub's one overlay (references/game-room/game-room-ui-spec.md, "Desktop
 * popover" / "Mobile sheet"). Only one is ever open; the parent renders it
 * conditionally. On open, focus goes to the content's `[data-autofocus]`
 * element (else the first focusable one) and returns to `anchor` on close.
 */
export default function HubOverlay(props: HubOverlayProps) {
  const { anchor } = props;

  // Return focus to the opening button however the overlay closes.
  useEffect(() => () => anchor?.focus(), [anchor]);

  return props.desktop ? <Popover {...props} /> : <Sheet {...props} />;
}

function focusInitial(container: HTMLElement | null) {
  const target = container?.querySelector<HTMLElement>("[data-autofocus]") ?? container?.querySelector<HTMLElement>(FOCUSABLE);
  target?.focus();
}

function Popover({ anchor, placement, labelledBy, onClose, children }: HubOverlayProps) {
  const ref = useRef<HTMLDivElement>(null);

  // Position against the anchor: above it and centered (caret down), or below
  // it with right edges aligned (caret up). Written straight to the element's
  // style (no React state), and kept in place on scroll and resize.
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || !anchor) return;
    const place = () => {
      const a = anchor.getBoundingClientRect();
      const width = Math.min(POPOVER_WIDTH, window.innerWidth - 2 * VIEWPORT_MARGIN);
      const preferredLeft = placement === "above-center" ? a.left + a.width / 2 - width / 2 : a.right - width;
      const left = Math.max(VIEWPORT_MARGIN, Math.min(preferredLeft, window.innerWidth - VIEWPORT_MARGIN - width));
      const top = placement === "above-center" ? a.top - CARET_GAP - el.offsetHeight : a.bottom + CARET_GAP;
      el.style.width = `${width}px`;
      el.style.left = `${left}px`;
      el.style.top = `${top}px`;
      el.style.setProperty("--caret-x", `${a.left + a.width / 2 - left}px`);
    };
    place();
    // Its own size matters too: opening above the anchor, it must grow upward
    // (e.g. when the not-found error line appears) to stay attached.
    const resizeObserver = new ResizeObserver(place);
    resizeObserver.observe(el);
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      resizeObserver.disconnect();
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [anchor, placement]);

  useEffect(() => {
    focusInitial(ref.current);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    // A press outside closes it - except on the anchor, whose own click
    // toggles it closed (so it doesn't close and immediately reopen).
    const onPointerDown = (e: PointerEvent) => {
      const target = e.target as Node;
      if (ref.current?.contains(target) || anchor?.contains(target)) return;
      onClose();
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onPointerDown);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onPointerDown);
    };
  }, [anchor, onClose]);

  const caretDown = placement === "above-center";
  return (
    <div
      ref={ref}
      role="dialog"
      aria-labelledby={labelledBy}
      className="hub-popover-in fixed z-50 rounded-[18px] border-2 border-black bg-white p-[18px] text-black shadow-[0_4px_0_#000,0_18px_40px_rgba(0,0,0,.35)]"
      style={{ top: -9999, left: -9999 }}
    >
      {/* The caret: a bordered square turned 45 degrees, half tucked behind the panel's edge. */}
      <span
        aria-hidden="true"
        className={`absolute h-4 w-4 rotate-45 border-black bg-white ${caretDown ? "-bottom-[9px] border-b-2 border-r-2" : "-top-[9px] border-l-2 border-t-2"}`}
        style={{ left: "calc(var(--caret-x, 50%) - 8px)" }}
      />
      {children}
    </div>
  );
}

// The sheet's back-gesture entry is shared across mounts, so React's dev-mode
// double mount (mount, unmount, mount) doesn't push two history entries or pop
// the one the remount needs.
let openSheets = 0;

function Sheet({ title, labelledBy, sheetMaxHeightClass = "max-h-[90vh]", onClose, children }: HubOverlayProps) {
  const ref = useRef<HTMLDivElement>(null);
  const dragStartY = useRef<number | null>(null);

  useEffect(() => {
    focusInitial(ref.current);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
        return;
      }
      // Trap Tab inside the sheet (it's modal).
      if (e.key !== "Tab" || !ref.current) return;
      const items = Array.from(ref.current.querySelectorAll<HTMLElement>(FOCUSABLE));
      if (!items.length) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previousOverflow;
    };
  }, [onClose]);

  // The back gesture closes the sheet: opening it pushes a history entry, and
  // going back past that entry closes it. Closing it any other way pops the
  // entry again, so Back doesn't then do nothing.
  useEffect(() => {
    openSheets += 1;
    if (!window.history.state?.hubSheet) window.history.pushState({ ...window.history.state, hubSheet: true }, "");
    const onPopState = () => {
      if (!window.history.state?.hubSheet) onClose();
    };
    window.addEventListener("popstate", onPopState);
    return () => {
      openSheets -= 1;
      window.removeEventListener("popstate", onPopState);
      setTimeout(() => {
        if (openSheets === 0 && window.history.state?.hubSheet) window.history.back();
      }, 0);
    };
  }, [onClose]);

  // Swipe down (from the handle or header) to close.
  const onTouchStart = (e: React.TouchEvent) => {
    dragStartY.current = e.touches[0].clientY;
  };
  const onTouchMove = (e: React.TouchEvent) => {
    if (dragStartY.current == null || !ref.current) return;
    const dy = Math.max(0, e.touches[0].clientY - dragStartY.current);
    ref.current.style.transform = `translateY(${dy}px)`;
  };
  const onTouchEnd = (e: React.TouchEvent) => {
    if (dragStartY.current == null || !ref.current) return;
    const dy = e.changedTouches[0].clientY - dragStartY.current;
    dragStartY.current = null;
    if (dy > 80) onClose();
    else ref.current.style.transform = "";
  };

  return (
    <div className="fixed inset-0 z-50">
      <div aria-hidden="true" className="hub-scrim-in absolute inset-0 bg-black/45" onClick={onClose} />
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        className={`hub-sheet-up absolute inset-x-0 bottom-0 flex ${sheetMaxHeightClass} flex-col rounded-t-[24px] bg-white px-4 pt-2 pb-[calc(34px+env(safe-area-inset-bottom))] text-black`}
      >
        <div onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd} className="touch-none">
          <div aria-hidden="true" className="mx-auto h-[5px] w-10 rounded-full bg-[#C9D1D2]" />
          <div className="mt-3 flex items-center justify-between gap-3">
            <h2 id={labelledBy} className="m-0 font-[family-name:var(--font-fredoka)] text-[19px] font-bold">
              {title}
            </h2>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-full border-0 bg-[#E9EEEF] text-black"
            >
              <svg aria-hidden="true" width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <path d="M3 3l12 12M15 3L3 15" />
              </svg>
            </button>
          </div>
        </div>
        <div className="mt-3 min-h-0 overflow-y-auto">{children}</div>
      </div>
    </div>
  );
}
