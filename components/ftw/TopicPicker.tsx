"use client";

import { TOPICS } from "@/lib/games/ftw/prompts";

interface TopicPickerProps {
  /** The chosen topics; empty means every topic. */
  topics: string[];
  /** Set only for the master, who chooses the topics; the guesser just sees them. */
  onChange?: (topics: string[]) => void;
  masterName: string;
}

const chip = "rounded-full border-0 px-3 py-1.5 text-[13px] font-semibold";
const on = "bg-[#FFE14D] text-black shadow-[0_2px_0_rgba(0,0,0,.3)]";
const off = "bg-white/15 text-white hover:bg-white/25";

/** The master chooses which topics prompts come from (applied from the next prompt); the guesser sees the choice. */
export default function TopicPicker({ topics, onChange, masterName }: TopicPickerProps) {
  const any = topics.length === 0;
  const summary = any ? "Any topic" : topics.length <= 2 ? topics.join(", ") : `${topics.slice(0, 2).join(", ")} +${topics.length - 2}`;

  if (!onChange) {
    return (
      <details className="mt-4">
        <summary className="cursor-pointer text-center text-[13px] font-semibold opacity-85">Topics: {summary}</summary>
        <p className="mt-2 mb-2.5 text-center text-xs opacity-85">{masterName} picks the topics while they&apos;re the master. You&apos;ll pick them on your turn.</p>
        <ul aria-label="Prompt topics" className="m-0 flex list-none flex-wrap justify-center gap-1.5 p-0">
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
    <details className="mt-4">
      <summary className="cursor-pointer text-center text-[13px] font-semibold opacity-85">Topics: {summary}</summary>
      <p className="mt-2 mb-2.5 text-center text-xs opacity-85">As the master, you pick the topics. The next prompt comes from them.</p>
      <div role="group" aria-label="Prompt topics" className="flex flex-wrap justify-center gap-1.5">
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
