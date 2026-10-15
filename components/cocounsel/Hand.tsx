import type { CaseCard } from "@/lib/games/cocounsel/caseTypes";
import ClaimCard from "./ClaimCard";

interface HandProps {
  cards: CaseCard[];
  role: "investigator" | "defendant";
  selectedId: string | null;
  onToggle: (cardId: string) => void;
}

/** A player's 3 cards - tapping a selected card again deselects it. */
export default function Hand({ cards, role, selectedId, onToggle }: HandProps) {
  return (
    <div role="radiogroup" aria-label="Your cards" className="flex flex-col gap-2.5">
      {cards.map((card, i) => (
        <ClaimCard key={card.id} n={i + 1} text={card.text} role={role} selected={selectedId === card.id} onSelect={() => onToggle(card.id)} />
      ))}
    </div>
  );
}
