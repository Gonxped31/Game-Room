import Link from "next/link";

interface HeaderProps {
  title: string;
  round?: number;
  myScore?: number;
  theirScore?: number;
}

export default function Header({ title, round, myScore, theirScore }: HeaderProps) {
  return (
    <div className="mb-3 flex items-center justify-between gap-2">
      <div className="flex min-w-0 items-center gap-2">
        <Link
          href="/"
          aria-label="Back to all games"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-black/40 text-lg leading-none text-white no-underline"
        >
          ←
        </Link>
        <h1 className="m-0 -rotate-2 rounded-[9px] bg-white px-3 py-2 text-[22px] font-bold leading-none text-black shadow-[0_3px_8px_rgba(0,0,0,.3)]">
          {title}
        </h1>
      </div>
      {round != null ? (
        <div className="shrink-0 rounded-full bg-black px-3 py-1.5 text-sm font-semibold">
          Round {round} · You {myScore} – {theirScore}
        </div>
      ) : null}
    </div>
  );
}
