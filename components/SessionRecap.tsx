import { ITEMS_PER_ROUND, Role } from "@/lib/constants";
import type { RoundRecord } from "@/lib/game";

interface SessionRecapProps {
  history: RoundRecord[];
  names: Partial<Record<Role, string>>;
}

export default function SessionRecap({ history, names }: SessionRecapProps) {
  if (history.length === 0) return null;

  return (
    <details className="mt-4">
      <summary className="cursor-pointer text-center text-[13px] font-semibold opacity-85">
        Session recap ({history.length} round{history.length === 1 ? "" : "s"})
      </summary>
      <ol className="mt-2 grid list-none gap-1.5 p-0">
        {history.map((r) => (
          <li key={r.round} className="rounded-lg bg-white px-3 py-1.5 text-black shadow-[0_2px_4px_rgba(0,0,0,.2)]">
            <div className="text-sm font-semibold">{r.prompt}</div>
            <div className="text-xs opacity-70">
              Round {r.round} · {names[r.master] ?? "Master"} was master · {r.score}/{ITEMS_PER_ROUND}
            </div>
          </li>
        ))}
      </ol>
    </details>
  );
}
