import { NUMBER_GRADIENTS } from "@/lib/constants";

export type CardBack = "m" | "g";

interface CardFaceProps {
  /** The number showing on the front, or undefined while face-down with nothing assigned yet. */
  n?: number;
  /** Whether the card is flipped face-up. */
  up: boolean;
  /** Which deck back design to show: master (rainbow) or guesser (white). */
  back: CardBack;
  /** Reveal stagger delay in seconds, applied to the flip transition. */
  delay?: number;
}

export default function CardFace({ n, up, back, delay = 0 }: CardFaceProps) {
  const gradient = n ? NUMBER_GRADIENTS[(n - 1) % NUMBER_GRADIENTS.length] : undefined;

  return (
    <div className="h-full w-full" style={{ perspective: "700px" }}>
      <div
        className="flip-inner relative h-full w-full transition-transform duration-700 ease-[cubic-bezier(.3,1.25,.4,1)]"
        style={{
          transformStyle: "preserve-3d",
          transform: up ? "rotateY(180deg)" : "rotateY(0deg)",
          transitionDelay: `${delay}s`,
        }}
      >
        {/* front: white face with gradient number, pre-rotated so it lands right-side-up after the flip */}
        <div
          className="absolute inset-0 grid place-items-center rounded-[9px] border border-[#d6d6d6] bg-white shadow-[0_2px_0_rgba(0,0,0,.25),0_4px_10px_rgba(0,0,0,.25)]"
          style={{ backfaceVisibility: "hidden", transform: "rotateY(180deg)" }}
        >
          {n ? (
            <b
              className="bg-clip-text font-bold text-transparent"
              style={{
                fontSize: "clamp(32px,10.5vw,50px)",
                lineHeight: 1,
                backgroundImage: gradient
                  ? `linear-gradient(180deg,${gradient[0]},${gradient[1]})`
                  : undefined,
              }}
            >
              {n}
            </b>
          ) : null}
        </div>

        {/* back: "RANK CARD" design, master = rainbow gradient, guesser = white with split gradient text */}
        <div
          className={
            "absolute inset-0 grid place-items-center rounded-[9px] border border-[#d6d6d6] shadow-[0_2px_0_rgba(0,0,0,.25),0_4px_10px_rgba(0,0,0,.25)] " +
            (back === "m" ? "text-white" : "bg-white")
          }
          style={{
            backfaceVisibility: "hidden",
            backgroundImage:
              back === "m"
                ? "linear-gradient(180deg,#19c6e8,#7ed957 28%,#ffe14d 52%,#ff9a3c 76%,#ff3d8f)"
                : undefined,
          }}
        >
          <i
            className="text-center font-bold not-italic"
            style={
              back === "g"
                ? {
                    fontSize: "clamp(10px,3vw,13px)",
                    lineHeight: 1.05,
                    backgroundImage: "linear-gradient(#17a9c9 50%,#ff5a3c 50%)",
                    WebkitBackgroundClip: "text",
                    backgroundClip: "text",
                    color: "transparent",
                  }
                : { fontSize: "clamp(10px,3vw,13px)", lineHeight: 1.05 }
            }
          >
            RANK
            <br />
            CARD
          </i>
        </div>
      </div>
    </div>
  );
}
