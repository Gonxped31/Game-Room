import type { ReactNode } from "react";
import { DISPLAY, TEXT } from "./ui";

/** Text starts right of the red margin line: 54px on phones, 64px from 900px. */
export const SHEET_INSET = "pl-[54px] min-[900px]:pl-16";

/** Each row sits on its own 2px ruled line, drawn at the row's bottom edge. */
export const RULED_ROW = "bg-[linear-gradient(transparent_calc(100%-2px),var(--rule)_calc(100%-2px))]";

/**
 * A lined paper sheet (references/ftw/first-to-worst-game-design.md, "Paper
 * sheet"): the prompt and its caption in the header (margin line, no rules),
 * then the rows. The red margin line is decoration only.
 */
export default function Sheet({ prompt, caption, children }: { prompt: string; caption: ReactNode; children: ReactNode }) {
  return (
    <div className="relative overflow-hidden rounded-md bg-[var(--paper)] pb-3 shadow-[0_4px_0_rgba(29,34,64,.16),0_14px_28px_rgba(29,34,64,.18)] min-[900px]:rounded-lg">
      <span aria-hidden="true" className="absolute inset-y-0 left-10 w-0.5 bg-[var(--margin)] min-[900px]:left-12" />
      <div className={`relative pt-[18px] pr-4 pb-3 ${SHEET_INSET} min-[900px]:pt-6 min-[900px]:pb-4`}>
        <h2 className={`${DISPLAY} m-0 text-[27px] leading-[1.1] text-[var(--ink)] min-[900px]:text-[34px]`}>{prompt}</h2>
        <div className={`${TEXT} mt-1.5 text-[13px] font-bold text-[var(--muted)] min-[900px]:text-[15px]`}>{caption}</div>
      </div>
      <div className="relative">{children}</div>
    </div>
  );
}
