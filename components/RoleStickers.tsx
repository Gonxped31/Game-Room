export interface RoleStickerInfo {
  emoji: string;
  /** e.g. "Master", "Emperor" - whatever this game calls the role. */
  label: string;
  name: string;
  /** Highlights this sticker as the current viewer's own role. */
  isYou: boolean;
}

interface RoleStickersProps {
  roles: RoleStickerInfo[];
}

const base = "rounded-full bg-white px-3 py-1.5 text-center text-xs font-bold text-black shadow-[0_3px_6px_rgba(0,0,0,.3)]";
const highlight = "outline outline-[3px] outline-[#FFE14D]";

/** Small pill badges showing who's playing which role right now, with the current viewer's own role highlighted. Game-agnostic - pass whatever roles/emoji this game uses. */
export default function RoleStickers({ roles }: RoleStickersProps) {
  return (
    <div className="mb-3 flex flex-wrap justify-center gap-2">
      {roles.map((role, i) => (
        <span
          key={role.label}
          className={`${base} ${role.isYou ? highlight : ""}`}
          style={{ transform: `rotate(${i % 2 === 0 ? -3 : 3}deg)` }}
        >
          {role.emoji} {role.name} · {role.label}
          {role.isYou ? " — You" : ""}
        </span>
      ))}
    </div>
  );
}
