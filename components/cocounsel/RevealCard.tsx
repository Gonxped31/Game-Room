"use client";

import { useEffect, useState } from "react";
import { COLOR } from "@/lib/games/cocounsel/theme";
import ExhibitTent from "./ExhibitTent";

interface RevealCardProps {
  n: number;
  text: string;
  role: "investigator" | "defendant";
  characterName: string;
}

/**
 * One side of the reveal screen's card pair. Mounts face-down and flips to
 * face-up shortly after, via the same 3D-flip technique as
 * components/ftw/CardFace.tsx (perspective wrapper, preserve-3d inner,
 * backface-hidden faces) - kept the literal `flip-inner` class name so it
 * inherits the existing global prefers-reduced-motion override for free.
 */
export default function RevealCard({ n, text, role, characterName }: RevealCardProps) {
  const [revealed, setRevealed] = useState(false);
  useEffect(() => {
    const id = requestAnimationFrame(() => setRevealed(true));
    return () => cancelAnimationFrame(id);
  }, []);

  const roleColor = role === "investigator" ? COLOR.investigator : COLOR.defendant;

  return (
    <div className="aspect-[2/3] w-full" style={{ perspective: "900px" }}>
      <div
        className="flip-inner relative h-full w-full transition-transform duration-700 ease-[cubic-bezier(.3,1.25,.4,1)]"
        style={{ transformStyle: "preserve-3d", transform: revealed ? "rotateY(180deg)" : "rotateY(0deg)" }}
      >
        <div
          className="absolute inset-0 flex min-h-[200px] flex-col gap-2 overflow-hidden rounded-xl border"
          style={{ backfaceVisibility: "hidden", transform: "rotateY(180deg)", borderColor: "#d6d6d6", backgroundColor: COLOR.white }}
        >
          <div className="px-3 py-2 text-xs font-bold text-white" style={{ backgroundColor: roleColor }}>
            {characterName}&apos;s card
          </div>
          <div className="flex flex-1 flex-col gap-2 p-3">
            <ExhibitTent n={n} />
            <span className="font-[family-name:var(--font-archivo)] text-[18px] font-bold leading-[1.25]" style={{ color: COLOR.ink }}>
              {text}
            </span>
          </div>
        </div>
        <div className="absolute inset-0 min-h-[200px] rounded-xl border" style={{ backfaceVisibility: "hidden", borderColor: "#d6d6d6", backgroundColor: roleColor }} />
      </div>
    </div>
  );
}
