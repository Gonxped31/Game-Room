"use client";

import { LANG_LABELS, LANGS, type Lang } from "@/lib/games/shared/language";
import { topicName, TOPICS } from "@/lib/games/ftw/prompts";
import { useLang, useText } from "@/lib/i18n/useLang";
import { FTW_TEXT } from "./text";
import { FOCUS } from "./ui";

interface TopicPickerProps {
  /** The chosen topics (the banks' English keys); empty means every topic. */
  topics: string[];
  /** Set only for the ranker, who chooses the topics; the guesser just sees them. */
  onChange?: (topics: string[]) => void;
  /** The room's content language: the bank the next prompts come from. */
  lang: Lang;
  /** Set only for the ranker, who chooses it with the topics. */
  onLangChange?: (lang: Lang) => void;
  rankerName: string;
}

const chip = `rounded-full border-2 border-[var(--ink)] px-3 py-1 text-[13px] font-bold ${FOCUS}`;
const on = "bg-[var(--ink)] text-white";
const off = "bg-white text-[var(--ink)] hover:bg-[#FFE94A]";
const summaryClass = `cursor-pointer rounded text-center text-sm font-bold text-[var(--ink)] min-[900px]:text-left ${FOCUS}`;
const rowClass = "flex flex-wrap items-center justify-center gap-1.5 min-[900px]:justify-start";
const labelClass = "text-sm font-bold text-[var(--ink)]";

/**
 * The prompt language, above the topics and always in view: chips the ranker
 * switches (from the next prompt on), the current one for the guesser.
 */
function LangChoice({ lang, onLangChange }: { lang: Lang; onLangChange?: (lang: Lang) => void }) {
  const t = useText(FTW_TEXT);
  if (!onLangChange) {
    return (
      <p className={`m-0 ${rowClass}`}>
        <span className={labelClass}>{t.promptLanguage}</span>
        <span className={`${chip} ${on}`}>{LANG_LABELS[lang]}</span>
      </p>
    );
  }
  return (
    <div className={rowClass}>
      <span className={labelClass}>{t.promptLanguage}</span>
      <span role="group" aria-label={t.promptLanguage} className="flex gap-1.5">
        {LANGS.map((l) => (
          <button key={l} type="button" lang={l} aria-pressed={l === lang} className={`${chip} cursor-pointer ${l === lang ? on : off}`} onClick={() => onLangChange(l)}>
            {LANG_LABELS[l]}
          </button>
        ))}
      </span>
      <span className="text-[13px] font-medium text-[var(--muted)]">{t.langFromNext}</span>
    </div>
  );
}

/**
 * The ranker chooses which topics prompts come from, and their language
 * (applied from the next prompt); the guesser sees the choice. Topic names
 * show in the interface language.
 */
export default function TopicPicker({ topics, onChange, lang, onLangChange, rankerName }: TopicPickerProps) {
  const t = useText(FTW_TEXT);
  const uiLang = useLang();
  const names = topics.map((topic) => topicName(topic, uiLang));
  const any = topics.length === 0;
  const summary = any ? t.anyTopic : names.length <= 2 ? names.join(", ") : `${names.slice(0, 2).join(", ")} +${names.length - 2}`;

  if (!onChange) {
    return (
      <div className="flex flex-col gap-2.5">
        <LangChoice lang={lang} />
        <details>
          <summary className={summaryClass}>{t.topicsSummary(summary)}</summary>
          <p className="mt-2 mb-2.5 text-center text-[13px] font-medium text-[var(--muted)] min-[900px]:text-left">{t.rankerPicksTopics(rankerName)}</p>
          <ul aria-label={t.promptTopics} className="m-0 flex list-none flex-wrap justify-center gap-1.5 p-0 min-[900px]:justify-start">
            {(any ? [t.anyTopic] : names).map((name) => (
              <li key={name} className={`${chip} ${on}`}>
                {name}
              </li>
            ))}
          </ul>
        </details>
      </div>
    );
  }

  const toggle = (topic: string) => onChange(topics.includes(topic) ? topics.filter((chosen) => chosen !== topic) : [...topics, topic]);
  return (
    <div className="flex flex-col gap-2.5">
      <LangChoice lang={lang} onLangChange={onLangChange} />
      <details>
        <summary className={summaryClass}>{t.topicsSummary(summary)}</summary>
        <p className="mt-2 mb-2.5 text-center text-[13px] font-medium text-[var(--muted)] min-[900px]:text-left">{t.youPickTopics}</p>
        <div role="group" aria-label={t.promptTopics} className="flex flex-wrap justify-center gap-1.5 min-[900px]:justify-start">
          <button type="button" aria-pressed={any} className={`${chip} cursor-pointer ${any ? on : off}`} onClick={() => onChange([])}>
            {t.anyTopic}
          </button>
          {TOPICS.map((topic) => {
            const picked = topics.includes(topic);
            return (
              <button key={topic} type="button" aria-pressed={picked} className={`${chip} cursor-pointer ${picked ? on : off}`} onClick={() => toggle(topic)}>
                {topicName(topic, uiLang)}
              </button>
            );
          })}
        </div>
      </details>
    </div>
  );
}
