import type { RoundRecord } from "@/lib/games/ftw/game";
import { useText } from "@/lib/i18n/useLang";
import type { Role } from "@/lib/session/types";
import { FTW_TEXT } from "./text";
import { FOCUS } from "./ui";

interface SessionRecapProps {
  history: RoundRecord[];
  names: Partial<Record<Role, string>>;
}

export default function SessionRecap({ history, names }: SessionRecapProps) {
  const t = useText(FTW_TEXT);
  if (history.length === 0) return null;

  return (
    <details>
      <summary className={`cursor-pointer rounded text-center text-sm font-bold text-[var(--ink)] min-[900px]:text-left ${FOCUS}`}>{t.recap(history.length)}</summary>
      <ol className="mt-2 grid list-none gap-1.5 p-0">
        {history.map((r) => (
          <li key={r.round} className="rounded-xl border-2 border-[var(--ink)] bg-[var(--paper)] px-3 py-2 text-[var(--ink)]">
            <div className="text-sm font-bold">{r.prompt}</div>
            <div className="text-[13px] font-medium text-[var(--muted)]">{t.recapLine(r.round, names[r.master], r.score)}</div>
          </li>
        ))}
      </ol>
    </details>
  );
}
