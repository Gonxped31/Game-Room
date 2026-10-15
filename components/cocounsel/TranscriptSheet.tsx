"use client";

import { useEffect, useRef, useState } from "react";
import { COLOR } from "@/lib/games/cocounsel/theme";

interface TranscriptSheetProps {
  text: string;
  role: "investigator" | "defendant";
  label?: string;
}

const LINE_HEIGHT = 26;

/** The "What you know" sheet: ruled lines, generated line numbers, Courier Prime typed look. */
export default function TranscriptSheet({ text, role, label = "What you know" }: TranscriptSheetProps) {
  const textRef = useRef<HTMLParagraphElement>(null);
  const [lineCount, setLineCount] = useState(1);

  useEffect(() => {
    const el = textRef.current;
    if (!el) return;
    const measure = () => setLineCount(Math.max(1, Math.round(el.offsetHeight / LINE_HEIGHT)));
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [text]);

  const tabColor = role === "investigator" ? COLOR.investigator : COLOR.defendant;
  const ruleColor = role === "investigator" ? COLOR.ruleBlue : COLOR.ruleRed;
  const gutterColor = role === "investigator" ? COLOR.gutterBlue : COLOR.gutterRed;

  return (
    <div className="relative mt-4 rounded-[6px] shadow-[0_2px_6px_rgba(0,0,0,.12)]" style={{ backgroundColor: COLOR.white }}>
      <div className="absolute -top-[22px] left-3 rounded-t-[4px] px-3 py-1.5 text-xs font-bold text-white" style={{ backgroundColor: tabColor }}>
        {label}
      </div>
      <div className="flex overflow-hidden rounded-[6px] pt-2">
        <div
          aria-hidden="true"
          className="flex w-10 shrink-0 flex-col items-end border-r-[3px] pr-2 pt-px font-[family-name:var(--font-courier-prime)] text-[15px]"
          style={{ borderColor: gutterColor, color: gutterColor, lineHeight: `${LINE_HEIGHT}px` }}
        >
          {Array.from({ length: lineCount }, (_, i) => (
            <span key={i}>{i + 1}</span>
          ))}
        </div>
        <p
          ref={textRef}
          className="flex-1 px-3 pt-px font-[family-name:var(--font-courier-prime)] text-[15px]"
          style={{
            color: COLOR.ink,
            lineHeight: `${LINE_HEIGHT}px`,
            backgroundImage: `repeating-linear-gradient(${ruleColor}, ${ruleColor} 1px, transparent 1px, transparent ${LINE_HEIGHT}px)`,
            backgroundOrigin: "content-box",
          }}
        >
          {text}
        </p>
      </div>
    </div>
  );
}
