"use client";

import { useState } from "react";
import { ITEMS_PER_ROUND, MAX_ITEM_LENGTH, MAX_PROMPT_LENGTH } from "@/lib/games/ftw/constants";
import type { CurrentRound } from "@/lib/games/ftw/game";
import { customRound } from "@/lib/games/ftw/prompts";
import { FOCUS, SmallButton } from "./ui";

interface CustomPromptFormProps {
  onApply: (round: CurrentRound) => void;
}

export default function CustomPromptForm({ onApply }: CustomPromptFormProps) {
  const [text, setText] = useState("");
  const [error, setError] = useState("");

  const submit = () => {
    const lines = text
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean);
    if (lines.length !== ITEMS_PER_ROUND + 1) {
      setError(`Add a prompt on line 1, then exactly ${ITEMS_PER_ROUND} items, one per line.`);
      return;
    }
    if (lines[0].length > MAX_PROMPT_LENGTH || lines.slice(1).some((item) => item.length > MAX_ITEM_LENGTH)) {
      setError(`Keep the prompt to ${MAX_PROMPT_LENGTH} characters or fewer, and each item to ${MAX_ITEM_LENGTH}.`);
      return;
    }
    setError("");
    onApply(customRound(lines[0], lines.slice(1)));
    setText("");
  };

  return (
    <details className="w-full">
      <summary className={`cursor-pointer rounded py-1 text-sm font-bold text-[var(--ink)] ${FOCUS}`}>Write my own prompt</summary>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={`Line 1: the prompt\nThen exactly ${ITEMS_PER_ROUND} items, one per line`}
        aria-label="Custom prompt: line 1 is the prompt, then one item per line"
        className="mt-2 min-h-[130px] w-full rounded-xl border-2 border-[var(--ink)] bg-[var(--paper)] p-2.5 font-[inherit] text-[var(--ink)] placeholder:text-[var(--muted)]"
      />
      {error ? (
        <p role="alert" className="mt-2 mb-0 rounded-xl border-2 border-[var(--miss)] bg-white px-3.5 py-2.5 text-sm font-bold text-[var(--miss)]">
          {error}
        </p>
      ) : null}
      <SmallButton onClick={submit} className="mt-2">
        Use this prompt
      </SmallButton>
    </details>
  );
}
