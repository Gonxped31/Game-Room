import type { Archetype } from "@/lib/games/ecard/game";

export type CardBack = "emperor" | "slave";

const ARCHETYPE_STYLE: Record<Archetype, { emoji: string; label: string; gradient: [string, string] }> = {
  emperor: { emoji: "👑", label: "EMPEROR", gradient: ["#FFE066", "#E8920A"] },
  citizen: { emoji: "👥", label: "CITIZEN", gradient: ["#A0C4FF", "#3D6FA8"] },
  slave: { emoji: "🃏", label: "SLAVE", gradient: ["#FF9CC4", "#C9184A"] },
};

interface CardFaceProps {
  /** The archetype to show on the front, or undefined while face-down with nothing placed yet. */
  archetype?: Archetype;
  /** Whether the card is flipped face-up. */
  up: boolean;
  /** Whose deck this card belongs to this round - the back design. */
  back: CardBack;
  /** Reveal transition delay in seconds. */
  delay?: number;
}

export default function CardFace({ archetype, up, back, delay = 0 }: CardFaceProps) {
  const style = archetype ? ARCHETYPE_STYLE[archetype] : undefined;

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
        {/* front: white face with the archetype's icon + gradient label, pre-rotated so it lands right-side-up after the flip */}
        <div
          className="absolute inset-0 grid place-items-center gap-1 rounded-[9px] border border-[#d6d6d6] bg-white shadow-[0_2px_0_rgba(0,0,0,.25),0_4px_10px_rgba(0,0,0,.25)]"
          style={{ backfaceVisibility: "hidden", transform: "rotateY(180deg)" }}
        >
          {style ? (
            <>
              <span style={{ fontSize: "clamp(22px,7vw,34px)", lineHeight: 1 }}>{style.emoji}</span>
              <b
                className="bg-clip-text text-center font-bold text-transparent"
                style={{
                  fontSize: "clamp(9px,2.6vw,12px)",
                  lineHeight: 1,
                  backgroundImage: `linear-gradient(180deg,${style.gradient[0]},${style.gradient[1]})`,
                }}
              >
                {style.label}
              </b>
            </>
          ) : null}
        </div>

        {/* back: whose deck this is - Emperor (royal purple/gold) vs Slave (dark red) */}
        <div
          className="absolute inset-0 grid place-items-center rounded-[9px] border border-[#d6d6d6] text-white shadow-[0_2px_0_rgba(0,0,0,.25),0_4px_10px_rgba(0,0,0,.25)]"
          style={{
            backfaceVisibility: "hidden",
            backgroundImage:
              back === "emperor"
                ? "linear-gradient(180deg,#5b2a86,#8f4fc9 45%,#e8b84b 100%)"
                : "linear-gradient(180deg,#3b0a14,#8c1f3a 55%,#c9184a 100%)",
          }}
        >
          <i className="text-center font-bold not-italic" style={{ fontSize: "clamp(10px,3vw,13px)", lineHeight: 1.05 }}>
            E
            <br />
            CARD
          </i>
        </div>
      </div>
    </div>
  );
}
