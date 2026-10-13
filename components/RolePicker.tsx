"use client";

import { useState } from "react";
import { Role } from "@/lib/constants";
import Button from "./Button";

interface RolePickerProps {
  /** Names already claimed in this room, if any - so a returning player (new device, cleared storage) can just say who they are. */
  names: Partial<Record<Role, string>>;
  onPick: (role: Role, name: string) => void;
}

export default function RolePicker({ names, onPick }: RolePickerProps) {
  const [draft, setDraft] = useState("");
  const [error, setError] = useState("");

  const unclaimed: Role | null = !names.p1 ? "p1" : !names.p2 ? "p2" : null;

  if (unclaimed) {
    const submit = () => {
      const name = draft.trim();
      if (!name) {
        setError("Enter your name to continue.");
        return;
      }
      setError("");
      onPick(unclaimed, name);
    };
    const otherName = names.p1 ?? names.p2;
    return (
      <div className="mt-6 grid gap-3">
        <p className="m-0 rounded-xl bg-white px-3.5 py-2.5 font-semibold text-black shadow-[0_3px_8px_rgba(0,0,0,.25)]">
          {otherName
            ? `${otherName} is already in. What's your name?`
            : "What's your name? Roles swap every round - your partner joins next with their own."}
        </p>
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && submit()}
          placeholder="Your name"
          maxLength={24}
          aria-label="Your name"
          className="w-full rounded-xl border-0 p-3.5 text-lg text-black"
        />
        {error ? (
          <p role="alert" className="m-0 rounded-xl bg-white px-3.5 py-2.5 font-semibold text-black shadow-[0_3px_8px_rgba(0,0,0,.25)]">
            {error}
          </p>
        ) : null}
        <Button onClick={submit}>Continue</Button>
      </div>
    );
  }

  return (
    <div className="mt-6 grid gap-3">
      <p className="m-0 rounded-xl bg-white px-3.5 py-2.5 font-semibold text-black shadow-[0_3px_8px_rgba(0,0,0,.25)]">
        Welcome back! Which one are you on this device?
      </p>
      <Button onClick={() => onPick("p1", names.p1!)}>I&apos;m {names.p1}</Button>
      <Button variant="alt" onClick={() => onPick("p2", names.p2!)}>
        I&apos;m {names.p2}
      </Button>
    </div>
  );
}
