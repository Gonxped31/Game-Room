"use client";

import { useRef, type KeyboardEvent, type ReactNode } from "react";

/**
 * A segmented switch: role="radiogroup", arrow keys move the choice
 * (the pattern the other games use).
 */
export function Segmented<T extends string | number>({
  label,
  options,
  value,
  onChange,
  render,
}: {
  label: string;
  options: readonly T[];
  value: T;
  onChange: (value: T) => void;
  render: (option: T) => ReactNode;
}) {
  const buttons = useRef<(HTMLButtonElement | null)[]>([]);
  const onKeyDown = (event: KeyboardEvent, index: number) => {
    const step = event.key === "ArrowRight" || event.key === "ArrowDown" ? 1 : event.key === "ArrowLeft" || event.key === "ArrowUp" ? -1 : 0;
    if (!step) return;
    event.preventDefault();
    const next = (index + step + options.length) % options.length;
    onChange(options[next]);
    buttons.current[next]?.focus();
  };
  return (
    <div role="radiogroup" aria-label={label} className="cg-seg">
      {options.map((option, index) => (
        <button
          key={String(option)}
          ref={(el) => {
            buttons.current[index] = el;
          }}
          type="button"
          role="radio"
          aria-checked={option === value}
          tabIndex={option === value ? 0 : -1}
          className="cg-seg-option"
          onClick={() => onChange(option)}
          onKeyDown={(event) => onKeyDown(event, index)}
        >
          {render(option)}
        </button>
      ))}
    </div>
  );
}

/** An on/off switch with its label. */
export function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (checked: boolean) => void }) {
  return (
    <button type="button" role="switch" aria-checked={checked} className="cg-toggle" onClick={() => onChange(!checked)}>
      <span aria-hidden="true" className="cg-toggle-track">
        <span className="cg-toggle-thumb" />
      </span>
      {label}
    </button>
  );
}

/** m:ss (or h:mm:ss past an hour). */
export function formatTime(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = String(total % 60).padStart(2, "0");
  return h ? `${h}:${String(m).padStart(2, "0")}:${s}` : `${m}:${s}`;
}
