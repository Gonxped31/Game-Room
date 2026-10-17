import type { PointerEvent as ReactPointerEvent } from "react";
import CardFace, { CardBack } from "./CardFace";

interface CardSlotProps {
  /** Empty dashed slot waiting for a card, vs. a placed/revealed card. */
  empty: boolean;
  n?: number;
  up?: boolean;
  back: CardBack;
  delay?: number;
  /** "ok" shows a green check, "no" shows an orange cross; omit to show no badge. */
  badge?: "ok" | "no";
  badgeDelay?: number;
  /** Pops the card in when it appears - the other player's live placements. */
  appear?: boolean;
  /** Omit to render a non-interactive slot (nothing happens here for this viewer right now). */
  onClick?: () => void;
  /** Starts a drag-to-move/-swap gesture for an already-placed card; tap-to-pick-up (onClick) still works independently. Only wired when the slot actually has a card (empty is false). */
  onDragStart?: (e: ReactPointerEvent<HTMLButtonElement>) => void;
  ariaLabel: string;
  /** Item id exposed as data-drop-id when interactive, so a dragged hand OR board card can be dropped here. */
  dropId?: string;
}

const slotClass = "h-full w-full rounded-[9px] border-0 p-0";

export default function CardSlot({
  empty,
  n,
  up = false,
  back,
  delay = 0,
  badge,
  badgeDelay = 0,
  appear = false,
  onClick,
  onDragStart,
  ariaLabel,
  dropId,
}: CardSlotProps) {
  const content = empty ? null : <CardFace n={n} up={up} back={back} delay={delay} />;
  const emptyStyle = empty ? "border-2 border-dashed border-white/60 bg-black/10 cursor-pointer" : "bg-transparent";

  return (
    <div className={`relative aspect-[2/3] w-full${appear && !empty ? " pop-in" : ""}`} data-drop-id={onClick ? dropId : undefined}>
      {onClick ? (
        <button
          type="button"
          aria-label={ariaLabel}
          onClick={onClick}
          onPointerDown={!empty ? onDragStart : undefined}
          style={!empty ? { touchAction: "none" } : undefined}
          className={`${slotClass} ${emptyStyle} cursor-pointer`}
        >
          {content}
        </button>
      ) : (
        <div role="img" aria-label={ariaLabel} className={`${slotClass} ${emptyStyle}`}>
          {content}
        </div>
      )}
      {badge ? (
        <span
          className={
            "pop-in absolute -right-1.5 -top-2 grid h-6 w-6 place-items-center rounded-full border-2 border-black text-sm font-bold text-black " +
            (badge === "ok" ? "bg-[#B6FF3B]" : "bg-[#FFB347]")
          }
          style={{ animationDelay: `${badgeDelay}s` }}
        >
          {badge === "ok" ? "✓" : "✕"}
        </span>
      ) : null}
    </div>
  );
}
