interface RoleStickersProps {
  masterName: string;
  guesserName: string;
  /** Whether the current viewer is the master this round, to highlight their own sticker. */
  isMaster: boolean;
}

const base = "rounded-full bg-white px-3 py-1.5 text-center text-xs font-bold text-black shadow-[0_3px_6px_rgba(0,0,0,.3)]";
const highlight = "outline outline-[3px] outline-[#FFE14D]";

export default function RoleStickers({ masterName, guesserName, isMaster }: RoleStickersProps) {
  return (
    <div className="mb-3 flex flex-wrap justify-center gap-2">
      <span className={`${base} ${isMaster ? highlight : ""}`} style={{ transform: "rotate(-3deg)" }}>
        👑 {masterName} · Master{isMaster ? " — You" : ""}
      </span>
      <span className={`${base} ${!isMaster ? highlight : ""}`} style={{ transform: "rotate(3deg)" }}>
        🔎 {guesserName} · Guesser{!isMaster ? " — You" : ""}
      </span>
    </div>
  );
}
