import type { ECard } from "@/lib/games/ecard/game";
import CardFace, { type CardBack } from "./CardFace";

interface HandProps {
  cards: ECard[];
  back: CardBack;
  /** Tapping a card plays it immediately - there's exactly one slot to fill, no separate select-then-place step. */
  onPlay: (cardId: string) => void;
}

export default function Hand({ cards, back, onPlay }: HandProps) {
  return (
    <div className="mb-1.5 flex min-h-[calc(min(15vw,68px)*1.5)] flex-wrap justify-center gap-2">
      {cards.map((card) => (
        <button
          type="button"
          key={card.id}
          aria-label={`Play your ${card.archetype} card`}
          onClick={() => onPlay(card.id)}
          className="aspect-[2/3] w-[min(15vw,68px)] cursor-pointer rounded-[9px] border-0 bg-transparent p-0 transition-transform duration-150 active:scale-95"
        >
          <CardFace archetype={card.archetype} up back={back} />
        </button>
      ))}
    </div>
  );
}
