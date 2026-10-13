import CardFace, { CardBack } from "./CardFace";

interface HandProps {
  numbers: number[];
  selected: number | null;
  back: CardBack;
  onSelect: (n: number) => void;
}

export default function Hand({ numbers, selected, back, onSelect }: HandProps) {
  return (
    <div className="mb-1.5 mt-4.5 flex min-h-[calc(min(17vw,76px)*1.5)] flex-wrap justify-center gap-2">
      {numbers.map((n) => (
        <button
          type="button"
          key={n}
          aria-label={`Number ${n} card`}
          aria-pressed={selected === n}
          onClick={() => onSelect(n)}
          className={
            "aspect-[2/3] w-[min(17vw,76px)] cursor-pointer rounded-[9px] border-0 bg-transparent p-0 transition-transform duration-150 " +
            (selected === n ? "-translate-y-3 scale-[1.06] outline outline-4 outline-[#FFE14D]" : "")
          }
        >
          <CardFace n={n} up back={back} />
        </button>
      ))}
    </div>
  );
}
