interface HeaderProps {
  title: string;
  round?: number;
  myScore?: number;
  theirScore?: number;
}

export default function Header({ title, round, myScore, theirScore }: HeaderProps) {
  return (
    <div className="mb-3 flex items-center justify-between">
      <h1 className="m-0 -rotate-2 rounded-[9px] bg-white px-3 py-2 text-[22px] font-bold leading-none text-black shadow-[0_3px_8px_rgba(0,0,0,.3)]">
        {title}
      </h1>
      {round != null ? (
        <div className="rounded-full bg-black px-3 py-1.5 text-sm font-semibold">
          Round {round} · You {myScore} – {theirScore}
        </div>
      ) : null}
    </div>
  );
}
