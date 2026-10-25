"use client";

import { TOPICS } from "@/lib/games/ftw/prompts";
import { FOCUS } from "./ui";

interface TopicPickerProps {
  /** The chosen topics; empty means every topic. */
  topics: string[];
  /** Set only for the ranker, who chooses the topics; the guesser just sees them. */
  onChange?: (topics: string[]) => void;
  rankerName: string;
}

const chip = `rounded-full border-2 border-[var(--ink)] px-3 py-1 text-[13px] font-bold ${FOCUS}`;
const on = "bg-[var(--ink)] text-white";
const off = "bg-white text-[var(--ink)] hover:bg-[#FFE94A]";
const summaryClass = `cursor-pointer rounded text-center text-sm font-bold text-[var(--ink)] min-[900px]:text-left ${FOCUS}`;

/** The ranker chooses which topics prompts come from (applied from the next prompt); the guesser sees the choice. */
export default function TopicPicker({ topics, onChange, rankerName }: TopicPickerProps) {
  const any = topics.length === 0;
  const summary = any ? "Any topic" : topics.length <= 2 ? topics.join(", ") : `${topics.slice(0, 2).join(", ")} +${topics.length - 2}`;

  if (!onChange) {
    return (
      <details>
        <summary className={summaryClass}>Topics: {summary}</summary>
        <p className="mt-2 mb-2.5 text-center text-[13px] font-medium text-[var(--muted)] min-[900px]:text-left">
          {rankerName} picks the topics while they&apos;re ranking. You&apos;ll pick them on your turn.
        </p>
        <ul aria-label="Prompt topics" className="m-0 flex list-none flex-wrap justify-center gap-1.5 p-0 min-[900px]:justify-start">
          {(any ? ["Any topic"] : topics).map((topic) => (
            <li key={topic} className={`${chip} ${on}`}>
              {topic}
            </li>
          ))}
        </ul>
      </details>
    );
  }

  const toggle = (topic: string) => onChange(topics.includes(topic) ? topics.filter((t) => t !== topic) : [...topics, topic]);
  return (
    <details>
      <summary className={summaryClass}>Topics: {summary}</summary>
      <p className="mt-2 mb-2.5 text-center text-[13px] font-medium text-[var(--muted)] min-[900px]:text-left">While you&apos;re ranking, you pick the topics. The next prompt comes from them.</p>
      <div role="group" aria-label="Prompt topics" className="flex flex-wrap justify-center gap-1.5 min-[900px]:justify-start">
        <button type="button" aria-pressed={any} className={`${chip} cursor-pointer ${any ? on : off}`} onClick={() => onChange([])}>
          Any topic
        </button>
        {TOPICS.map((topic) => {
          const picked = topics.includes(topic);
          return (
            <button key={topic} type="button" aria-pressed={picked} className={`${chip} cursor-pointer ${picked ? on : off}`} onClick={() => toggle(topic)}>
              {topic}
            </button>
          );
        })}
      </div>
    </details>
  );
}
