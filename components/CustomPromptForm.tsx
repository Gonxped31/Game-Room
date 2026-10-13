"use client";

import { useState } from "react";
import { ITEMS_PER_ROUND } from "@/lib/constants";
import type { CurrentRound } from "@/lib/game";
import { customRound } from "@/lib/prompts";
import Button from "./Button";

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
    setError("");
    onApply(customRound(lines[0], lines.slice(1)));
    setText("");
  };

  return (
    <details className="mt-3">
      <summary className="cursor-pointer font-semibold">Write my own prompt</summary>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={`Line 1: the prompt\nThen exactly ${ITEMS_PER_ROUND} items, one per line`}
        aria-label="Custom prompt: line 1 is the prompt, then one item per line"
        className="mt-2 min-h-[110px] w-full rounded-[10px] border-0 p-2.5 font-[inherit] text-black"
      />
      {error ? (
        <p role="alert" className="mt-2 mb-0 rounded-xl bg-white px-3.5 py-2.5 font-semibold text-black shadow-[0_3px_8px_rgba(0,0,0,.25)]">
          {error}
        </p>
      ) : null}
      <Button variant="sm" onClick={submit}>
        Use this prompt
      </Button>
    </details>
  );
}
