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
  onClick?: () => void;
  ariaLabel: string;
}

export default function CardSlot({
  empty,
  n,
  up = false,
  back,
  delay = 0,
  badge,
  badgeDelay = 0,
  onClick,
  ariaLabel,
}: CardSlotProps) {
  return (
    <div className="relative aspect-[2/3] w-full">
      {empty ? (
        <button
          type="button"
          aria-label={ariaLabel}
          onClick={onClick}
          className="h-full w-full cursor-pointer rounded-[9px] border-2 border-dashed border-white/60 bg-black/10 p-0"
        />
      ) : (
        <button
          type="button"
          aria-label={ariaLabel}
          onClick={onClick}
          className="h-full w-full cursor-pointer rounded-[9px] border-0 bg-transparent p-0"
        >
          <CardFace n={n} up={up} back={back} delay={delay} />
        </button>
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
