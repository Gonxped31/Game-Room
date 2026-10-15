import { COLOR } from "@/lib/games/cocounsel/theme";
import ExhibitTent from "./ExhibitTent";

interface ClaimCardProps {
  n: number;
  text: string;
  /** Which role's hand this card belongs to - tints the unselected border. */
  role: "investigator" | "defendant";
  selected: boolean;
  onSelect: () => void;
}

/** A card in a player's hand. Tapping a selected card again deselects it - the parent hand owns that toggle via onSelect. */
export default function ClaimCard({ n, text, role, selected, onSelect }: ClaimCardProps) {
  const edgeColor = role === "investigator" ? COLOR.cardEdgeBlue : COLOR.cardEdgeRed;
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onSelect}
      className={`flex min-h-16 w-full items-center gap-3 rounded-xl border-2 px-3.5 py-3 text-left ${selected ? "card-lift" : ""}`}
      style={{
        backgroundColor: COLOR.white,
        borderColor: selected ? COLOR.ink : edgeColor,
        borderWidth: selected ? "3px" : "2px",
        boxShadow: selected ? `0 5px 0 ${COLOR.ink}` : "none",
      }}
    >
      <ExhibitTent n={n} />
      <span className="flex-1 font-[family-name:var(--font-archivo)] text-[17px] font-bold leading-[1.25]" style={{ color: COLOR.ink }}>
        {text}
      </span>
      {selected ? (
        <span
          aria-hidden="true"
          className="flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-full text-white"
          style={{ backgroundColor: COLOR.ink }}
        >
          ✓
        </span>
      ) : null}
    </button>
  );
}
