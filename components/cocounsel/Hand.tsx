import type { CaseCard } from "@/lib/games/cocounsel/caseTypes";
import ClaimCard from "./ClaimCard";
import { useText } from "@/lib/i18n/useLang";
import { CC_TEXT } from "./text";

interface HandProps {
  cards: CaseCard[];
  role: "investigator" | "defendant";
  selectedId: string | null;
  onToggle: (cardId: string) => void;
}

/** A player's 3 cards - tapping a selected card again deselects it. */
export default function Hand({ cards, role, selectedId, onToggle }: HandProps) {
  const t = useText(CC_TEXT);
  return (
    <div role="radiogroup" aria-label={t.yourCards} className="flex flex-col gap-2.5">
      {cards.map((card, i) => (
        <ClaimCard key={card.id} n={i + 1} text={card.text} role={role} selected={selectedId === card.id} onSelect={() => onToggle(card.id)} />
      ))}
    </div>
  );
}
