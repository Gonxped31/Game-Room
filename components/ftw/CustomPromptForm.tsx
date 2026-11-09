"use client";

import { useState } from "react";
import { ITEMS_PER_ROUND, MAX_ITEM_LENGTH, MAX_PROMPT_LENGTH } from "@/lib/games/ftw/constants";
import type { CurrentRound } from "@/lib/games/ftw/game";
import { customRound } from "@/lib/games/ftw/prompts";
import { useText } from "@/lib/i18n/useLang";
import { FTW_TEXT } from "./text";
import { FOCUS, SmallButton } from "./ui";

interface CustomPromptFormProps {
  onApply: (round: CurrentRound) => void;
}

export default function CustomPromptForm({ onApply }: CustomPromptFormProps) {
  const [text, setText] = useState("");
  const [error, setError] = useState("");
  const t = useText(FTW_TEXT);

  const submit = () => {
    const lines = text
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean);
    if (lines.length !== ITEMS_PER_ROUND + 1) {
      setError(t.customLineCount);
      return;
    }
    if (lines[0].length > MAX_PROMPT_LENGTH || lines.slice(1).some((item) => item.length > MAX_ITEM_LENGTH)) {
      setError(t.customTooLong);
      return;
    }
    setError("");
    onApply(customRound(lines[0], lines.slice(1)));
    setText("");
  };

  return (
    <details className="w-full">
      <summary className={`cursor-pointer rounded py-1 text-sm font-bold text-[var(--ink)] ${FOCUS}`}>{t.writeOwn}</summary>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={t.customPlaceholder}
        aria-label={t.customLabel}
        className="mt-2 min-h-[130px] w-full rounded-xl border-2 border-[var(--ink)] bg-[var(--paper)] p-2.5 font-[inherit] text-[var(--ink)] placeholder:text-[var(--muted)]"
      />
      {error ? (
        <p role="alert" className="mt-2 mb-0 rounded-xl border-2 border-[var(--miss)] bg-white px-3.5 py-2.5 text-sm font-bold text-[var(--miss)]">
          {error}
        </p>
      ) : null}
      <SmallButton onClick={submit} className="mt-2">
        {t.usePrompt}
      </SmallButton>
    </details>
  );
}
