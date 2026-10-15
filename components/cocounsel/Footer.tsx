import Link from "next/link";
import { COLOR } from "@/lib/games/cocounsel/theme";

interface FooterProps {
  room: string;
  identity?: string;
  onReset: () => void;
  onNewRoom: () => void;
}

const linkClass = "cursor-pointer border-0 bg-transparent p-0 underline";

/** Same function as the shared components/Footer.tsx (room, reset, new room, all games), in Co-Counsel's own palette since the rest of its UI doesn't reuse FTW's visual language. */
export default function Footer({ room, identity, onReset, onNewRoom }: FooterProps) {
  return (
    <p className="mt-6 px-4 text-center font-[family-name:var(--font-archivo)] text-[13px]" style={{ color: COLOR.text2 }}>
      Room: {room}
      {identity ? ` · ${identity}` : null}
      <br />
      <button type="button" onClick={() => confirm("Reset the whole case?") && onReset()} className={linkClass} style={{ color: COLOR.text2 }}>
        Reset case
      </button>{" "}
      ·{" "}
      <button
        type="button"
        onClick={() => confirm("Leave this room and start a brand new one?") && onNewRoom()}
        className={linkClass}
        style={{ color: COLOR.text2 }}
      >
        New room
      </button>{" "}
      ·{" "}
      <Link href="/" className={linkClass} style={{ color: COLOR.text2 }}>
        All games
      </Link>
    </p>
  );
}
